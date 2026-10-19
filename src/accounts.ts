export type Platform = "instagram" | "facebook" | "whatsapp" | "telegram";
export type ConnectionEnv = { DB: D1Database; ACCOUNT_ENCRYPTION_KEY?: string; DRY_RUN?: string; WEBHOOK_BASE_URL?: string; SINGLE_PLATFORM_ACCOUNT?: boolean; RESERVE_REPLY?: () => boolean };
export type Account = {
  id: string; platform: Platform; account_id: string; display_name: string; active: number;
  status: string; last_error: string | null; last_checked_at: string; webhook_seen_at: string | null;
  subscribed_at: string | null; created_at: string;
};
export type AccountSecrets = { token: string; appSecret: string; verifyToken: string };
export const PLATFORM_NAMES: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", telegram: "Telegram" };
const columns = "id, platform, account_id, display_name, active, status, last_error, last_checked_at, webhook_seen_at, subscribed_at, created_at";

export class ConnectionError extends Error {}
export function isPlatform(value: string): value is Platform { return Object.hasOwn(PLATFORM_NAMES, value); }

function encode(value: Uint8Array): string { return btoa(Array.from(value, byte => String.fromCharCode(byte)).join("")); }
function decode(value: string): Uint8Array { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
async function key(env: ConnectionEnv): Promise<CryptoKey> {
  if (!env.ACCOUNT_ENCRYPTION_KEY || env.ACCOUNT_ENCRYPTION_KEY.length < 32) throw new ConnectionError("يلزم تجهيز مفتاح حماية الحسابات في إعدادات السيرفر أولًا.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ACCOUNT_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptAccountSecrets(env: ConnectionEnv, secrets: AccountSecrets, id: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(id) }, await key(env), new TextEncoder().encode(JSON.stringify(secrets)));
  return `v1.${encode(nonce)}.${encode(new Uint8Array(bytes))}`;
}
export async function accountSecrets(env: ConnectionEnv, id: string): Promise<AccountSecrets> {
  const row = await env.DB.prepare("SELECT credentials FROM connected_accounts WHERE id = ?").bind(id).first<{ credentials: string }>();
  if (!row?.credentials) throw new ConnectionError("هذا الحساب يحتاج إعادة ربط.");
  return decryptAccountSecrets(env, row.credentials, id);
}
export async function decryptAccountSecrets(env: ConnectionEnv, encrypted: string, id: string): Promise<AccountSecrets> {
  try {
    const [version, nonce, data, extra] = encrypted.split(".");
    if (version !== "v1" || !nonce || !data || extra) throw new Error();
    const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(nonce), additionalData: new TextEncoder().encode(id) }, await key(env), decode(data));
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof value.token !== "string" || typeof value.appSecret !== "string" || typeof value.verifyToken !== "string") throw new Error();
    return value;
  } catch { throw new ConnectionError("تعذّرت قراءة بيانات الحساب. أعد ربطه."); }
}

/** All credential-bearing requests go only to fixed official hosts and never follow redirects. */
export async function platformRequest(url: string, token: string, body?: Record<string, unknown>): Promise<Record<string, any>> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["graph.instagram.com", "graph.facebook.com", "api.telegram.org"].includes(parsed.hostname)) throw new Error();
    const telegram = parsed.hostname === "api.telegram.org";
    const response = await fetch(url, {
      method: body ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(12000),
      headers: { ...(telegram ? {} : { authorization: `Bearer ${token}` }), ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok || response.status >= 300) throw new Error();
    const reader = response.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 256 * 1024) { await reader.cancel(); throw new Error(); } chunks.push(next.value); }
    const bytes = new Uint8Array(size); let cursor = 0; for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || result.error || result.ok === false || result.success === false) throw new Error();
    return result;
  } catch { throw new ConnectionError("تعذّر إكمال الطلب مع المنصة. تأكد من بيانات الحساب والصلاحيات ثم حاول مجددًا."); }
}

async function verify(platform: Platform, accountId: string, token: string): Promise<{ id: string; name: string }> {
  if (platform === "telegram") {
    if (!/^\d+:[A-Za-z0-9_-]{20,200}$/.test(token)) throw new ConnectionError("رمز البوت غير صالح. انسخ الرمز من BotFather.");
    const data = await platformRequest(`https://api.telegram.org/bot${token}/getMe`, token);
    if (!data.result?.is_bot || !data.result.id) throw new ConnectionError("لم نتعرف على بوت صالح بهذا الرمز.");
    return { id: String(data.result.id), name: data.result.username ? `@${data.result.username}` : String(data.result.first_name || "Telegram") };
  }
  if (!/^\d{1,40}$/.test(accountId)) throw new ConnectionError("اكتب معرّف الحساب بالأرقام فقط.");
  if (!/^[A-Za-z0-9._|\-]{10,8192}$/.test(token)) throw new ConnectionError("رمز الوصول غير صالح. أعد نسخه من المنصة.");
  const endpoint = platform === "instagram" ? "https://graph.instagram.com/v25.0/me?fields=user_id,username" : platform === "facebook" ? "https://graph.facebook.com/v25.0/me?fields=id,name,category" : `https://graph.facebook.com/v25.0/${accountId}?fields=id,display_phone_number,verified_name`;
  const data = await platformRequest(endpoint, token);
  const id = String(platform === "instagram" ? data.user_id ?? "" : data.id ?? "");
  if (id !== accountId) throw new ConnectionError("رمز الوصول يخص حسابًا آخر. تأكد من المعرّف والرمز.");
  if (platform === "facebook" && !data.category) throw new ConnectionError("استخدم رمز وصول الصفحة، وليس الحساب الشخصي.");
  if (platform === "whatsapp" && !data.display_phone_number) throw new ConnectionError("لم نتعرف على رقم WhatsApp Business صالح.");
  return { id, name: String(data.username || data.name || data.verified_name || data.display_phone_number || id).slice(0, 160) };
}

