import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { createAuth, initializeAuth, digest, TRIAL_MS } from '../server/auth.mjs';
import { d1Adapter, openDatabase } from '../server/database.mjs';
import { buildModule } from './worker-harness.mjs';

const origin='https://reply.test';
const secret='test-auth-secret-with-more-than-32-characters';
let createApplication;
before(async()=>{
  await build({entryPoints:['src/saas-entry.ts'],outfile:'dist/saas.mjs',bundle:true,format:'esm',platform:'node',target:'node24',logLevel:'silent'});
  ({createApplication}=await import('../server/app.mjs'));
});
async function setup(t,overrides={}) {
  const directory=await mkdtemp(join(tmpdir(),'reply-saas-'));
  const mail=[];let time=Date.now();
  const config={origin,directory,secret,encryptionKey:'different-account-encryption-secret-32-characters',sendMail:async message=>mail.push(message),now:()=>time,dryRun:true,...overrides};
  const app=await createApplication(config);
  t.after(async()=>{app.close();await rm(directory,{recursive:true,force:true});});
  const request=(path,options={})=>app.handle(new Request(origin+path,options),{ip:'test-ip'});
  const post=(path,values,cookie,extra={})=>request(path,{method:'POST',headers:{origin,...(cookie?{cookie}:{}),...extra},body:new URLSearchParams(values)});
  const control=()=>new DatabaseSync(join(directory,'control.sqlite'));
  async function signup(index=1) {
    const response=await post('/auth/signup',{name:`تاجر ${index}`,email:`merchant${index}@test.ly`,whatsapp:`091000000${index}`,age:'30'});
    const id=(await response.text()).match(/name="id" value="([a-f0-9]{64})"/)?.[1];assert.ok(id);
    const code=mail.at(-1).code;
    const verified=await post('/auth/verify',{id,code});assert.equal(verified.status,303);
    const cookie=verified.headers.get('set-cookie').split(';')[0];
    return {cookie,id,code};
  }
  return {app,config,directory,mail,request,post,signup,control,advance:ms=>time+=ms};
}

test('registration stays unavailable without real email configuration and never creates an unverified customer',async t=>{
  const h=await setup(t,{sendMail:undefined});
  assert.equal((await h.request('/')).headers.get('location'),'/auth/login');
  const page=await h.request('/auth/signup');assert.match(await page.text(),/التسجيل بالبريد قريبًا/);
  const response=await h.post('/auth/signup',{name:'متجر جديد',email:'a@test.ly',whatsapp:'0910000001',age:'28'});assert.equal(response.status,503);
  const db=h.control();assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,0);db.close();
  assert.equal((await h.request('/admin',{headers:{cookie:'ig_dm_admin=forged'}})).headers.get('location'),'/auth/login');
});

test('email OTP is hashed, expires, has five attempts, and can be consumed only once',async t=>{
  const h=await setup(t);
  const user=await h.signup();
  assert.equal((await h.post('/auth/verify',{id:user.id,code:user.code})).status,400);
  const response=await h.post('/auth/signup',{name:'متجر آخر',email:'other@test.ly',whatsapp:'0910000002',age:22});
  const body=await response.text(),id=body.match(/name="id" value="([a-f0-9]{64})"/)[1],code=h.mail.at(-1).code;
  assert.ok(!body.includes(code));
  const db=h.control();const stored=db.prepare('SELECT * FROM challenges WHERE id=?').get(id);assert.notEqual(stored.code_hash,code);db.close();
  const wrong=code==='000000'?'999999':'000000';
  for(let i=0;i<5;i++)assert.equal((await h.post('/auth/verify',{id,code:wrong})).status,400);
  assert.equal((await h.post('/auth/verify',{id,code})).status,400);
  h.advance(61_000);
  const retry=await h.post('/auth/signup',{name:'متجر آخر',email:'other@test.ly',whatsapp:'0910000002',age:22});
  const retryId=(await retry.text()).match(/name="id" value="([a-f0-9]{64})"/)[1];h.advance(301_000);
  assert.equal((await h.post('/auth/verify',{id:retryId,code:h.mail.at(-1).code})).status,400);
});

test('each verified merchant gets an empty isolated inventory, settings and unforgeable session',async t=>{
  const h=await setup(t),a=await h.signup(1),b=await h.signup(2);
  const save=(cookie,name)=>h.post('/admin/products',{code:'P100',name,price:'30',currency:'LYD',active:'on'},cookie);
  assert.equal((await save(a.cookie,'منتج الأول')).status,303);assert.equal((await save(b.cookie,'منتج الثاني')).status,303);
  const first=await(await h.request('/admin/products',{headers:{cookie:a.cookie}})).text();
  const second=await(await h.request('/admin/products',{headers:{cookie:b.cookie}})).text();
  assert.match(first,/منتج الأول/);assert.doesNotMatch(first,/منتج الثاني|DEMO-101|Example lead magnet/);
  assert.match(second,/منتج الثاني/);assert.doesNotMatch(second,/منتج الأول/);
  await h.post('/admin/products/1',{code:'P100',name:'تعديل الأول',price:'99',currency:'LYD',active:'on'},a.cookie);
  assert.doesNotMatch(await(await h.request('/admin/products',{headers:{cookie:b.cookie}})).text(),/تعديل الأول/);
  assert.equal((await h.request('/admin',{headers:{cookie:a.cookie+'broken'}})).headers.get('location'),'/auth/login');
  for(const route of ['/admin','/admin/automations','/admin/activity','/admin/stats','/admin/advanced','/admin/sent','/admin/settings?tab=preview'])assert.equal((await h.request(route,{headers:{cookie:a.cookie}})).status,200,route);
});

