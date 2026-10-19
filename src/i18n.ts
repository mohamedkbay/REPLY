import english from "./locales/en.json";

export type Language = "ar" | "en";
const catalog: Record<string, string> = english;
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrases = Object.keys(catalog).filter(key => key.length > 1).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${phrases.map(escapePattern).join("|")})(?![\\p{L}\\p{N}])`, "gu");

export function translateText(text: string): string {
  const trimmed = text.trim();
  if (Object.hasOwn(catalog, trimmed)) return text.replace(trimmed, catalog[trimmed]);
  return text.replace(pattern, match => catalog[match]);
}

export function requestLanguage(request: Request): Language {
  return /(?:^|;\s*)reply_language=en(?:;|$)/.test(request.headers.get("cookie") ?? "") ? "en" : "ar";
}

export function languageResponse(request: Request): Response {
  const url = new URL(request.url);
  const language = url.searchParams.get("lang") === "en" ? "en" : "ar";
  let target = new URL("/admin", url.origin);
  try { target = new URL(url.searchParams.get("returnTo") ?? "/admin", url.origin); } catch { /* Keep the dashboard for malformed URLs. */ }
  const location = target.origin === url.origin && /^\/admin(?:\/|$)/.test(target.pathname) ? target.pathname + target.search + target.hash : "/admin";
  return new Response(null, { status: 303, headers: {
    location, "cache-control": "no-store",
    "set-cookie": `reply_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${url.protocol === "https:" ? "; Secure" : ""}`
  } });
}

export const themeToggle = `<button class="theme-toggle" type="button" data-theme-toggle aria-label="الوضع الداكن" aria-pressed="false" title="تفعيل الوضع الداكن"><svg class="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 8.7 8.7 0 1 0 20.5 14Z"/></svg><svg class="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>`;
export const languageSwitch = `<nav class="language-switch" aria-label="اختر اللغة"><a data-language="ar" lang="ar" href="/admin/language?lang=ar">عربي</a><a data-language="en" lang="en" href="/admin/language?lang=en">English</a></nav>`;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const translateAttribute = (name: string, value: string): string => {
  if (name === "aria-label") {
    if (value.startsWith("توفر ")) return "Availability " + value.slice(5);
    if (value.startsWith("تعديل ")) return "Edit " + value.slice(6);
    if (/^(?:Availability|Edit) /.test(value)) return value;
  }
  return translateText(value);
};
const decode = (value: string) => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, key: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[key]!);
const voidTags = new Set(["input", "img", "meta", "link", "br", "hr", "source", "area", "base", "embed", "wbr", "col", "param", "track"]);
const keepClasses = /(?:^|\s)(?:auto-keys|chat-buttons|field-account|said|sent-reply|channel-reply|bubble|dm-reply-text|stage-product|user-message)(?:\s|$)/;

export function localizeMarkup(markup: string, language: Language): string {
  markup = markup.replace(/<a data-language="(ar|en)"/g, (tag, value) => tag + (value === language ? ' aria-current="true"' : ""));
  if (language === "ar") return markup;
  const stack: { tag: string; keep: boolean }[] = [];
  const parts = markup.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/gi) ?? [];
  const result = parts.map(part => {
    if (/^<(?:script|style)\b/i.test(part) || /^<!/.test(part)) return part;
    if (/^<\//.test(part)) {
      const tag = part.match(/^<\/([\w-]+)/)?.[1]?.toLowerCase();
      const index = stack.map(item => item.tag).lastIndexOf(tag ?? "");
      if (index !== -1) stack.splice(index);
      return part;
    }
    if (part.startsWith("<")) {
      const tag = part.match(/^<([\w-]+)/)?.[1]?.toLowerCase() ?? "";
      const classes = part.match(/\bclass="([^"]*)"/)?.[1] ?? "";
      const keep = Boolean(stack.at(-1)?.keep || /\btranslate="no"/.test(part) || ["textarea", "code", "pre", "bdi"].includes(tag) || keepClasses.test(classes));
      if (!voidTags.has(tag) && !/\/>$/.test(part)) stack.push({ tag, keep });
      if (tag === "html") return part.replace('lang="ar"', 'lang="en"').replace('dir="rtl"', 'dir="ltr"');
      return keep ? part : part.replace(/\b(aria-label|placeholder|title|data-column|data-confirm|label)="([^"]*)"/g, (_match, name, value) => `${name}="${escapeHtml(translateAttribute(name, decode(value)))}"`);
    }
    if (stack.at(-1)?.keep) return part;
    const translated = translateText(decode(part));
    return translated === decode(part) ? part : escapeHtml(translated);
  }).join("");
  const data = JSON.stringify(catalog).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return result.replace("</head>", `<script type="application/json" id="reply-locale">${data}</script></head>`)
    .replaceAll('"ar-LY"', '"en-GB"').replaceAll("'ar-LY'", "'en-GB'");
}

export async function localizeAdminResponse(request: Request, response: Response): Promise<Response> {
  if (!new URL(request.url).pathname.startsWith("/admin")) return response;
  const language = requestLanguage(request);
  const type = response.headers.get("content-type") ?? "";
  const headers = new Headers(response.headers);
  headers.set("content-language", language);
  headers.set("vary", "Cookie");
  if (type.includes("text/html")) {
    headers.delete("content-length");
    return new Response(localizeMarkup(await response.text(), language), { status: response.status, headers });
  }
  if (language === "en" && type.includes("application/json")) {
    const data = await response.json() as Record<string, unknown>;
    if (typeof data.error === "string") data.error = translateText(data.error);
    headers.delete("content-length");
    return new Response(JSON.stringify(data), { status: response.status, headers });
  }
  return response;
}