export async function listAccounts(db: D1Database): Promise<Account[]> {
  return (await db.prepare(`SELECT ${columns} FROM connected_accounts WHERE status != 'disconnected' ORDER BY created_at DESC`).all<Account>()).results;
}
export async function getAccount(db: D1Database, id: string): Promise<Account | null> {
  return db.prepare(`SELECT ${columns} FROM connected_accounts WHERE id = ?`).bind(id).first<Account>();
}
export async function connectAccount(env: ConnectionEnv, form: FormData): Promise<Account> {
  await key(env);
  const platform = String(form.get("platform") ?? "");
  if (!isPlatform(platform)) throw new ConnectionError("اختر منصة مدعومة.");
  const accountId = String(form.get("account_id") ?? "").trim();
  const token = String(form.get("token") ?? "").trim();
  const appSecret = String(form.get("app_secret") ?? "").trim();
  if (platform !== "telegram" && !/^[A-Za-z0-9_-]{16,128}$/.test(appSecret)) throw new ConnectionError("أضف سر تطبيق Meta حتى نتأكد من مصدر الرسائل الواردة.");
  const verified = await verify(platform, accountId, token);
  if (env.SINGLE_PLATFORM_ACCOUNT) {
    const occupied = await env.DB.prepare("SELECT id FROM connected_accounts WHERE platform = ? AND account_id != ? AND credentials != '' AND status != 'disconnected'").bind(platform, verified.id).first();
    if (occupied) throw new ConnectionError("يمكنك ربط حساب واحد من كل منصة. افصل الحساب الحالي أولًا.");
  }
  const existing = await env.DB.prepare("SELECT id FROM connected_accounts WHERE platform = ? AND account_id = ?").bind(platform, verified.id).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const previous = existing ? await accountSecrets(env, id).catch(() => null) : null;
  const secrets: AccountSecrets = { token, appSecret, verifyToken: previous?.verifyToken ?? crypto.randomUUID().replace(/-/g, "") };
  const encrypted = await encryptAccountSecrets(env, secrets, id); const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO connected_accounts (id, platform, account_id, display_name, credentials, active, status, last_checked_at, created_at)
    VALUES (?, ?, ?, ?, ?, 1, 'verified', ?, ?)
    ON CONFLICT(platform, account_id) DO UPDATE SET display_name = excluded.display_name, credentials = excluded.credentials, active = 1, status = 'verified', last_error = NULL, last_checked_at = excluded.last_checked_at`)
    .bind(id, platform, verified.id, verified.name, encrypted, now, now).run();
  return (await getAccount(env.DB, id))!;
}

export async function checkAccount(env: ConnectionEnv, account: Account): Promise<void> {
  const secrets = await accountSecrets(env, account.id);
  try {
    const result = await verify(account.platform, account.account_id, secrets.token);
    await env.DB.prepare("UPDATE connected_accounts SET display_name = ?, status = 'verified', last_error = NULL, last_checked_at = ? WHERE id = ?").bind(result.name, new Date().toISOString(), account.id).run();
  } catch {
    await env.DB.prepare("UPDATE connected_accounts SET status = 'error', last_error = ?, last_checked_at = ? WHERE id = ?").bind("تعذّر التحقق من الاتصال. راجع بيانات الحساب والصلاحيات.", new Date().toISOString(), account.id).run();
    throw new ConnectionError("تعذّر التحقق من الاتصال. راجع بيانات الحساب والصلاحيات.");
  }
}

export function callbackUrl(account: Account, origin: string): string {
  return `${origin}/channels/${account.platform}${account.platform === "telegram" ? `/${account.id}` : ""}`;
}
export async function subscribeAccount(env: ConnectionEnv, account: Account, origin: string): Promise<void> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) throw new ConnectionError("لتفعيل الاستقبال، انشر Reply على رابط HTTPS عام أولًا. المعاينة المحلية لا تستقبل رسائل المنصات.");
  const secrets = await accountSecrets(env, account.id);
  if (account.platform === "telegram") await platformRequest(`https://api.telegram.org/bot${secrets.token}/setWebhook`, secrets.token, { url: callbackUrl(account, origin), secret_token: secrets.verifyToken, allowed_updates: ["message"] });
  else {
    if (account.platform === "whatsapp") throw new ConnectionError("أضف رابط الاستقبال ورمز التحقق في إعدادات Webhooks لتطبيق WhatsApp لدى Meta، ثم أرسل رسالة اختبار من حساب آخر.");
    const host = account.platform === "instagram" ? "graph.instagram.com" : "graph.facebook.com";
    await platformRequest(`https://${host}/v25.0/${account.account_id}/subscribed_apps`, secrets.token, { subscribed_fields: account.platform === "instagram" ? "messages,messaging_postbacks,messaging_referral" : "messages,messaging_postbacks" });
  }
  await env.DB.prepare("UPDATE connected_accounts SET subscribed_at = ? WHERE id = ?").bind(new Date().toISOString(), account.id).run();
}

export async function verifySignature(raw: ArrayBuffer, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", signingKey, bytes, raw);
}
export async function sameSecret(first: string, second: string): Promise<boolean> {
  if (!first || !second) return false;
  const [a, b] = await Promise.all([first, second].map(value => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
  return new Uint8Array(a).every((byte, index) => byte === new Uint8Array(b)[index]);
}
