import { sendPhotoReply } from "./product-images";
import { readWebhookBody, RequestBodyTooLarge } from "./request-body";
import type { ProductReply } from "./products";
import { accountSecrets, getAccount, isPlatform, listAccounts, platformRequest, sameSecret, verifySignature, type Account, type ConnectionEnv, type Platform } from "./accounts";
import { extractDmEvents } from "./dm-events";
import { resolveCustomerReply } from "./smart-replies";

type Incoming = { id: string; sender: string; text: string; image: boolean; timestamp: number; target: string };
const json = (data: unknown, status = 200) => Response.json(data, { status });
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];

async function incoming(platform: Platform, payload: Record<string, any>, account?: Account): Promise<Incoming[]> {
  if (platform === "instagram") return (await extractDmEvents(payload)).filter(event => event.kind === "message" && event.senderId !== event.recipientId).map(event => ({ id: event.messageId, sender: event.senderId, text: event.text, image: event.hasImage === true, timestamp: event.timestamp ?? 0, target: event.recipientId ?? "" }));
  if (platform === "telegram") {
    const message = object(payload.message), chat = object(message.chat), sender = object(message.from);
    if (!account || chat.type !== "private" || sender.is_bot || typeof payload.update_id !== "number" || !Number.isSafeInteger(payload.update_id)) return [];
    const text = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : "";
    const image = array(message.photo).length > 0;
    if (!text && !image) return [];
    return [{ id: String(payload.update_id), sender: String(chat.id), text, image, timestamp: Number(message.date) * 1000, target: account.account_id }];
  }
  const events: Incoming[] = [];
  for (const entry of array(payload.entry)) {
    if (platform === "facebook") {
      for (const raw of array(object(entry).messaging)) {
        const value = object(raw), message = object(value.message), recipient = String(object(value.recipient).id ?? "");
        if (message.is_echo || message.is_deleted || !message.mid || String(object(entry).id ?? "") !== recipient) continue;
        const text = typeof message.text === "string" ? message.text : "";
        const image = array(message.attachments).some(item => object(item).type === "image");
        if (!text && !image) continue;
        events.push({ id: String(message.mid), sender: String(object(value.sender).id ?? ""), text, image, timestamp: Number(value.timestamp), target: recipient });
      }
    } else {
      for (const change of array(object(entry).changes)) {
        const value = object(object(change).value), target = String(object(value.metadata).phone_number_id ?? "");
        for (const raw of array(value.messages)) {
          const message = object(raw);
          if (!["text", "image"].includes(message.type) || !message.id) continue;
          const text = message.type === "text" ? object(message.text).body : object(message.image).caption;
          events.push({ id: String(message.id), sender: String(message.from ?? ""), text: typeof text === "string" ? text : "", image: message.type === "image", timestamp: Number(message.timestamp) * 1000, target });
        }
      }
    }
  }
  return events;
}

async function send(env: ConnectionEnv, account: Account, sender: string, text: string): Promise<unknown> {
  const secrets = await accountSecrets(env, account.id);
  if (account.platform === "telegram") { return platformRequest(`https://api.telegram.org/bot${secrets.token}/sendMessage`, secrets.token, { chat_id: sender, text }); }
  if (account.platform === "whatsapp") { return platformRequest(`https://graph.facebook.com/v25.0/${account.account_id}/messages`, secrets.token, { messaging_product: "whatsapp", recipient_type: "individual", to: sender, type: "text", text: { body: text, preview_url: false } }); }
  const host = account.platform === "instagram" ? "graph.instagram.com" : "graph.facebook.com";
  return platformRequest(`https://${host}/v25.0/${account.account_id}/messages`, secrets.token, { ...(account.platform === "facebook" ? { messaging_type: "RESPONSE" } : {}), recipient: { id: sender }, message: { text } });
}

async function sendReply(env: ConnectionEnv, account: Account, sender: string, reply: ProductReply, origin: string) {
  const sendText = () => send(env, account, sender, reply.message.text);
  if (!reply.image) return { metaResponse: await sendText(), imageId: null };
  const secrets = await accountSecrets(env, account.id);
  return sendPhotoReply(reply.image, reply.message.text, origin, sendText, (url, caption) => {
    if (account.platform === "telegram") return platformRequest(`https://api.telegram.org/bot${secrets.token}/sendPhoto`, secrets.token, { chat_id: sender, photo: url, caption });
    if (account.platform === "whatsapp") return platformRequest(`https://graph.facebook.com/v25.0/${account.account_id}/messages`, secrets.token, { messaging_product: "whatsapp", recipient_type: "individual", to: sender, type: "image", image: { link: url, caption } });
    const host = account.platform === "instagram" ? "graph.instagram.com" : "graph.facebook.com";
    return platformRequest(`https://${host}/v25.0/${account.account_id}/messages`, secrets.token, { ...(account.platform === "facebook" ? { messaging_type: "RESPONSE" } : {}), recipient: { id: sender }, message: { attachment: { type: "image", payload: { url } } } });
  }, account.platform === "whatsapp" || account.platform === "telegram");
}

