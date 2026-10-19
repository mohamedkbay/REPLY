import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, after, test } from 'node:test';
import { buildModule, buildWorker, createHarness } from './worker-harness.mjs';

let built, bodyModule, headersModule;
before(async()=>{
  built=await buildWorker();
  bodyModule=await buildModule('src/request-body.ts');
  headersModule=await buildModule('src/security-headers.ts');
});
after(async()=>{await built?.dispose();await bodyModule?.dispose();await headersModule?.dispose();});

function streamBody(total) {
  let read=0,cancelled=false;
  return {
    stream:new ReadableStream({
      pull(controller){if(read===total){controller.close();return;}const size=Math.min(65536,total-read);read+=size;controller.enqueue(new Uint8Array(size));},
      cancel(){cancelled=true;}
    },{highWaterMark:0}),
    state:()=>({read,cancelled})
  };
}

for(const path of ['/webhook','/channels/telegram/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']) {
  test(`${path} cancels oversized streams early with missing or misleading lengths`,async t=>{
    const h=await createHarness(built.worker);t.after(()=>h.dispose());
    for(const length of [null,'10',String(2*1024*1024)]) {
      const body=streamBody(2*1024*1024);
      const response=await h.request(path,{method:'POST',headers:length?{'content-length':length}:{},body:body.stream,duplex:'half'});
      assert.equal(response.status,413);
      assert.ok(body.state().cancelled);
      assert.ok(body.state().read<=1024*1024+65536,'Stop after the first chunk crossing the cap');
      if(length===String(2*1024*1024))assert.equal(body.state().read,0);
      assert.equal(h.calls.length,0);
    }
  });
}

test('bounded reader preserves exact signed bytes at the limit across arbitrary chunk boundaries',async()=>{
  const {readWebhookBody,MAX_WEBHOOK_BYTES}=bodyModule.module;
  const input=Uint8Array.from({length:MAX_WEBHOOK_BYTES},(_,i)=>i%256);let offset=0;
  const stream=new ReadableStream({pull(controller){if(offset===input.length){controller.close();return;}const next=Math.min(offset+997,input.length);controller.enqueue(input.slice(offset,next));offset=next;}});
  const result=await readWebhookBody(new Request('https://reply.test/webhook',{method:'POST',body:stream,duplex:'half'}));
  assert.deepEqual(new Uint8Array(result),input);
});

export function assertHtmlPolicy(response, markup) {
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  const policy=response.headers.get('content-security-policy');assert.ok(policy);
  assert.match(policy,/frame-ancestors 'none'/);assert.match(policy,/script-src-attr 'none'/);
  const scripts=policy.split(';').find(d=>d.trim().startsWith('script-src '));
  assert.ok(!scripts.includes('unsafe-inline'));assert.ok(!scripts.includes('unsafe-eval'));
  for(const [,attributes,source] of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if(/\bsrc=|\btype="application\/json"/.test(attributes))continue;
    const hash=createHash('sha256').update(source).digest('base64');
    assert.ok(scripts.includes(`'sha256-${hash}'`),'A rendered executable script must have an approved static hash');
  }
}

test('every Worker dashboard page permits its real scripts in Arabic and English while denying framing',async t=>{
  const h=await createHarness(built.worker);t.after(()=>h.dispose());const cookie=await h.login();
  for(const language of ['ar','en'])for(const path of ['/admin','/admin/automations','/admin/activity','/admin/stats','/admin/advanced','/admin/products','/admin/sent','/admin/settings?tab=accounts','/admin/settings?tab=replies','/admin/settings?tab=preview']) {
    const response=await h.request(path,{headers:{cookie:cookie+'; reply_language='+language}});
    assert.equal(response.status,200,path);assertHtmlPolicy(response,await response.text());
  }
});

test('an untrusted script reflected in HTML is never added to the CSP hash allowlist',async()=>{
  const source='window.untrustedAuditScript = true;';
  const response=await headersModule.module.secureHtmlResponse(new Response('<script>'+source+'</script>',{headers:{'content-type':'text/html'}}));
  const hash=createHash('sha256').update(source).digest('base64');
  assert.ok(!response.headers.get('content-security-policy').includes(hash));
});