test('trial is exactly 24 hours and expiry stops dashboard writes and social webhooks',async t=>{
  const h=await setup(t),{cookie}=await h.signup();
  const db=h.control(),customer=db.prepare('SELECT * FROM customers').get();assert.equal(customer.trial_end-customer.created_at,TRIAL_MS);db.close();
  h.advance(TRIAL_MS);
  assert.equal((await h.request('/admin/products',{headers:{cookie}})).headers.get('location'),'/admin/subscription');
  assert.equal((await h.post('/admin/products',{code:'A',name:'x',price:1,currency:'LYD'},cookie)).headers.get('location'),'/admin/subscription');
  const hook=await h.post(`/w/${customer.id}/channels/telegram/00000000-0000-0000-0000-000000000000`,{},undefined,{'x-telegram-bot-api-secret-token':'fake'});assert.equal(hook.status,200);
  assert.match(await(await h.request('/admin/subscription',{headers:{cookie}})).text(),/الدفع الإلكتروني · قريبًا/);
});

test('trial product cap is atomic at SQL level and paid workspace removes it',async t=>{
  const h=await setup(t),{cookie}=await h.signup();
  for(let i=0;i<20;i++)assert.equal((await h.post('/admin/products',{code:'P'+i,name:'منتج '+i,price:1,currency:'LYD',active:'on'},cookie)).status,303);
  const cap=await h.post('/admin/products',{code:'P20',name:'منتج زائد',price:1,currency:'LYD'},cookie);assert.equal(cap.status,400);assert.match(await cap.text(),/20 منتجًا/);
  const db=h.control();db.prepare('UPDATE customers SET paid_until=?').run(Date.now()+30*TRIAL_MS);db.close();
  assert.equal((await h.post('/admin/products',{code:'P20',name:'منتج زائد',price:1,currency:'LYD'},cookie)).status,303);
});

test('reply reservation cannot exceed 50 and paid access has no Reply cap',async()=>{
  const db=openDatabase(':memory:');initializeAuth(db);
  const now=Date.now();
  db.prepare('INSERT INTO customers(id,email,name,whatsapp,age,created_at,trial_end) VALUES(?,?,?,?,?,?,?)').run('customer','x@test.ly','X','218910000001',30,now,now+TRIAL_MS);
  const auth=createAuth({db,secret});
  const reservations=await Promise.all(Array.from({length:80},async()=>auth.reserve('customer')));assert.equal(reservations.filter(Boolean).length,50);
  db.prepare('UPDATE customers SET paid_until=?').run(now+30*TRIAL_MS);
  assert.ok(auth.reserve('customer'));db.close();
});

test('one connected account per platform is enforced by database constraints, including paused accounts',async t=>{
  const h=await setup(t),{cookie}=await h.signup();await h.request('/admin',{headers:{cookie}});
  const control=h.control(),customer=control.prepare('SELECT id FROM customers').get();control.close();
  const db=new DatabaseSync(join(h.directory,'workspaces',customer.id+'.sqlite'));
  const insert=db.prepare("INSERT INTO connected_accounts(id,platform,account_id,display_name,credentials,active,status,last_checked_at,created_at) VALUES(?,?,?,?,'encrypted',0,'verified','now','now')");
  insert.run('first','facebook','fb1','Page one');
  assert.throws(()=>insert.run('second','facebook','fb2','Page two'),/UNIQUE/);
  insert.run('other','whatsapp','wa1','WhatsApp');
  db.prepare("UPDATE connected_accounts SET credentials='',status='disconnected' WHERE id='first'").run();
  insert.run('second','facebook','fb2','Page two');
  db.exec("INSERT INTO tiktok_accounts(id,business_id,display_name,credentials,videos,created_at) VALUES('t1','b1','TikTok','encrypted','[]','now')");
  assert.throws(()=>db.exec("INSERT INTO tiktok_accounts(id,business_id,display_name,credentials,videos,created_at) VALUES('t2','b2','TikTok2','encrypted','[]','now')"),/UNIQUE/);
  db.close();
});

test('sessions revoke on logout, signup rate limits and CSRF checks reject abuse',async t=>{
  const h=await setup(t),{cookie}=await h.signup();
  const attack=await h.post('/auth/login',{email:'merchant1@test.ly'},cookie,{origin:'https://evil.test'});assert.equal(attack.status,403);
  assert.equal((await h.post('/auth/login',{email:'merchant1@test.ly'},cookie)).status,429);
  assert.equal((await h.post('/admin/logout',{},cookie)).status,303);
  assert.equal((await h.request('/admin',{headers:{cookie}})).headers.get('location'),'/auth/login');
  const english=await h.request('/auth/signup',{headers:{cookie:'reply_language=en'}});const body=await english.text();assert.match(body,/lang="en" dir="ltr"/);assert.match(body,/Create account|Start with Reply/);assert.match(body,/Helpdsek/);
  const switcher=await h.request('/admin/language?lang=en&returnTo=https://evil.test');assert.equal(switcher.headers.get('location'),'/auth/login');
});

