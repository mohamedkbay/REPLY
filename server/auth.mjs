import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

export const TRIAL_MS = 86_400_000;
export const TRIAL_REPLIES = 50;
export const SESSION_MS = 7 * TRIAL_MS;
export const cookieName = 'reply_session';
export const digest = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export function cookies(request) {
  return Object.fromEntries((request.headers.get('cookie') ?? '').split(';').map(part => { const i=part.indexOf('='); return i<0 ? ['', ''] : [part.slice(0,i).trim(),part.slice(i+1)]; }));
}
export function normalizeEmail(value) { return String(value ?? '').trim().toLowerCase(); }
export function parseProfile(form) {
  const name=String(form.get('name') ?? '').trim(), email=normalizeEmail(form.get('email'));
  const age=Number(form.get('age'));
  let whatsapp=String(form.get('whatsapp') ?? '').trim().replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[\s()+-]/g,'');
  if (/^09\d{8}$/.test(whatsapp)) whatsapp='218'+whatsapp.slice(1);
  if (name.length<2 || name.length>100 || !validEmail(email) || !Number.isInteger(age) || age<18 || age>120 || !/^2189\d{8}$/.test(whatsapp)) return null;
  return { name, email, age, whatsapp };
}
export function validEmail(email) { return email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

export function initializeAuth(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,whatsapp TEXT NOT NULL,age INTEGER NOT NULL,created_at INTEGER NOT NULL,trial_end INTEGER NOT NULL,paid_until INTEGER NOT NULL DEFAULT 0,replies_used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,code_hash TEXT NOT NULL,profile TEXT,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,starts INTEGER NOT NULL,hits INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media_routes(image_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id));
  `);
}

export function createAuth({ db, secret, sendMail, now = Date.now }) {
  function rate(key, limit, window) {
    const time=now(), hashed=digest(secret,key);
    const row=db.prepare(`INSERT INTO rate_limits(key,starts,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET starts=CASE WHEN starts<=? THEN excluded.starts ELSE starts END,hits=CASE WHEN starts<=? THEN 1 ELSE hits+1 END RETURNING hits`).get(hashed,time,time-window,time-window);
    return row.hits<=limit;
  }
  function user(request) {
    const token=cookies(request)[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare('SELECT c.* FROM customers c JOIN sessions s ON s.customer_id=c.id WHERE s.token_hash=? AND s.expires>?').get(digest(secret,token),now()) ?? null;
  }
  function state(customer) {
    const paid=customer.paid_until>now();
    return { paid, active: paid || customer.trial_end>now() && customer.replies_used<TRIAL_REPLIES, expired: customer.trial_end<=now(), remaining: Math.max(0,TRIAL_REPLIES-customer.replies_used) };
  }
  function reserve(id) {
    return Number(db.prepare('UPDATE customers SET replies_used=replies_used+1 WHERE id=? AND (paid_until>? OR (trial_end>? AND replies_used<?))').run(id,now(),now(),TRIAL_REPLIES).changes)===1;
  }
  function session(customerId) {
    const token=newToken();
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(secret,token),customerId,now()+SESSION_MS);
    return token;
  }
  async function issue(email, profile, ip) {
    if (!validEmail(email)) return { error: 'اكتب بريدًا إلكترونيًا صحيحًا.', status:400 };
    if (!rate('request:ip:'+ip,20,3_600_000) || !rate('request:email:'+email,1,60_000) || !rate('hour:email:'+email,5,3_600_000)) return {error:'انتظر دقيقة قبل طلب رمز جديد.',status:429};
    if (!sendMail) return {error:'إرسال رموز البريد لم يُفعّل بعد. تواصل مع Helpdsek.',status:503};
    const existing=db.prepare('SELECT id FROM customers WHERE email=?').get(email);
    const id=newToken(), code=String(randomInt(0,1_000_000)).padStart(6,'0');
    // Identical response for unknown sign-in addresses. No account is created until verification.
    if (!existing && !profile) return {id};
    db.prepare('INSERT INTO challenges(id,email,code_hash,profile,expires) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET id=excluded.id,code_hash=excluded.code_hash,profile=excluded.profile,expires=excluded.expires,attempts=0').run(id,email,digest(secret,id+':'+code),existing?null:JSON.stringify(profile),now()+300_000);
    try { await sendMail({ email, code }); }
    catch { db.prepare('DELETE FROM challenges WHERE id=?').run(id); return {error:'تعذّر إرسال الرمز. حاول بعد دقيقة أو تواصل مع Helpdsek.',status:503}; }
    return {id};
  }
  function verify(id, code, ip) {
    if (!rate('verify:ip:'+ip,40,600_000)) return null;
    if (!/^[a-f0-9]{64}$/.test(id) || !/^\d{6}$/.test(code)) return null;
    const row=db.prepare('UPDATE challenges SET attempts=attempts+1 WHERE id=? AND expires>? AND attempts<5 RETURNING *').get(id,now());
    if (!row || !timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(digest(secret,id+':'+code),'hex'))) return null;
    db.exec('BEGIN IMMEDIATE');
    try {
      // Consumption and account/session creation commit together, preventing code reuse.
      if (!db.prepare('DELETE FROM challenges WHERE id=?').run(id).changes) throw new Error('Consumed');
      let customer=db.prepare('SELECT * FROM customers WHERE email=?').get(row.email);
      if (!customer) {
        const profile=JSON.parse(row.profile);
        const id=randomUUID(), time=now();
        db.prepare('INSERT INTO customers(id,email,name,whatsapp,age,created_at,trial_end) VALUES(?,?,?,?,?,?,?)').run(id,row.email,profile.name,profile.whatsapp,profile.age,time,time+TRIAL_MS);
        customer=db.prepare('SELECT * FROM customers WHERE id=?').get(id);
      }
      const token=session(customer.id);
      db.exec('COMMIT');
      return {customer,token};
    } catch { db.exec('ROLLBACK'); return null; }
  }
  function logout(request) { const token=cookies(request)[cookieName]; if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(secret,token)); }
  function cleanup() {
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(now());
    db.prepare('DELETE FROM challenges WHERE expires<=?').run(now());
    db.prepare('DELETE FROM rate_limits WHERE starts<?').run(now()-86_400_000);
  }
  return { user,state,reserve,issue,verify,logout,cleanup };
}

export function resendMailer(apiKey, from) {
  if (!apiKey || !from) return undefined;
  return async ({email,code}) => {
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},signal:AbortSignal.timeout(15_000),body:JSON.stringify({from,to:[email],subject:`${code} · Reply`,text:`رمز دخولك إلى Reply: ${code}\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.\nYour Reply sign-in code: ${code}\nValid for 5 minutes. Never share this code.`})});
    if (!response.ok) throw new Error('Email provider rejected request');
  };
}
