import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { buildWorker, createHarness } from './worker-harness.mjs';
let built;
before(async () => { built = await buildWorker(); });
after(async () => { await built?.dispose(); });
async function fixture(t) {
  const h = await createHarness(built.worker, { DRY_RUN: 'true' });
  t.after(() => h.dispose());
  return h;
}

test('Arabic is the default, independent of browser language; login offers both languages', async t => {
  const h = await fixture(t);
  const response = await h.request('/admin', {headers:{'accept-language':'en-US'}});
  const body = await response.text();
  assert.equal(response.headers.get('content-language'),'ar');
  assert.match(body, /lang="ar" dir="rtl"/);
  assert.match(body, /data-language="ar" aria-current="true"/);
  assert.match(body, /class="access-language"/);
  assert.match(body, /reply-symbol-ink.svg/);
});

test('language selection persists in a preference cookie and cannot redirect off-site', async t => {
  const h = await fixture(t);
  for (const target of ['https://attacker.test/path','//attacker.test/admin','/webhook','/admin-evil','http://[invalid']) {
    const response=await h.request('/admin/language?lang=en&returnTo='+encodeURIComponent(target));
    assert.equal(response.status,303);
    assert.equal(response.headers.get('location'),'/admin');
    assert.match(response.headers.get('set-cookie'),/reply_language=en; Path=\/; Max-Age=31536000; SameSite=Lax; HttpOnly/);
  }
  const response=await h.request('/admin/language?lang=ar&returnTo='+encodeURIComponent('/admin/settings?tab=replies'));
  assert.equal(response.headers.get('location'),'/admin/settings?tab=replies');
  assert.match(response.headers.get('set-cookie'),/reply_language=ar/);
});

test('English login is rendered by the server with LTR direction and translated validation', async t => {
  const h=await fixture(t);
  const response=await h.request('/admin?error=1',{headers:{cookie:'reply_language=en'}});
  const body=await response.text();
  assert.match(body,/lang="en" dir="ltr"/);
  assert.equal(response.headers.get('content-language'),'en');
  assert.match(body,/<h1>Sign in<\/h1>/);
  assert.match(body,/Incorrect access code\./);
  assert.match(body,/Admin access code/);
  assert.match(body,/data-language="en" aria-current="true"/);
});

test('English navigation covers every admin page while keeping product names and saved replies intact',async t=>{
  const h=await fixture(t);const auth=await h.login();const cookie=auth+'; reply_language=en';
  await h.postForm('/admin/products',{code:'P100',name:'المخزن',price:'120',currency:'LYD',active:'on'},auth);
  await h.postForm('/admin/products/settings',{enabled:'on',prompt:'نص محفوظ لا يتغير',unknown:'الكود غير موجود'},auth);
  for(const path of ['/admin','/admin/products','/admin/sent','/admin/automations','/admin/activity','/admin/stats','/admin/advanced','/admin/settings?tab=accounts','/admin/settings?tab=replies','/admin/settings?tab=preview']){
    const response=await h.request(path,{headers:{cookie}});const body=await response.text();
    assert.equal(response.status,200,path);assert.match(body,/lang="en" dir="ltr"/,path);
    assert.match(body,/>Overview</,path);assert.match(body,/>Inventory</,path);
    if(path==='/admin/products'){assert.match(body,/<strong dir="auto" translate="no">المخزن<\/strong>/);assert.match(body,/aria-label="Availability المخزن"/);}
    if(path==='/admin/settings?tab=replies')assert.match(body,/>نص محفوظ لا يتغير<\/textarea>/);
  }
  const preview=await h.postForm('/admin/products/preview',{text:'P100'},cookie);
  const reply=await preview.json();assert.match(reply.text,/المخزن/);assert.match(reply.text,/السعر/);
  const failure=await h.postForm('/admin/products',{code:'P200',name:'x',price:'-1',currency:'LYD'},cookie);
  assert.equal(failure.status,400);assert.match(await failure.text(),/Enter a valid price/);
});

test('navigation uses the same preloaded Cairo faces and never requests a visible late font swap',async t=>{
  const h=await fixture(t);const cookie=await h.login();
  for(const path of ['/admin','/admin/products','/admin/sent','/admin/settings']){
    const body=await (await h.request(path,{headers:{cookie}})).text();
    for(const weight of [400,500,600,700])assert.match(body,new RegExp('rel="preload"[^>]*href="/fonts/cairo/cairo-'+weight+'\\.woff2"'),path);
    assert.doesNotMatch(body,/font-display:swap/,path);
    assert.match(body,/font-display:block/,path);
    assert.match(body,/<script src="\/reply-preferences\.js\?v=[0-9]+"><\/script>/,path);
    assert.ok(body.indexOf('reply-preferences.css')>body.indexOf('href="/reply-studio.css?v=5"'),path);
    assert.match(body,/data-theme-toggle/,path);
  }
});