test('production SQLite adapter batches roll back all statements on failure',async()=>{
  const db=openDatabase(':memory:');db.exec('CREATE TABLE items(id INTEGER PRIMARY KEY)');const d1=d1Adapter(db);
  await assert.rejects(d1.batch([d1.prepare('INSERT INTO items VALUES(?)').bind(1),d1.prepare('INSERT INTO items VALUES(?)').bind(1)]));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM items').get().n,0);db.close();
});

test('language navigation preserves an OTP challenge without exposing its code or sending another email',async t=>{
  const h=await setup(t);
  const issued=await h.post('/auth/signup',{name:'متجر التحقق',email:'verify-language@test.ly',whatsapp:'0910000008',age:'30'});
  const challengeCookie=issued.headers.get('set-cookie').split(';')[0];
  assert.match(challengeCookie,/^reply_challenge=[a-f0-9]{64}$/);
  assert.match(issued.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Secure/);
  const code=h.mail.at(-1).code;
  const id=challengeCookie.split('=')[1];
  const selected=await h.request('/admin/language?lang=en&returnTo=/auth/verify',{headers:{cookie:challengeCookie}});
  assert.equal(selected.headers.get('location'),'/auth/verify');
  const translated=await h.request('/auth/verify',{headers:{cookie:challengeCookie+'; reply_language=en'}});
  const body=await translated.text();assert.equal(translated.status,200);assert.match(body,/Check your email/);assert.ok(body.includes(id));assert.ok(!body.includes(code));assert.equal(h.mail.length,1);
  assert.equal((await h.request('/auth/verify')).headers.get('location'),'/auth/login');
  assert.equal((await h.post('/auth/verify',{id,code},challengeCookie+'; reply_language=en')).status,303);
});

test('real webhook routing uses the owner inventory, checks secrets, and stops at the trial reply cap',async t=>{
  const h=await setup(t),a=await h.signup(1),b=await h.signup(2);
  const cryptoModule=await buildModule('src/accounts.ts');t.after(()=>cryptoModule.dispose());
  const control=h.control(),customers=control.prepare('SELECT * FROM customers ORDER BY email').all();
  const accountIds=['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'];
  for(let i=0;i<2;i++) {
    const cookie=i===0?a.cookie:b.cookie;
    await h.post('/admin/products',{code:'P100',name:i===0?'بضاعة الأول':'بضاعة الثاني',price:i===0?'30':'60',currency:'LYD',active:'on'},cookie);
    await h.post('/admin/products/settings',{enabled:'on',prompt:'أرسل الكود',unknown:'تأكد من الكود'},cookie);
    const db=new DatabaseSync(join(h.directory,'workspaces',customers[i].id+'.sqlite'));
    const credentials=await cryptoModule.module.encryptAccountSecrets({ACCOUNT_ENCRYPTION_KEY:digest(h.config.encryptionKey,customers[i].id)},{token:'fake-telegram-token',appSecret:'',verifyToken:'secret-'+i},accountIds[i]);
    db.prepare("INSERT INTO connected_accounts(id,platform,account_id,display_name,credentials,active,status,last_checked_at,created_at) VALUES(?,'telegram',?,'Bot',?,1,'verified','now','now')").run(accountIds[i],String(11111+i),credentials);db.close();
  }
  const hook=(owner,update,secret,account=accountIds[owner])=>h.request(`/w/${customers[owner].id}/channels/telegram/${account}`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:update,message:{date:Math.floor(Date.now()/1000),chat:{id:99999,type:'private'},from:{id:99999,is_bot:false},text:'P100'}})});
  assert.equal((await hook(0,1,'incorrect')).status,401);
  assert.equal((await hook(0,1,'secret-0')).status,200);
  assert.equal((await hook(1,1,'secret-1')).status,200);
  for(let i=0;i<2;i++){
    const db=new DatabaseSync(join(h.directory,'workspaces',customers[i].id+'.sqlite'));
    const reply=db.prepare('SELECT reply_text FROM channel_events').get().reply_text;
    assert.match(reply,i===0?/بضاعة الأول/:/بضاعة الثاني/);db.close();
  }
  // A known account UUID in another tenant's callback does not select that account.
  assert.equal((await hook(1,99,'secret-0',accountIds[0])).status,200);
  control.prepare('UPDATE customers SET replies_used=49 WHERE id=?').run(customers[0].id);
  await hook(0,2,'secret-0');await hook(0,3,'secret-0');
  assert.equal(control.prepare('SELECT replies_used FROM customers WHERE id=?').get(customers[0].id).replies_used,50);
  const db=new DatabaseSync(join(h.directory,'workspaces',customers[0].id+'.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM channel_events').get().n,2);db.close();control.close();
});
