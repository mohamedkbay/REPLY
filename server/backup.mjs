import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Use while the service is stopped for a consistent snapshot across all workspaces.
// SQLite's backup API also folds WAL pages into each individual backup safely.
const source=resolve(process.env.REPLY_DATA_DIR??'.reply-data');
const destination=process.argv[2]&&resolve(process.argv[2]);
if(!destination || destination===source || destination.startsWith(source+'/'))throw new Error('Choose a new backup directory outside the live data directory');
await mkdir(destination,{recursive:false,mode:0o700});
const files=['control.sqlite'];
try{for(const name of await readdir(join(source,'workspaces')))if(/^[a-f0-9-]{36}\.sqlite$/.test(name))files.push('workspaces/'+name);}catch(error){if(error.code!=='ENOENT')throw error;}
const manifest=[];
for(const file of files){
  if(file.includes('/'))await mkdir(join(destination,'workspaces'),{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(source,file),{readOnly:true});
  try{await backup(db,join(destination,file));}finally{db.close();}
  const restored=new DatabaseSync(join(destination,file),{readOnly:true});
  try{if(restored.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity failure');}finally{restored.close();}
  manifest.push({path:file,bytes:(await stat(join(destination,file))).size,sha256:createHash('sha256').update(readFileSync(join(destination,file))).digest('hex')});
}
await writeFile(join(destination,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2),{mode:0o600});
console.log(`Verified ${files.length} database backups. Encrypt and copy this directory off the server.`);
