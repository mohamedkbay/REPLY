import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createHmac } from 'node:crypto';
import { buildWorker,buildModule,createHarness,messagePayload } from './worker-harness.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5XkAAAAASUVORK5CYII=','base64');
const token='testAccessToken1234567890123456789',secret='testMetaSecret12345678901234567890';
let built,accounts;
before(async()=>{built=await buildWorker();accounts=await buildModule('src/accounts.ts');});
after(async()=>{await built?.dispose();await accounts?.dispose();});
async function fixture(t,overrides={}){const h=await createHarness(built.worker,{ACCOUNT_ENCRYPTION_KEY:'fake-test-image-encryption-key-at-least-32',...overrides});t.after(()=>h.dispose());const cookie=await h.login();await h.postForm('/admin/products/settings',{enabled:'on',prompt:'أرسل الكود',unknown:'الكود مش موجود'},cookie);return{h,cookie};}
async function upload(h,cookie,{file=png,type='image/png',path='/admin/products',...values}={}){const form=new FormData();for(const[k,v]of Object.entries({name:'حقيبة',code:'P1',price:'120',currency:'LYD',active:'on',...values}))form.set(k,v);if(file!==null)form.set('image_file',new File([file],'product.png',{type}));return h.request(path,{method:'POST',headers:{cookie},body:form});}

test('upload stores image bytes separately, serves them publicly with correct MIME and previews the product photo',async t=>{
 const{h,cookie}=await fixture(t);assert.equal((await upload(h,cookie)).status,303);
 const product=h.query('SELECT * FROM products');assert.match(product.image_id,/^[a-f0-9]{64}$/);
 const preview=await(await h.postForm('/admin/products/preview',{text:'P1'},cookie)).json();assert.equal(preview.image.path,'/media/products/'+product.image_id);assert.match(preview.text,/120 دينار ليبي/);
 const response=await h.request(preview.image.path);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await h.request(preview.image.path,{method:'HEAD'})).status,200);
 assert.equal((await h.request(preview.image.path,{headers:{'if-none-match':'"'+product.image_id+'"'}})).status,304);
 assert.equal((await h.request(preview.image.path,{method:'POST'})).status,405);
 const page=await(await h.request('/admin/products',{headers:{cookie}})).text();assert.match(page,new RegExp('src="'+preview.image.path+'"'));
 for(const path of ['/admin/products','/admin/settings?tab=preview']){const markup=await(await h.request(path,{headers:{cookie}})).text();for(const script of markup.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(script[1]),path+' browser script must parse');}
 assert.equal(h.calls.length,0);
});

test('editing keeps or removes the photo explicitly, and duplicate products cannot leave orphan uploads',async t=>{
 const{h,cookie}=await fixture(t);await upload(h,cookie);const id=h.query('SELECT image_id FROM products').image_id;
 assert.equal((await upload(h,cookie,{file:null,path:'/admin/products/1',price:'55'})).status,303);assert.equal(h.query('SELECT image_id FROM products').image_id,id);
 assert.equal((await upload(h,cookie,{code:'P1'})).status,400);assert.equal(h.query('SELECT COUNT(*) n FROM product_images').n,1);
 assert.equal((await upload(h,cookie,{file:null,path:'/admin/products/1',remove_image:'on'})).status,303);assert.equal(h.query('SELECT image_id FROM products').image_id,null);
 const preview=await(await h.postForm('/admin/products/preview',{text:'P1'},cookie)).json();assert.equal(preview.image,null);
});

test('invalid, oversized and unauthenticated uploads cannot save photos or products',async t=>{
 const{h,cookie}=await fixture(t);
 for(const value of [{file:'<svg onload="alert(1)"></svg>',type:'image/svg+xml'},{file:'not an image',type:'image/png'},{file:Buffer.alloc(1500001),type:'image/png'}])assert.equal((await upload(h,cookie,value)).status,400);
 const form=new FormData();form.set('image_file',new File([png],'a.png',{type:'image/png'}));assert.equal((await h.request('/admin/products',{method:'POST',body:form})).status,303);
 assert.equal((await h.request('/admin/products',{method:'POST',headers:{cookie,origin:'https://other.example'},body:form})).status,403);
 assert.equal(h.query('SELECT COUNT(*) n FROM products').n,0);assert.equal(h.query('SELECT COUNT(*) n FROM product_images').n,0);
});

test('legacy Instagram code replies send one image then the current price and deduplicate the complete reply',async t=>{
 const{h,cookie}=await fixture(t);await upload(h,cookie);await h.webhook(messagePayload('image-code','P1'));await h.webhook(messagePayload('image-code','P1'));
 assert.equal(h.calls.length,2);assert.equal(h.calls[0].body.message.attachment.type,'image');assert.match(h.calls[0].body.message.attachment.payload.url,/^https:\/\/dashboard.example.test\/media\/products\/[a-f0-9]{64}$/);assert.match(h.calls[1].body.message.text,/حقيبة/);assert.match(h.calls[1].body.message.text,/120 دينار ليبي/);
 assert.equal(h.query('SELECT reply_image_id FROM message_events').reply_image_id,h.query('SELECT image_id FROM products').image_id);
 const feed=await(await h.request('/admin/sent?format=json',{headers:{cookie}})).json();assert.match(feed.rows,/sent-photo/);
});

