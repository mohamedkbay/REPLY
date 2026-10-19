import { languageSwitch, themeToggle } from "./i18n";
import { paletteStyles } from "./appearance";
// Shared tokens, form styles and the header for every admin page, so the
// dashboard, Sent DMs and the login page read as one product.

export const PRODUCT_NAME = "Reply";
export const SUPPORT_URL = "https://wa.me/218910278797";
export function renderWordmark(): string {
  return `<span class="wordmark"><img class="reply-logo" src="/brand/reply-symbol-ink.svg" width="52" height="48" alt="Reply"></span>`;
}

export const baseStyles = `
::selection{background:var(--mark);color:var(--ink)}
input[type=checkbox]{accent-color:var(--accent)}

@font-face{font-family:"Cairo";font-style:normal;font-weight:400;font-display:block;src:url("/fonts/cairo/cairo-400.woff2") format("woff2")}
@font-face{font-family:"Cairo";font-style:normal;font-weight:500;font-display:block;src:url("/fonts/cairo/cairo-500.woff2") format("woff2")}
@font-face{font-family:"Cairo";font-style:normal;font-weight:600;font-display:block;src:url("/fonts/cairo/cairo-600.woff2") format("woff2")}
@font-face{font-family:"Cairo";font-style:normal;font-weight:700;font-display:block;src:url("/fonts/cairo/cairo-700.woff2") format("woff2")}
:root{--bg:#ffffff;--surface:#fff;--ink:#111111;--text:#242424;--muted:#60605c;--faint:#60605c;--line:#e2e2de;--line-strong:#b8b8b2;--accent:#111111;--accent-hover:#333333;--accent-soft:#f0f0ed;--mark:#e3d9ee;--warn:#8a5a1f;--warn-soft:#f8efe1;--danger:#9a3a2c;--danger-soft:#f7e8e4;--sans:"Cairo",Tahoma,Arial,sans-serif;--serif:var(--sans);--mono:var(--sans);color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:88px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.75 var(--sans);font-synthesis:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
h1,h2,h3,p,dl,dd{margin:0}
a{color:inherit;text-decoration:none}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
code{font-family:var(--mono);font-size:.92em}
[hidden]{display:none!important}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sr-only,.skip:not(:focus){position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip:focus{position:fixed;inset-inline-start:16px;top:12px;z-index:100;padding:8px 12px;background:var(--surface);border:1px solid var(--line-strong);border-radius:6px}
.wordmark{display:inline-flex;align-items:baseline;gap:10px;white-space:nowrap}
.wordmark-name{font-family:var(--serif);font-size:19px;letter-spacing:-.01em;color:var(--ink)}
.wordmark-product{font-size:13px;color:var(--muted);padding-inline-start:10px;border-inline-start:1px solid var(--line-strong)}
.mode{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);white-space:nowrap}
.mode i{width:7px;height:7px;border-radius:50%;background:#5f8f4e;box-shadow:0 0 0 3px #5f8f4e1f;flex:none}
.mode.test i,.mode.error i{background:#c08a3e;box-shadow:0 0 0 3px #c08a3e1f}
.mode.off i{background:var(--faint);box-shadow:none}
input[type=url],input[type=password],input[type=date],input[name=username],input[name=story_id],input[name=story_url],input[data-reply-key],.dm-link-source input,code,pre,.who,.connection-handle,.dm-reply-key{direction:ltr;unicode-bidi:isolate;text-align:start}
textarea,input[name=keywords],input[name=keyword],.bubble,.said,.event-body>p{unicode-bidi:plaintext}
.wordmark-name{font-family:var(--sans);font-weight:600;letter-spacing:0}
h1,h2,h3,.wordmark-name,.auto-keys,.keyword{letter-spacing:0!important}
.auto-keys,.keyword{font-family:var(--sans)!important}
mark{background:var(--mark);color:inherit;border-radius:3px;padding:0 2px}
.wordmark{align-items:center;gap:10px}.wordmark img,.wordmark .reply-mark{flex:none}.reply-mark{color:var(--accent)}.wordmark-copy{display:flex;flex-direction:column;gap:1px}.wordmark-name{font-size:24px;font-weight:700;line-height:1.1;text-align:start}.wordmark-product{border:0;padding:0;font-size:11px;line-height:1.6}.brand-link{display:block;width:fit-content}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important;animation:none!important}}
${paletteStyles}
`;

