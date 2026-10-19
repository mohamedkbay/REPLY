import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {buildWorker,buildModule,createHarness,createRule} from './worker-harness.mjs';
const token='fakeTikTokAccessToken123456789',video='1234567890123456789';
let built,tiktok;
before(async()=>{built=await buildWorker();tiktok=await buildModule('src/tiktok.ts');});after(async()=>{await built?.dispose();await tiktok?.dispose();});
async function fixture(t,overrides={}){const h=await createHarness(built.worker,{ACCOUNT_ENCRYPTION_KEY:'fake-tiktok-encryption-key-at-least-32',...overrides});t.after(()=>h.dispose());const cookie=await h.login();await h.postForm('/admin/products/settings',{enabled:'on',prompt:'أرسل كود المنتج ونقولك سعره',unknown:'الكود مش موجود تأكد منه'},cookie);await h.postForm('/admin/products',{name:'حقيبة',code:'P1',price:'120',active:'on'},cookie);return{h,cookie};}
function responder(h,comments=[]){h.setResponder(call=>Response.json({code:0,data:call.url.pathname.endsWith('/business/get/')?{username:'test_tiktok',display_name:'Test Shop'}:call.url.pathname.endsWith('/reply/create/')?{comment_id:'9000001'}:{comments,has_more:false,cursor:30}}));}
async function connect(h,cookie){responder(h);const r=await h.postForm('/admin/tiktok',{business_id:'business_test_12345',token,videos:'https://www.tiktok.com/@test/video/'+video},cookie);assert.equal(r.status,303);const account=h.query('SELECT * FROM tiktok_accounts');return account;}
function comment(id='8000001',changes={}){return{comment_id:id,video_id:video,text:'P1',status:'PUBLIC',owner:false,create_time:String(Math.floor(Date.now()/1000)),username:'customer',...changes};}
async function activate(h,cookie,account){await h.postForm('/admin/tiktok/'+account.id+'/enable',{},cookie);await h.db.prepare('UPDATE tiktok_accounts SET activated_at=? WHERE id=?').bind(new Date(Date.now()-10000).toISOString(),account.id).run();return(await tiktok.module.getTikTokAccounts(h.db))[0];}

test('TikTok setup verifies profile and video reads, encrypts token, and starts with automatic posting disabled',async t=>{
 const{h,cookie}=await fixture(t);const account=await connect(h,cookie);assert.equal(account.active,0);assert.match(account.credentials,/^v1\./);assert.doesNotMatch(account.credentials,new RegExp(token));assert.equal(h.calls.length,2);assert.equal(h.calls[0].url.host,'business-api.tiktok.com');assert.equal(h.calls[0].headers.get('access-token'),token);
 const page=await(await h.request('/admin/settings',{headers:{cookie}})).text();assert.doesNotMatch(page,new RegExp(token));assert.match(page,/تم التحقق من القراءة/);
});

test('TikTok authorization and ownership errors cannot produce a connected account or leak tokens',async t=>{
 const{h,cookie}=await fixture(t);h.setResponder(()=>Response.json({code:401,message:token}));const r=await h.postForm('/admin/tiktok',{business_id:'business_test_12345',token,videos:video},cookie);assert.equal(r.status,400);assert.doesNotMatch(await r.text(),new RegExp(token));assert.equal(h.query('SELECT COUNT(*) n FROM tiktok_accounts').n,0);
 assert.throws(()=>tiktok.module.parseTikTokVideos('https://evil.example/video/'+video));assert.throws(()=>tiktok.module.parseTikTokVideos('https://vm.tiktok.com/short'));
 const count=h.calls.length;await assert.rejects(tiktok.module.tiktokRequest('https://evil.example/',token));assert.equal(h.calls.length,count);
});

test('TikTok automatically replies to a new owned-video comment once and uses the current catalog price',async t=>{
 const{h,cookie}=await fixture(t);let account=await connect(h,cookie);account=await activate(h,cookie,account);responder(h,[comment()]);h.calls.length=0;
 await tiktok.module.pollTikTokAccount(h.env,account);await tiktok.module.pollTikTokAccount(h.env,account);
 const sends=h.calls.filter(call=>call.method==='POST');assert.equal(sends.length,1);assert.equal(sends[0].url.pathname,'/open_api/v1.3/business/comment/reply/create/');assert.equal(sends[0].body.comment_id,'8000001');assert.equal(sends[0].body.business_id,account.business_id);assert.match(sends[0].body.text,/120 دينار ليبي/);assert.ok(sends[0].body.text.length<=150);assert.equal(h.query('SELECT status FROM tiktok_comment_events').status,'sent');
 const activity=await(await h.request('/admin/activity',{headers:{cookie}})).text();assert.match(activity,/تعليقات TikTok/);assert.match(activity,/120 دينار ليبي/);
});