test('unavailable products, unknown codes and test mode never send product photos',async t=>{
 const{h,cookie}=await fixture(t);await upload(h,cookie,{active:''});await h.webhook(messagePayload('off-photo','P1'));assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.message.attachment,undefined);assert.match(h.calls[0].body.message.text,/غير متوفر/);
 const off=await(await h.postForm('/admin/settings/preview',{text:'P1'},cookie)).json();assert.equal(off.image,null);
 const unknown=await(await h.postForm('/admin/settings/preview',{text:'P999'},cookie)).json();assert.equal(unknown.image,null);
 h.env.DRY_RUN='true';await h.postForm('/admin/products/1/availability',{active:'1'},cookie);await h.webhook(messagePayload('dry-photo','P1'));assert.equal(h.calls.length,1);
});

async function connect(h,cookie,platform){h.setResponder(call=>Response.json(platform==='telegram'?{ok:true,result:{id:12345,is_bot:true,username:'test_bot'}}:platform==='instagram'?{user_id:'12345',username:'test_ig'}:platform==='facebook'?{id:'12345',name:'Test Page',category:'Shopping'}:{id:'12345',display_phone_number:'+218900000000',verified_name:'Test Shop'}));assert.equal((await h.postForm('/admin/connections',{platform,account_id:'12345',token:platform==='telegram'?'12345:abcdefghijklmnopqrstuvwxyz':token,app_secret:secret},cookie)).status,303);return h.query('SELECT * FROM connected_accounts');}
async function incoming(h,platform,account,event='image1',text='P1'){
 const data=platform==='telegram'?{update_id:Number(event)||1,message:{date:Math.floor(Date.now()/1000),chat:{id:998877,type:'private'},from:{is_bot:false},text}}:platform==='whatsapp'?{object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'12345'},messages:[{id:event,from:'998877',timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:text}}]}}]}]}:{object:platform==='instagram'?'instagram':'page',entry:[{id:'12345',messaging:[{sender:{id:'998877'},recipient:{id:'12345'},timestamp:Date.now(),message:{mid:event,text}}]}]};
 const body=JSON.stringify(data),credentials=await accounts.module.accountSecrets(h.env,account.id);return h.request('/channels/'+platform+(platform==='telegram'?'/'+account.id:''),{method:'POST',headers:platform==='telegram'?{'x-telegram-bot-api-secret-token':credentials.verifyToken}:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')},body});
}
for(const platform of ['instagram','facebook','whatsapp','telegram'])test(`${platform} connected code reply uses a native photo payload with name and price`,async t=>{
 const{h,cookie}=await fixture(t);await upload(h,cookie);const account=await connect(h,cookie,platform);h.calls.length=0;await incoming(h,platform,account);await incoming(h,platform,account);
 assert.equal(h.calls.length,['instagram','facebook'].includes(platform)?2:1);const body=h.calls[0].body;
 if(platform==='telegram'){assert.ok(h.calls[0].url.pathname.endsWith('/sendPhoto'));assert.match(body.photo,/\/media\/products\//);assert.match(body.caption,/120 دينار ليبي/);}
 else if(platform==='whatsapp'){assert.equal(body.type,'image');assert.match(body.image.link,/\/media\/products\//);assert.match(body.image.caption,/120 دينار ليبي/);}
 else{assert.equal(body.message.attachment.type,'image');assert.match(h.calls[1].body.message.text,/120 دينار ليبي/);}
 assert.equal(h.query('SELECT status FROM channel_events').status,'sent');assert.equal(h.query('SELECT reply_image_id FROM channel_events').reply_image_id,h.query('SELECT image_id FROM products').image_id);
});

test('a failed photo falls back to one text reply, records the warning, and avoids duplicate sends',async t=>{
 const{h,cookie}=await fixture(t);await upload(h,cookie);const account=await connect(h,cookie,'whatsapp');h.calls.length=0;h.setResponder(call=>call.body?.type==='image'?new Response('unavailable',{status:400}):Response.json({messages:[{id:'out'}]}));
 await incoming(h,'whatsapp',account);await incoming(h,'whatsapp',account);assert.equal(h.calls.length,2);assert.equal(h.calls[1].body.type,'text');assert.match(h.calls[1].body.text.body,/120 دينار ليبي/);const event=h.query('SELECT * FROM channel_events');assert.equal(event.status,'sent');assert.equal(event.reply_image_id,null);assert.match(event.error,/أُرسل النص فقط/);
});