/** Labels, inputs, buttons and switches shared by the dashboard and the login page. */
export const formStyles = `
label{display:block;font-size:13px;font-weight:500;color:var(--ink)}
label>input:not([type=checkbox]),label>select,label>textarea{display:block;margin-top:6px}
label>.field-help{display:block;margin-top:6px}
input:not([type=checkbox]):not([type=hidden]),select,textarea{width:100%;font-size:16px;font-weight:400;color:var(--text);background:var(--surface);border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px;transition:border-color .15s,box-shadow .15s}
select{appearance:none;-webkit-appearance:none;padding-inline-end:30px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c716b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 10px center}
textarea{resize:vertical;line-height:1.5}
input::placeholder,textarea::placeholder{color:var(--faint)}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px #24402f1a}
input[readonly]{background:#f6f6f2;color:var(--muted)}
input[aria-invalid=true]{border-color:var(--danger)}
.optional{font-weight:400;color:var(--faint)}
.field-help{font-size:12.5px;font-weight:400;color:var(--faint);line-height:1.5}
.stack{display:flex;flex-direction:column;gap:14px}
.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.form-actions>div{display:flex;gap:8px;flex-wrap:wrap}
.form-actions form{margin:0}
.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 14px;border-radius:7px;border:1px solid transparent;font-size:13px;font-weight:500;white-space:nowrap;text-decoration:none;transition:background .15s,border-color .15s,color .15s}
.button .icon{width:14px;height:14px}
.primary{background:var(--accent);color:#fff}.primary:hover{background:var(--accent-hover)}
.secondary{background:var(--surface);border-color:var(--line-strong);color:var(--ink)}.secondary:hover{border-color:var(--faint)}
.danger{background:transparent;color:var(--danger)}.danger:hover{background:var(--danger-soft)}
.button:disabled{opacity:.45;cursor:not-allowed}
.full{width:100%}
.text-link{display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:0;font-size:13px;font-weight:500;color:var(--accent)}
.text-link:hover{text-decoration:underline;text-underline-offset:3px}
.text-link .icon{width:13px;height:13px}
.switch-label{display:inline-flex;flex-direction:row;align-items:center;gap:10px;font-size:13px;font-weight:400;color:var(--text);cursor:pointer;position:relative;width:fit-content}
.switch-label input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
.switch{position:relative;flex:none;width:30px;height:18px;border-radius:9px;background:var(--line-strong);transition:background .2s}
.switch:after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #15191633;transition:transform .2s}
.switch-label input:checked+.switch{background:var(--accent)}
.switch-label input:checked+.switch:after{transform:translateX(-12px)}
.switch-label input:focus-visible+.switch{outline:2px solid var(--accent);outline-offset:2px}
.tag,.badge{display:inline-flex;align-items:center;width:fit-content;font-size:12px;font-weight:500;line-height:1.5;padding:1px 8px;border-radius:5px;background:#f0efea;color:var(--muted);white-space:nowrap}
.tag.ok,.badge.green{background:var(--accent-soft);color:var(--accent)}
.tag.warn,.badge.amber{background:var(--warn-soft);color:var(--warn)}
.tag.danger,.badge.red{background:var(--danger-soft);color:var(--danger)}
.badge i{display:none}
.notice{background:var(--warn-soft);color:var(--warn);border-radius:8px;padding:10px 14px;font-size:13px}
.notice a{text-decoration:underline;text-underline-offset:2px}
@media(max-width:640px){.two-fields{grid-template-columns:1fr}}
`;

export type Page = "overview" | "sent" | "products" | "automations" | "activity" | "stats" | "settings" | "advanced";

export function renderHeader(page: Page, status: string): string {
  const entries = [
    ["/admin", "نظرة عامة", page === "overview"],
    ["/admin/products", "المخزن", page === "products"],
    ["/admin/sent", "الرسائل المرسلة", page === "sent"],
    ["/admin/automations", "الأتمتة", page === "automations"],
    ["/admin/activity", "النشاط", page === "activity" || page === "stats"],
    ["/admin/settings", "الإعدادات", page === "settings" || page === "advanced"]
  ] as const;
  const links = entries.map(([href, label, current]) => `<a href="${href}"${current ? ' aria-current="page"' : ""}>${label}<svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 5 5 19M5 5v14h14"/></svg></a>`).join("");
  return `<header class="site-header"><div class="header-inner">
    <a class="brand-link" href="/admin" aria-label="Reply · نظرة عامة">${renderWordmark()}</a>
    <nav class="site-nav" aria-label="لوحة الإدارة">${links}</nav>
    <div class="header-end">${status}</div>
    ${themeToggle}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="reply-menu"><svg class="menu-dots" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/><circle cx="16" cy="16" r="2.2"/></svg><svg class="menu-cross" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg><span class="sr-only">فتح القائمة</span></button>
  </div><div class="menu-scene" id="reply-menu" hidden inert><div class="menu-layers" aria-hidden="true"><i></i><i></i><i></i></div><div class="menu-sheet"><nav class="menu-large" aria-label="كل الأقسام">${links}</nav><div class="menu-features"><a class="menu-feature feature-stock" href="/admin/products"><span>بضاعتك وأسعارها</span><strong>المخزن</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M19 5 5 19M5 5v14h14"/></svg></a><a class="menu-feature feature-preview" href="/admin/settings?tab=preview"><span>شوف الرد بعين العميل</span><strong>جرّب البوت</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M19 5 5 19M5 5v14h14"/></svg></a></div><div class="menu-bottom">${status}${languageSwitch}<a href="/admin/advanced">أدوات إنستغرام المتقدمة</a><form action="/admin/logout" method="post"><button class="signout">تسجيل الخروج</button></form></div></div></div></header>`;
}

export function renderFooter(): string {
  return `<footer class="reply-footer"><div><p>مخزنك وردودك، في مكان واحد.</p><a href="/admin/settings?tab=preview">جرّب المحادثة <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 5 5 19M5 5v14h14"/></svg></a></div><p class="footer-bottom"><span>Reply · إدارة المحادثات</span><a href="${SUPPORT_URL}" target="_blank" rel="noopener">Helpdsek · <bdi>0910278797</bdi></a><a href="/admin/settings">الحسابات والإعدادات</a></p></footer>`;
}

export const headerStyles = `
.site-header{position:sticky;top:0;z-index:40;background:var(--bg)}
.header-inner{display:flex;align-items:center;gap:20px;margin:auto}
.brand-link{display:block;flex:none;width:fit-content}
.site-nav{display:flex;align-items:center;min-width:0}
.site-nav a{display:flex;align-items:center;white-space:nowrap}
.header-end{display:flex;align-items:center;flex:none}
.header-end form,.menu-bottom form{margin:0}
.menu-toggle{display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}
.signout{background:none;border:0;padding:6px 0;font:inherit;color:var(--muted);cursor:pointer}
`;
