import { ConnectionError, decryptAccountSecrets, encryptAccountSecrets, type ConnectionEnv } from './accounts';
import { formatProductPrice, type Product } from './products';
import { resolveCustomerReply } from './smart-replies';

export type TikTokAccount = { id: string; business_id: string; display_name: string; videos: string; active: number; activated_at: string | null; last_checked_at: string | null; last_error: string | null; next_video: number; created_at: string };
const columns = 'id,business_id,display_name,videos,active,activated_at,last_checked_at,last_error,next_video,created_at';
const allowedPaths = new Set(['business/get/','business/comment/list/','business/comment/reply/create/']);
const docs = 'https://business-api.tiktok.com/portal/docs';
export const TIKTOK_DOCS = docs;

/** The API verifies ownership and permission. Passwords/cookies are never used. */
export async function tiktokRequest(path: string, token: string, params: Record<string, string> = {}, body?: Record<string, unknown>): Promise<Record<string, any>> {
  if (!allowedPaths.has(path)) throw new ConnectionError('طلب تيك توك غير مدعوم.');
  try {
    const url = new URL(`https://business-api.tiktok.com/open_api/v1.3/${path}`);
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
    const response = await fetch(url.href,{method:body?'POST':'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Access-Token':token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if (!response.ok) throw new Error();
    const reader=response.body?.getReader(); if(!reader)throw new Error();
    const parts:Uint8Array[]=[];let length=0;
    while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>256*1024){await reader.cancel();throw new Error();}parts.push(item.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    const value=JSON.parse(new TextDecoder().decode(bytes));
    if(value?.code!==0 || !value.data || typeof value.data!=='object') throw new Error();
    return value.data;
  } catch { throw new ConnectionError('تعذّر الوصول إلى TikTok Accounts API. تأكد من موافقة التطبيق، وصلاحيات التعليقات، ومعرّف الحساب ورمز الوصول.'); }
}
export function parseTikTokVideos(input: string): string[] {
  const items=input.split(/[\s,،]+/).filter(Boolean);
  const ids=items.map(value=>{
    if(/^\d{5,30}$/.test(value))return value;
    try{const url=new URL(value);if(url.protocol==='https:' && ['www.tiktok.com','tiktok.com'].includes(url.hostname))return url.pathname.match(/\/(?:video|photo)\/(\d{5,30})\/?$/)?.[1]??'';}catch{}
    return '';
  });
  if(!ids.length||ids.some(id=>!id)||new Set(ids).size>5)throw new ConnectionError('أضف من 1 إلى 5 روابط فيديوهات كاملة من حسابك، كل رابط في سطر. الروابط المختصرة غير مدعومة هنا.');
  return [...new Set(ids)];
}
export async function getTikTokAccounts(db:D1Database):Promise<TikTokAccount[]>{return(await db.prepare(`SELECT ${columns} FROM tiktok_accounts WHERE credentials != '' ORDER BY created_at DESC`).all<TikTokAccount>()).results;}
async function tokenFor(env:ConnectionEnv,id:string):Promise<string>{const row=await env.DB.prepare('SELECT credentials FROM tiktok_accounts WHERE id=?').bind(id).first<{credentials:string}>();if(!row?.credentials)throw new ConnectionError('أعد ربط حساب تيك توك.');return(await decryptAccountSecrets(env,row.credentials,`tiktok:${id}`)).token;}
function commentParams(account:TikTokAccount,video:string,cursor=0){return{business_id:account.business_id,video_id:video,status:'PUBLIC',include_replies:'true',sort_field:'create_time',sort_order:'desc',max_count:'30',cursor:String(cursor)};}
export async function connectTikTok(env:ConnectionEnv,form:FormData):Promise<void>{
  const businessId=String(form.get('business_id')??'').trim(),token=String(form.get('token')??'').trim();
  if(!/^[A-Za-z0-9._-]{5,200}$/.test(businessId)||!/^\S{10,8192}$/.test(token))throw new ConnectionError('اكتب open_id الخاص بحسابك ورمز الوصول من تطبيق TikTok API for Business.');
  const videos=parseTikTokVideos(String(form.get('videos')??''));
  const profile=await tiktokRequest('business/get/',token,{business_id:businessId,fields:JSON.stringify(['display_name','username'])});
  if(typeof profile.username!=='string'||!profile.username.trim())throw new ConnectionError('لم نتعرف على حساب تيك توك بهذه البيانات.');
  // Read each selected video's comments first; failure must not create a "connected" account.
  for(const video of videos)await tiktokRequest('business/comment/list/',token,{business_id:businessId,video_id:video,max_count:'1',status:'PUBLIC'});
  const existing=await env.DB.prepare('SELECT id FROM tiktok_accounts WHERE business_id=?').bind(businessId).first<{id:string}>();
  if(env.SINGLE_PLATFORM_ACCOUNT && await env.DB.prepare("SELECT id FROM tiktok_accounts WHERE business_id != ? AND credentials != ''").bind(businessId).first())throw new ConnectionError('يمكنك ربط حساب واحد من كل منصة. افصل الحساب الحالي أولًا.');
  const id=existing?.id??crypto.randomUUID(),now=new Date().toISOString();
  const encrypted=await encryptAccountSecrets(env,{token,appSecret:'',verifyToken:''},`tiktok:${id}`);
  await env.DB.prepare(`INSERT INTO tiktok_accounts(id,business_id,display_name,credentials,videos,created_at,last_checked_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET display_name=excluded.display_name,credentials=excluded.credentials,videos=excluded.videos,active=0,activated_at=NULL,last_error=NULL,last_checked_at=excluded.last_checked_at,next_video=0`)
    .bind(id,businessId,`@${profile.username}`,encrypted,JSON.stringify(videos),now,now).run();
}
export async function resolveTikTokReply(db:D1Database,text:string):Promise<{key:string;text:string}|null>{
  const reply=await resolveCustomerReply(db,text,false,'comments');if(!reply)return null;
  let message=reply.message.text;
  const match=reply.key.match(/^catalog:(\d+)$/);
  if(match){const product=await db.prepare('SELECT * FROM products WHERE id=?').bind(Number(match[1])).first<Product>();
    if(product?.active){const price=`السعر: ${formatProductPrice(product)} · الكود: ${product.code}`;const name=Array.from(product.name).slice(0,Math.max(0,148-Array.from(price).length-3)).join('');message=`${name}\n${price}`;}}
  return{key:reply.key,text:Array.from(message).slice(0,150).join('')};
}
function createdTime(value:unknown):number{
  if(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value)){const number=Number(value);return number<1e12?number*1000:number;}
  if(typeof value!=='string')return NaN;
  const iso=value.replace(' ','T');return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(iso)?iso:iso+'Z');
}
export async function pollTikTokAccount(env:ConnectionEnv,account:TikTokAccount):Promise<void>{
  if(!account.active||!account.activated_at)return;
  const lease=await env.DB.prepare('UPDATE tiktok_accounts SET lock_until=? WHERE id=? AND active=1 AND lock_until<?').bind(Date.now()+120000,account.id,Date.now()).run();if(!lease.meta.changes)return;
  try{
    const token=await tokenFor(env,account.id),videos=JSON.parse(account.videos) as string[];
    // Rotate the starting video on every run so a busy post cannot starve other selected posts.
    const start=account.next_video%videos.length;let answered=0, published=false;
    for(let n=0;n<videos.length;n++){
      const video=videos[(start+n)%videos.length];
      const data=await tiktokRequest('business/comment/list/',token,commentParams(account,video));
      if(!Array.isArray(data.comments))throw new ConnectionError('استجابة تعليقات تيك توك غير مكتملة. أعد الفحص.');
      // Up to 30 latest public top-level comments per selected video, as stated in the settings UI.
      for(const raw of data.comments.slice(0,30)){
        if(!raw||typeof raw!=='object'||raw.owner===true||raw.parent_comment_id||raw.status!=='PUBLIC'||String(raw.video_id)!==video||!/^\d{5,30}$/.test(String(raw.comment_id))||typeof raw.text!=='string'||raw.text.length>10000)continue;
        const time=createdTime(raw.create_time);if(!Number.isFinite(time)||time<Date.parse(account.activated_at)||time<Date.now()-86400000||time>Date.now()+300000)continue;
        if(Array.isArray(raw.reply_list)&&raw.reply_list.some((item:any)=>item?.owner===true))continue;
        if(await env.DB.prepare('SELECT 1 FROM tiktok_comment_events WHERE account_id=? AND comment_id=?').bind(account.id,String(raw.comment_id)).first())continue;
        const reply=await resolveTikTokReply(env.DB,raw.text);
        const inserted=await env.DB.prepare("INSERT OR IGNORE INTO tiktok_comment_events(account_id,comment_id,video_id,username,text,reply_text,reply_key,status,received_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(account.id,String(raw.comment_id),video,typeof raw.username==='string'?raw.username.slice(0,100):null,raw.text,reply?.text??null,reply?.key??null,reply?'processing':'ignored',new Date().toISOString()).run();
        if(!inserted.meta.changes||!reply)continue;
        if(env.RESERVE_REPLY && !env.RESERVE_REPLY())return;
        try{
          let status='test';
          if(String(env.DRY_RUN??'true').toLowerCase()==='false'){
            const enabled=await env.DB.prepare('SELECT active FROM tiktok_accounts WHERE id=?').bind(account.id).first<{active:number}>();if(!enabled?.active) return;
            await tiktokRequest('business/comment/reply/create/',token,{}, {business_id:account.business_id,video_id:video,comment_id:String(raw.comment_id),text:reply.text});status='sent';published=true;
          }
          await env.DB.prepare('UPDATE tiktok_comment_events SET status=? WHERE account_id=? AND comment_id=?').bind(status,account.id,String(raw.comment_id)).run();
        }catch{await env.DB.prepare("UPDATE tiktok_comment_events SET status='error',error=? WHERE account_id=? AND comment_id=?").bind('تعذّر نشر الرد. تحقق من صلاحية الرد على التعليقات لدى تيك توك.',account.id,String(raw.comment_id)).run();throw new ConnectionError('تعذّر نشر رد تيك توك. راجع صلاحيات التعليقات ورمز الوصول.');}
        if(++answered>=10)break;
      }
      if(answered>=10)break;
    }
    await env.DB.prepare('UPDATE tiktok_accounts SET last_checked_at=?,last_error=CASE WHEN ?=1 OR NOT EXISTS(SELECT 1 FROM tiktok_comment_events WHERE account_id=? AND status=\'error\') THEN NULL ELSE last_error END,next_video=? WHERE id=?').bind(new Date().toISOString(),published?1:0,account.id,(start+1)%videos.length,account.id).run();
  }catch(error){await env.DB.prepare('UPDATE tiktok_accounts SET last_checked_at=?,last_error=? WHERE id=?').bind(new Date().toISOString(),error instanceof ConnectionError?error.message:'تعذّر فحص تعليقات تيك توك.',account.id).run();}
  finally{await env.DB.prepare('UPDATE tiktok_accounts SET lock_until=0 WHERE id=?').bind(account.id).run();}
}
export async function pollTikTokAccounts(env:ConnectionEnv):Promise<void>{for(const account of await getTikTokAccounts(env.DB))if(account.active)await pollTikTokAccount(env,account);}
export type TikTokEvent={display_name:string;username:string|null;text:string;reply_text:string|null;status:string;error:string|null;received_at:string};
export async function recentTikTokEvents(db:D1Database):Promise<TikTokEvent[]>{return(await db.prepare('SELECT a.display_name,e.username,e.text,e.reply_text,e.status,e.error,e.received_at FROM tiktok_comment_events e JOIN tiktok_accounts a ON a.id=e.account_id ORDER BY e.received_at DESC LIMIT 30').all<TikTokEvent>()).results;}
