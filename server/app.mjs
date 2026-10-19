import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { createHmac } from 'node:crypto';
import { openDatabase, openWorkspace } from './database.mjs';
import { createAuth, initializeAuth, cookies, cookieName, digest, normalizeEmail, parseProfile, resendMailer, SESSION_MS } from './auth.mjs';
import { accessPage, planPage, privacyPage, language } from './pages.mjs';
import { worker } from '../dist/saas.mjs';

const redirect=(location,headers={})=>new Response(null,{status:303,headers:{location,'cache-control':'no-store',...headers}});
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'same-origin','x-content-type-options':'nosniff'}});
const plain=(message,status)=>new Response(message,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const mime={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'};

export async function createApplication(config) {
  const origin=new URL(config.origin).origin;
  const originUrl=new URL(origin);
  const local=['localhost','127.0.0.1','[::1]'].includes(originUrl.hostname);
  if (!local && originUrl.protocol!=='https:') throw new Error('A public HTTPS origin is required');
  if (!config.secret || config.secret.length<32 || !config.encryptionKey || config.encryptionKey.length<32) throw new Error('Two separate secrets of at least 32 characters are required');
  if (config.secret===config.encryptionKey) throw new Error('Use separate auth and account encryption secrets');
  if ([config.secret,config.encryptionKey].some(value=>/REPLACE_WITH|example|change.?me/i.test(value))) throw new Error('Replace example secrets before starting');
  const directory=resolve(config.directory);
  await mkdir(directory,{recursive:true,mode:0o700});
  const db=openDatabase(join(directory,'control.sqlite'));
  initializeAuth(db);
  const auth=createAuth({db,secret:config.secret,sendMail:config.sendMail ?? resendMailer(config.resendKey,config.emailFrom),now:config.now});
  const spaces=new Map();
  const migrations=resolve(config.migrations ?? 'migrations'),publicRoot=resolve(config.publicRoot ?? 'public');
  const emailReady=Boolean(config.sendMail || config.resendKey && config.emailFrom);
  let pollRunning=false;
  const secret=config.secret;
  const setSession=(token,age=SESSION_MS/1000)=>`${cookieName}=${token}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${local?'':'; Secure'}`;
  function workspace(customer) {
    if (!spaces.has(customer.id)) spaces.set(customer.id,openWorkspace(join(directory,'workspaces'),customer.id,migrations));
    const space=spaces.get(customer.id);
    spaces.delete(customer.id);spaces.set(customer.id,space);
    space.sqlite.prepare('UPDATE reply_entitlement SET paid=? WHERE id=1').run(auth.state(customer).paid?1:0);
    return space;
  }
  async function inWorkspace(customer,operation) {
    const space=workspace(customer);space.users=(space.users??0)+1;
    try{return await operation();}
    finally{
      space.users--;
      for(const[id,candidate]of spaces){
        if(spaces.size<=32)break;
        if(!candidate.users){candidate.sqlite.close();spaces.delete(id);}
      }
    }
  }
  function environment(customer) {
    const {DB}=workspace(customer);
    return {DB,SAAS_MODE:true,ADMIN_TOKEN:digest(secret,'admin:'+customer.id),ACCOUNT_ENCRYPTION_KEY:digest(config.encryptionKey,customer.id),WEBHOOK_VERIFY_TOKEN:digest(secret,'webhook:'+customer.id),INSTAGRAM_ACCESS_TOKEN:'',IG_USER_ID:'',GRAPH_API_BASE:'https://graph.instagram.com/v25.0',KEYWORD:'',PRIVATE_REPLY_TEXT:'',DRY_RUN:config.dryRun===false?'false':'true',SINGLE_PLATFORM_ACCOUNT:true,WEBHOOK_BASE_URL:`${origin}/w/${customer.id}`,RESERVE_REPLY:()=>auth.reserve(customer.id)};
  }
  function internalCookie(customer) {
    const expires=String(Math.floor(Date.now()/1000)+60);
    return `ig_dm_admin=${expires}.${createHmac('sha256',digest(secret,'admin:'+customer.id)).update(expires).digest('hex')}`;
  }
  async function adminRequest(request,customer,path) {
    return inWorkspace(customer,async()=>{
    const headers=new Headers(request.headers);
    // Customer-controlled admin cookies can never authenticate another workspace.
    headers.set('cookie',`reply_language=${language(request)}; ${internalCookie(customer)}`);
    const requestUrl=new URL(request.url);requestUrl.pathname=path;
    const forwarded=new Request(requestUrl,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})});
    const pending=[];
    const response=await worker.fetch(forwarded,environment(customer),{waitUntil:promise=>pending.push(promise),passThroughOnException(){}});
    await Promise.allSettled(pending);
    if(request.method==='POST' && path.startsWith('/admin/products')) {
      const images=workspace(customer).sqlite.prepare('SELECT id FROM product_images').all();
      const save=db.prepare('INSERT OR IGNORE INTO media_routes(image_id,customer_id) VALUES(?,?)');
      for(const image of images) save.run(image.id,customer.id);
    }
    if ((response.headers.get('content-type')??'').includes('text/html')) {
      const body=(await response.text()).replace('<div class="menu-bottom">','<div class="menu-bottom"><a href="/admin/subscription">'+(language(request)==='en'?'My account and subscription':'حسابي والاشتراك')+'</a>');
      const out=new Headers(response.headers);out.delete('content-length');
      return new Response(body,{status:response.status,headers:out});
    }
    return response;
    });
  }
  async function handle(request,{ip='unknown'}={}) {
    const url=new URL(request.url),path=url.pathname,lang=language(request);
    if (request.method==='POST' && (request.headers.get('origin')!==origin || request.headers.get('sec-fetch-site')==='cross-site') && !path.startsWith('/w/')) return plain('Cross-site request rejected',403);
    if (request.method==='GET' && path==='/healthz') return Response.json({ok:db.prepare('SELECT 1 AS ok').get().ok===1,service:'Reply'});
    if (request.method==='GET' && path==='/admin/language') {
      const value=url.searchParams.get('lang')==='en'?'en':'ar';
      let next=auth.user(request)?'/admin':'/auth/login';
      try {const target=new URL(url.searchParams.get('returnTo')??next,origin);if(target.origin===origin && /^\/(admin|auth)(?:\/|$)/.test(target.pathname))next=target.pathname+target.search;}catch{}
      return redirect(next,{'set-cookie':`reply_language=${value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${local?'':'; Secure'}`});
    }
    if (request.method==='GET' && path==='/auth/privacy') return html(privacyPage(lang));
    if (request.method==='GET' && path==='/auth/verify') {
      const id=cookies(request).reply_challenge;
      return /^[a-f0-9]{64}$/.test(id??'')?html(accessPage(lang,{mode:'verify',emailReady,id})):redirect('/auth/login');
    }
    if (['/auth/login','/auth/signup','/admin/login'].includes(path)) {
      const signup=path==='/auth/signup';
      if (request.method==='GET') return auth.user(request)?redirect('/admin/subscription'):html(accessPage(lang,{mode:signup?'signup':'login',emailReady}));
      if (request.method!=='POST')return plain('Method not allowed',405);
      const form=await request.formData();
      const profile=signup?parseProfile(form):null;
      if (signup&&!profile) return html(accessPage(lang,{mode:'signup',emailReady,error:lang==='en'?'Complete all fields. Use a Libyan WhatsApp number and age 18 or older.':'كمّل بياناتك. اكتب رقم واتساب ليبي وعمرًا من 18 سنة.'}),400);
      const result=await auth.issue(normalizeEmail(form.get('email')),profile,ip);
      const response=html(accessPage(lang,{mode:result.error?(signup?'signup':'login'):'verify',emailReady,id:result.id,error:lang==='en'&&result.error?'Unable to send a code. Check your details, wait a minute, or contact Helpdsek.':result.error}),result.status??200);
      if(result.id)response.headers.set('set-cookie',`reply_challenge=${result.id}; Path=/auth; Max-Age=300; HttpOnly; SameSite=Lax${local?'':'; Secure'}`);
      return response;
    }
    if (path==='/auth/verify' && request.method==='POST') {
      const form=await request.formData(),id=String(form.get('id')??'');
      const verified=auth.verify(id,String(form.get('code')??'').trim(),ip);
      if(!verified)return html(accessPage(lang,{mode:'verify',emailReady,id,error:lang==='en'?'Code invalid or expired. After 5 attempts, request a new code.':'الرمز غير صحيح أو انتهى. بعد 5 محاولات اطلب رمزًا جديدًا.'}),400);
      return redirect('/admin/subscription',{'set-cookie':setSession(verified.token)});
    }
    if (path==='/admin/logout' && request.method==='POST') {auth.logout(request);return redirect('/auth/login',{'set-cookie':setSession('',0)});}
    const hook=path.match(/^\/w\/([a-f0-9-]{36})(\/(?:channels\/(?:instagram|facebook|whatsapp|telegram)(?:\/[a-f0-9-]{36})?|webhook))$/);
    if (hook) {
      const customer=db.prepare('SELECT * FROM customers WHERE id=?').get(hook[1]);
      if(!customer)return plain('Not found',404);
      // Stop all automation at expiry, even when webhooks continue arriving.
      if(request.method!=='GET'&&!auth.state(customer).active)return plain('OK',200);
      const target=new URL(hook[2]+url.search,origin);
      const forwarded=new Request(target,{method:request.method,headers:request.headers,...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})});
      const pending=[];
      return inWorkspace(customer,async()=>{
        const response=await worker.fetch(forwarded,environment(customer),{waitUntil:promise=>pending.push(promise),passThroughOnException(){}});
        await Promise.allSettled(pending);return response;
      });
    }
    if (/^\/media\/products\/[a-f0-9]{64}$/.test(path)) {
      const row=db.prepare('SELECT c.* FROM customers c JOIN media_routes m ON m.customer_id=c.id WHERE m.image_id=?').get(path.split('/').at(-1));
      return row?inWorkspace(row,()=>worker.fetch(request,environment(row),{waitUntil(){},passThroughOnException(){}})):plain('Not found',404);
    }
    if (path==='/' || path.startsWith('/admin')) {
      const customer=auth.user(request);
      if(!customer)return redirect('/auth/login');
      if(path==='/admin/subscription')return html(planPage(lang,customer,auth.state(customer)));
      if(!auth.state(customer).active)return redirect('/admin/subscription');
      return adminRequest(request,customer,path==='/'?'/admin':path);
    }
    if(['GET','HEAD'].includes(request.method)) {
      let decoded;try{decoded=decodeURIComponent(path);}catch{return plain('Not found',404);}
      const file=resolve(publicRoot,'.'+decoded);
      if(!file.startsWith(publicRoot+sep) || !mime[extname(file)])return plain('Not found',404);
      try {if(!(await stat(file)).isFile())return plain('Not found',404);return new Response(request.method==='HEAD'?null:await readFile(file),{headers:{'content-type':mime[extname(file)],'cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}});}catch{return plain('Not found',404);}
    }
    return plain('Not found',404);
  }
  async function scheduled() {
    if(pollRunning)return;pollRunning=true;
    try {auth.cleanup();for(const customer of db.prepare('SELECT * FROM customers').all()) {
      if(config.dryRun===false && auth.state(customer).active)await inWorkspace(customer,()=>worker.scheduled({cron:'* * * * *'},environment(customer)));
    }} finally{pollRunning=false;}
  }
  return {handle,scheduled,close(){for(const space of spaces.values())space.sqlite.close();db.close();}};
}
