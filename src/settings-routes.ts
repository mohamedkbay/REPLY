import { connectTikTok, getTikTokAccounts, pollTikTokAccount, resolveTikTokReply } from "./tiktok";
import { accountSecrets, callbackUrl, checkAccount, connectAccount, ConnectionError, getAccount, listAccounts, subscribeAccount, type ConnectionEnv } from "./accounts";
import { getProductSettings, type ProductBotSettings } from "./products";
import { defaultBusinessReplies, getBusinessReplies, REPLY_TOPICS, resolveCustomerReply, type BusinessReplies } from "./smart-replies";
import { renderSettingsPage, type SettingsData } from "./settings-page";
const redirect = (path: string) => new Response(null, { status: 303, headers: { location: path } });

/** Called only after the admin session and same-origin checks in index.ts. */
export async function handleSettings(request: Request, env: ConnectionEnv, url: URL): Promise<Response> {
  const page = async (error?: string, draft?: { business: BusinessReplies; products: ProductBotSettings }, setupId?: string) => {
    const [accounts, business, products, tiktokAccounts] = await Promise.all([listAccounts(env.DB), getBusinessReplies(env.DB), getProductSettings(env.DB), getTikTokAccounts(env.DB)]);
    const imageExample = await env.DB.prepare("SELECT code FROM products WHERE active=1 AND image_id IS NOT NULL ORDER BY id DESC LIMIT 1").first<{code:string}>();
    const data: SettingsData = { imageExampleCode: imageExample?.code, accounts, tiktokAccounts, business: draft?.business ?? business, products: draft?.products ?? products, tab: draft ? "replies" : url.searchParams.get("tab") ?? "accounts", dryRun: String(env.DRY_RUN ?? "true").toLowerCase() !== "false", keyReady: Boolean(env.ACCOUNT_ENCRYPTION_KEY && env.ACCOUNT_ENCRYPTION_KEY.length >= 32), origin: url.origin, error, saved: url.searchParams.get("saved") === "1" };
    const id = setupId ?? url.searchParams.get("setup");
    const account = accounts.find(item => item.id === id);
    if (account) {
      try { const secrets = await accountSecrets(env, account.id); data.setup = { id: account.id, callback: callbackUrl(account, env.WEBHOOK_BASE_URL ?? url.origin), verifyToken: secrets.verifyToken }; }
      catch { data.error = "تعذّرت قراءة بيانات الحساب. أعد ربطه."; }
    }
    return new Response(renderSettingsPage(data), { status: data.error ? 400 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "same-origin" } });
  };
  if (request.method === "GET" && url.pathname === "/admin/settings") return page();
  if (request.method !== "POST") return Response.json({ error: "طريقة غير مدعومة." }, { status: 405 });
  if (Number(request.headers.get("content-length")) > 64 * 1024) return Response.json({ error: "الطلب كبير جدًا." }, { status: 413 });
  const form = await request.formData();
  if (url.pathname === "/admin/tiktok/preview") {
    const text=String(form.get("text")??"");
    if(text.length>1000)return Response.json({error:"التعليق طويل جدًا."},{status:400});
    const reply=await resolveTikTokReply(env.DB,text);
    return Response.json({text:reply?.text??"لا يوجد رد تلقائي مفعّل لهذا التعليق.",image:null});
  }
  if (url.pathname === "/admin/settings/preview") {
    const text = String(form.get("text") ?? "");
    if (text.length > 1000) return Response.json({ error: "الرسالة طويلة جدًا." }, { status: 400 });
    const reply = await resolveCustomerReply(env.DB, text, form.get("image") === "true");
    return Response.json({ image: reply?.image ?? null, text: reply?.message.text ?? "لا يوجد رد تلقائي مفعّل لهذا السؤال. تبقى الرسالة لفريق الصفحة." });
  }
  if (url.pathname === "/admin/settings/replies") {
    const business = defaultBusinessReplies(); business.enabled = form.get("business_enabled") === "on";
    const products: ProductBotSettings = { enabled: form.get("product_enabled") === "on", prompt: String(form.get("product_prompt") ?? "").trim(), unknown: String(form.get("product_unknown") ?? "").trim() };
    for (const topic of REPLY_TOPICS) business.topics[topic.id] = { enabled: form.get(`topic_${topic.id}_enabled`) === "on", text: String(form.get(`topic_${topic.id}_text`) ?? "").trim() };
    const draft = { business, products };
    if (!products.prompt || !products.unknown || products.prompt.length > 500 || products.unknown.length > 500) return page("اكتب ردود المنتجات من 1 إلى 500 حرف.", draft);
    if (REPLY_TOPICS.some(topic => !business.topics[topic.id].text || business.topics[topic.id].text.length > 800)) return page("اكتب نصًا لكل رد من 1 إلى 800 حرف.", draft);
    const now = new Date().toISOString();
    await env.DB.batch([["product_bot", products], ["business_replies", business]].map(([key, value]) => env.DB.prepare("INSERT INTO automation_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(key, JSON.stringify(value), now)));
    return redirect("/admin/settings?tab=replies&saved=1");
  }
  try {
    if (url.pathname === "/admin/tiktok") { await connectTikTok(env, form); return redirect("/admin/settings?tab=accounts&saved=1#tiktok-heading"); }
    const tiktokMatch = url.pathname.match(/^\/admin\/tiktok\/([a-f0-9-]{36})\/(enable|pause|check|disconnect)$/);
    if (tiktokMatch) {
      const account = (await getTikTokAccounts(env.DB)).find(item=>item.id===tiktokMatch[1]);
      if (!account) return page("حساب تيك توك غير موجود. حدّث الصفحة.");
      const action=tiktokMatch[2];
      if(action==="enable") await env.DB.prepare("UPDATE tiktok_accounts SET active=1,activated_at=?,last_error=NULL WHERE id=? AND active=0").bind(new Date().toISOString(),account.id).run();
      else if(action==="pause") await env.DB.prepare("UPDATE tiktok_accounts SET active=0 WHERE id=?").bind(account.id).run();
      else if(action==="disconnect") await env.DB.prepare("UPDATE tiktok_accounts SET active=0,credentials='' WHERE id=?").bind(account.id).run();
      else { if(!account.active)return page("فعّل متابعة تعليقات تيك توك أولًا. في وضع الاختبار لن تُنشر ردود."); await pollTikTokAccount(env,account); }
      return redirect("/admin/settings?tab=accounts&saved=1#tiktok-heading");
    }
    if (url.pathname === "/admin/connections") {
      const account = await connectAccount(env, form);
      return redirect(`/admin/settings?tab=accounts&saved=1&setup=${account.id}#setup-${account.id}`);
    }
    const match = url.pathname.match(/^\/admin\/connections\/([a-f0-9-]{36})\/(check|subscribe|pause|resume|disconnect)$/);
    if (!match) return Response.json({ error: "الطلب غير موجود." }, { status: 404 });
    const account = await getAccount(env.DB, match[1]);
    if (!account || account.status === "disconnected") return page("الحساب غير موجود. حدّث الصفحة.");
    const action = match[2];
    if (action === "check") await checkAccount(env, account);
    else if (action === "subscribe") await subscribeAccount(env, account, env.WEBHOOK_BASE_URL ?? url.origin);
    else if (action === "disconnect") await env.DB.prepare("UPDATE connected_accounts SET active = 0, credentials = '', status = 'disconnected' WHERE id = ?").bind(account.id).run();
    else await env.DB.prepare("UPDATE connected_accounts SET active = ? WHERE id = ?").bind(action === "resume" ? 1 : 0, account.id).run();
    return redirect("/admin/settings?tab=accounts&saved=1");
  } catch (error) {
    return page(error instanceof ConnectionError ? error.message : "تعذّر حفظ الاتصال. حاول مجددًا.");
  }
}