test('TikTok ignores old, owner, hidden, nested, previously answered and other-video comments',async t=>{
 const{h,cookie}=await fixture(t);let account=await connect(h,cookie);account=await activate(h,cookie,account);
 responder(h,[comment('8000001',{owner:true}),comment('8000002',{status:'HIDDEN'}),comment('8000003',{parent_comment_id:'11111'}),comment('8000004',{create_time:'1681790814'}),comment('8000005',{video_id:'5555555'}),comment('8000006',{reply_list:[{owner:true}]}),comment('8000007',{create_time:'bad'})]);h.calls.length=0;await tiktok.module.pollTikTokAccount(h.env,account);assert.equal(h.calls.filter(call=>call.method==='POST').length,0);assert.equal(h.query('SELECT COUNT(*) n FROM tiktok_comment_events').n,0);
});

test('TikTok test mode previews replies without posting and paused accounts stop making API calls',async t=>{
 const{h,cookie}=await fixture(t,{DRY_RUN:'true'});let account=await connect(h,cookie);account=await activate(h,cookie,account);responder(h,[comment()]);h.calls.length=0;await tiktok.module.pollTikTokAccount(h.env,account);assert.equal(h.calls.filter(call=>call.method==='POST').length,0);assert.equal(h.query('SELECT status FROM tiktok_comment_events').status,'test');
 await h.postForm('/admin/tiktok/'+account.id+'/pause',{},cookie);account=(await tiktok.module.getTikTokAccounts(h.db))[0];h.calls.length=0;await tiktok.module.pollTikTokAccount(h.env,account);assert.equal(h.calls.length,0);
});

test('TikTok comment replies honor availability, unknown codes and public automation text without leaking DM text',async t=>{
 const{h,cookie}=await fixture(t);assert.match((await tiktok.module.resolveTikTokReply(h.db,'بكم')).text,/أرسل كود المنتج/);assert.equal((await h.postForm('/admin/tiktok/preview',{text:'P1'})).status,401);const preview=await(await h.postForm('/admin/tiktok/preview',{text:'P1'},cookie)).json();assert.match(preview.text,/120 دينار ليبي/);assert.equal(preview.image,null);assert.match((await tiktok.module.resolveTikTokReply(h.db,'P999')).text,/مش موجود/);
 await h.postForm('/admin/products/1/availability',{active:'0'},cookie);const off=await tiktok.module.resolveTikTokReply(h.db,'P1');assert.match(off.text,/غير متوفر/);assert.doesNotMatch(off.text,/120/);
 await createRule(h,cookie,{label:'Public FAQ',keywords:'كتاب',channels:'comments',reply_text:'PRIVATE-INSTRUCTIONS',public_reply_text:'رد علني مناسب'});assert.equal((await tiktok.module.resolveTikTokReply(h.db,'كتاب')).text,'رد علني مناسب');
});

test('TikTok mutations require admin and same-origin forms, and disconnect erases credentials',async t=>{
 const{h,cookie}=await fixture(t);assert.equal((await h.postForm('/admin/tiktok',{business_id:'x',token,videos:video})).status,303);assert.equal((await h.request('/admin/tiktok',{method:'POST',headers:{cookie,origin:'https://evil.example'},body:new URLSearchParams()})).status,403);
 const account=await connect(h,cookie);await h.postForm('/admin/tiktok/'+account.id+'/disconnect',{},cookie);assert.equal(h.query('SELECT credentials FROM tiktok_accounts').credentials,'');assert.equal((await tiktok.module.getTikTokAccounts(h.db)).length,0);
});

test('TikTok API failures redact errors, log one failure and do not retry an uncertain public post',async t=>{
 const{h,cookie}=await fixture(t);let account=await connect(h,cookie);account=await activate(h,cookie,account);h.setResponder(call=>Response.json(call.method==='POST'?{code:401,message:token}:{code:0,data:{comments:[comment()]}}));await tiktok.module.pollTikTokAccount(h.env,account);await tiktok.module.pollTikTokAccount(h.env,account);assert.equal(h.calls.filter(call=>call.method==='POST').length,1);const event=h.query('SELECT * FROM tiktok_comment_events');assert.equal(event.status,'error');assert.doesNotMatch(event.error,new RegExp(token));assert.ok(h.query('SELECT last_error FROM tiktok_accounts').last_error);assert.doesNotMatch(h.query('SELECT last_error FROM tiktok_accounts').last_error,new RegExp(token));
});


test('the minute cron runs the TikTok responder without running daily Instagram renewal',async t=>{
 const{h,cookie}=await fixture(t);let account=await connect(h,cookie);account=await activate(h,cookie,account);responder(h,[comment()]);h.calls.length=0;
 await built.worker.scheduled({cron:'* * * * *'},h.env);
 assert.equal(h.calls.filter(call=>call.method==='POST').length,1);assert.ok(h.calls.every(call=>call.url.hostname==='business-api.tiktok.com'));
});
