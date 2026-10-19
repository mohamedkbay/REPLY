import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

class Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.db, this.sql, values.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value)); }
  execute() {
    const statement = this.db.prepare(this.sql);
    const result = statement.run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  async run() { return this.execute(); }
  async first(column) { const row = this.db.prepare(this.sql).get(...this.values); return row ? column ? row[column] : { ...row } : null; }
  async all() { return { success: true, results: this.db.prepare(this.sql).all(...this.values).map(row => ({ ...row })), meta: {} }; }
}

export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  return db;
}

export function d1Adapter(db) {
  return {
    prepare: sql => new Statement(db, sql),
    async exec(sql) { db.exec(sql); return { count: 1, duration: 0 }; },
    // No awaits inside the transaction: concurrent requests cannot share it.
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try { const results = statements.map(statement => statement.execute()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
}

export function openWorkspace(directory, id, migrationsDirectory) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid workspace');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = openDatabase(join(directory, `${id}.sqlite`));
  db.exec('CREATE TABLE IF NOT EXISTS reply_migrations(name TEXT PRIMARY KEY)');
  const applied = new Set(db.prepare('SELECT name FROM reply_migrations').all().map(row => row.name));
  for (const name of readdirSync(migrationsDirectory).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    if (applied.has(name)) continue;
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(readFileSync(join(migrationsDirectory, name), 'utf8')); db.prepare('INSERT INTO reply_migrations VALUES(?)').run(name); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  // New SaaS workspaces never contain the old migration's example automation.
  if (!applied.size) {
    db.exec('DELETE FROM rules; DELETE FROM automation_settings;');
    db.prepare('INSERT INTO automation_settings(key,value,updated_at) VALUES(?,?,?)').run('dm_features',JSON.stringify({revision:'saas-initial',startersEnabled:false,starters:[],followerCheckEnabled:false,followerReply:'',nonFollowerReply:'',keywordRepliesEnabled:false,customReplies:[],storyRules:[]}),new Date().toISOString());
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS reply_entitlement(id INTEGER PRIMARY KEY CHECK(id=1), paid INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO reply_entitlement(id,paid) VALUES(1,0);
    CREATE TRIGGER IF NOT EXISTS reply_product_cap BEFORE INSERT ON products
    WHEN (SELECT paid FROM reply_entitlement WHERE id=1)=0 AND (SELECT COUNT(*) FROM products)>=20
    BEGIN SELECT RAISE(ABORT,'reply_trial_product_limit'); END;
    CREATE UNIQUE INDEX IF NOT EXISTS reply_one_platform ON connected_accounts(platform) WHERE credentials!='' AND status!='disconnected';
    CREATE UNIQUE INDEX IF NOT EXISTS reply_one_tiktok ON tiktok_accounts((1)) WHERE credentials!='';
  `);
  return { sqlite: db, DB: d1Adapter(db) };
}