async function processIncoming(env: ConnectionEnv, account: Account, event: Incoming, origin: string): Promise<void> {
  if (!event.id || event.id.length > 1000 || !/^\d{1,40}$/.test(event.sender) || event.sender === account.account_id || event.target !== account.account_id || event.text.length > 10000) return;
  const now = Date.now();
  const validTime = Number.isFinite(event.timestamp) && event.timestamp > now - 24 * 60 * 60 * 1000 && event.timestamp < now + 5 * 60 * 1000;
  const result = await env.DB.prepare("INSERT OR IGNORE INTO channel_events (account_id, event_id, sender_id, text, status, received_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(account.id, event.id, event.sender, event.text || (event.image ? "صورة منتج" : ""), validTime ? "processing" : "expired", new Date().toISOString()).run();
  if (!result.meta.changes || !validTime) return;
  const update = (status: string, replyKey: string | null, replyText: string | null, error: string | null = null, imageId: string | null = null) => env.DB.prepare("UPDATE channel_events SET status = ?, reply_key = ?, reply_text = ?, error = ?, reply_image_id = ? WHERE account_id = ? AND event_id = ?").bind(status, replyKey, replyText, error, imageId, account.id, event.id).run();
  try {
    const reply = await resolveCustomerReply(env.DB, event.text, event.image);
    if (!reply) { await update("ignored", null, null); return; }
    if (env.RESERVE_REPLY && !env.RESERVE_REPLY()) { await update("ignored", null, null, "انتهت التجربة أو وصلت إلى حد الردود."); return; }
    if (String(env.DRY_RUN ?? "true").toLowerCase() !== "false") { await update("test", reply.key, reply.message.text); return; }
    const delivery = await sendReply(env, account, event.sender, reply, origin);
    await update("sent", reply.key, reply.message.text, delivery.warning ?? null, delivery.imageId);
  } catch { await update("error", null, null, "تعذّر إرسال الرد. تحقق من اتصال الحساب وصلاحياته."); }
}

export async function handleChannelWebhook(request: Request, env: ConnectionEnv, platformName: string, telegramId?: string): Promise<Response> {
  if (!isPlatform(platformName)) return json({ error: "منصة غير مدعومة." }, 404);
  const platform = platformName;
  const accounts = (await listAccounts(env.DB)).filter(account => account.platform === platform && account.active && account.status !== "disconnected");
  const url = new URL(request.url);
  if (request.method === "GET" && platform !== "telegram") {
    if (url.searchParams.get("hub.mode") !== "subscribe") return json({ error: "طلب تحقق غير صالح." }, 403);
    for (const account of accounts) {
      const secret = await accountSecrets(env, account.id).catch(() => null);
      if (secret && await sameSecret(url.searchParams.get("hub.verify_token") ?? "", secret.verifyToken)) return new Response(url.searchParams.get("hub.challenge") ?? "");
    }
    return json({ error: "رمز التحقق غير صحيح." }, 403);
  }
  if (request.method !== "POST") return json({ error: "طريقة غير مدعومة." }, 405);
  let raw: ArrayBuffer;
  try { raw = await readWebhookBody(request); }
  catch (error) {
    if (error instanceof RequestBodyTooLarge) return json({ error: "الطلب كبير جدًا." }, 413);
    throw error;
  }
  let payload: Record<string, any>;
  try { payload = object(JSON.parse(new TextDecoder().decode(raw))); } catch { return json({ error: "طلب غير صالح." }, 400); }
  if (platform === "telegram") {
    const account = telegramId ? await getAccount(env.DB, telegramId) : null;
    if (!account || account.platform !== platform || !account.active || account.status === "disconnected") return json({ ok: true });
    const secrets = await accountSecrets(env, account.id).catch(() => null);
    if (!secrets || !await sameSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "", secrets.verifyToken)) return json({ error: "الطلب غير موثّق." }, 401);
    await env.DB.prepare("UPDATE connected_accounts SET webhook_seen_at = ? WHERE id = ?").bind(new Date().toISOString(), account.id).run();
    for (const event of (await incoming(platform, payload, account)).slice(0, 25)) await processIncoming(env, account, event, url.origin);
    return json({ ok: true });
  }
  if (payload.object !== (platform === "instagram" ? "instagram" : platform === "facebook" ? "page" : "whatsapp_business_account")) return json({ ok: true });
  const events = await incoming(platform, payload);
  let rejected = false;
  for (const account of accounts) {
    const selected = events.filter(event => event.target === account.account_id).slice(0, 25); if (!selected.length) continue;
    const secret = await accountSecrets(env, account.id).catch(() => null);
    if (!secret || !await verifySignature(raw, request.headers.get("x-hub-signature-256"), secret.appSecret)) { rejected = true; continue; }
    await env.DB.prepare("UPDATE connected_accounts SET webhook_seen_at = ? WHERE id = ?").bind(new Date().toISOString(), account.id).run();
    for (const event of selected) await processIncoming(env, account, event, url.origin);
  }
  return rejected ? json({ error: "الطلب غير موثّق." }, 401) : json({ ok: true });
}

export type ChannelActivity = { platform: Platform; display_name: string; text: string; reply_text: string | null; status: string; received_at: string; reply_image_id: string | null; error: string | null };
export async function recentChannelActivity(db: D1Database): Promise<ChannelActivity[]> {
  return (await db.prepare("SELECT a.platform, a.display_name, e.text, e.reply_text, e.status, e.received_at, e.reply_image_id, e.error FROM channel_events e JOIN connected_accounts a ON a.id = e.account_id ORDER BY e.received_at DESC LIMIT 30").all<ChannelActivity>()).results;
}
