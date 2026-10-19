import { languageSwitch, themeToggle } from "./i18n";
import { renderBotPreview, botPreviewScript, botPreviewStyles } from "./bot-preview";
import { formatProductPrice, type Product } from "./products";
import { appearanceHead, appearanceStyles } from "./appearance";
import type { TikTokEvent } from "./tiktok";
import { productImagePath } from "./product-images";
import { PLATFORM_NAMES } from "./accounts";
import type { ChannelActivity } from "./channels";
import { customReplyKey, ruleReplyKey, type DmFeatureSettings, type IceBreakersPublicationStatus } from "./dm-features";
import {
  dmFeaturesClientScript,
  dmFeaturesStyles,
  renderDmFeaturesPanel,
  renderDmMessageContext,
  type ReplyOption
} from "./dm-features-panel";
import type { InstagramTokenStatus } from "./instagram-token";
import { keywordMatch } from "./keyword-match";
import { renderSentRows, sentRowStyles, type SentDmRow } from "./sent-dms";
import { baseStyles, formStyles, headerStyles, PRODUCT_NAME, renderHeader, renderFooter, renderWordmark, type Page } from "./theme";
import type {
  ActivityFilters,
  Channel,
  DashboardStats,
  RecentEventRow,
  RecentMessageRow,
  ReplyStatsRow,
  Rule
} from "./types";

export type DashboardData = {
  view?: Page;
  featuredProduct?: Product | null;
  channelActivity?: ChannelActivity[];
  tiktokActivity?: TikTokEvent[];
  dryRun: boolean;
  localPreview: boolean;
  rules: Rule[];
  recentEvents: RecentEventRow[];
  messageEvents: RecentMessageRow[];
  // The latest outgoing DMs, from the Sent DMs query.
  recentDms: SentDmRow[];
  replyStats: ReplyStatsRow[];
  stats: DashboardStats;
  connection: InstagramTokenStatus;
  dmFeatures: DmFeatureSettings;
  publication: IceBreakersPublicationStatus;
  // The connected Instagram username (or OWNER_IG_USERNAME), without "@".
  accountUsername: string | null;
  filters: ActivityFilters;
  flash: string | null;
};

const icons: Record<string, string> = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};

function icon(name: string, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.arrow}</svg>`;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function number(value: number): string {
  return Number(value ?? 0).toLocaleString("ar-LY");
}

function plural(value: number, singular: string, pluralForm: string): string {
  return `${number(value)} ${value === 1 ? singular : pluralForm}`;
}

function tag(text: string, tone = ""): string {
  return `<span class="tag ${tone}">${esc(text)}</span>`;
}

function time(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? esc(value)
    : `<time datetime="${esc(date.toISOString())}" title="${esc(date.toISOString())}">${esc(date.toLocaleString("ar-LY", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }))} UTC</time>`;
}

function figure(label: string, value: number, detail: string, tone = ""): string {
  return `<div class="figure ${tone}"><dt>${esc(label)}</dt><dd class="figure-value">${number(value)}</dd><dd class="figure-detail">${esc(detail)}</dd></div>`;
}

const CHANNEL_OPTIONS: Array<[Channel, string, string]> = [
  ["comments", "التعليقات", "على أي منشور لك"],
  ["dms", "الرسائل الخاصة", "عندما تصلك رسالة"],
  ["stories", "ردود القصص", "عندما يصلك رد على قصة"]
];

function channelSummary(channels: Channel[]): string {
  return CHANNEL_OPTIONS.filter(([value]) => channels.includes(value)).map(([, title]) => title).join(", ");
}

// The hidden empty value tells the server the picker was on the page, so
// unchecking every box is an error instead of "use the default".
function channelPicker(selected: Channel[]): string {
  return `<fieldset class="channel-picker"><legend>مصدر التفاعل</legend><input type="hidden" name="channels" value=""><div class="channels">${CHANNEL_OPTIONS.map(([value, title, hint]) => `<label class="channel"><input type="checkbox" name="channels" value="${value}" ${selected.includes(value) ? "checked" : ""}><span><strong>${title}</strong><small>${hint}</small></span></label>`).join("")}</div></fieldset>`;
}

export function renderDashboardPage(data: DashboardData): string {
  const view = data.view ?? "overview";
  const active = data.rules.filter((rule) => rule.active).length;
  const handle = data.accountUsername ? `@${data.accountUsername}` : "";
  const mode = `<span class="mode ${data.dryRun ? "test" : ""}"><i></i>${data.dryRun ? "وضع الاختبار" : "مباشر"}</span>`;
  const replyOptions: ReplyOption[] = [
    ...data.rules.map((rule) => ({
      key: ruleReplyKey(rule.id),
      label: rule.label,
      group: "rule" as const,
      detail: rule.active ? "" : "متوقف"
    })),
    ...data.dmFeatures.customReplies.map((reply) => ({
      key: customReplyKey(reply.id),
      label: reply.label,
      group: "text" as const,
      detail: ""
    }))
  ];
  const firstRule = data.rules.find((rule) => rule.active) ?? data.rules[0];
  const notices = [
    data.flash ? `<div class="flash" role="status">${esc(data.flash)}</div>` : "",
    data.localPreview ? `<div class="notice"><strong>معاينة محلية.</strong> الأرقام والإعدادات من قاعدة البيانات التجريبية المحلية.${data.dryRun ? " وضع الاختبار مفعّل؛ تُسجّل المطابقات دون إرسال رسائل." : ""}</div>` : "",
    data.dryRun && !data.localPreview ? '<div class="notice">وضع الاختبار مفعّل. تُسجّل المطابقات دون إرسال رسائل.</div>' : "",
    data.connection.needsReconnect || data.connection.state === "error"
      ? `<div class="notice" role="alert"><strong>يلزم التحقق من اتصال إنستغرام.</strong> ${esc(data.connection.error ?? "تحقق من الاتصال.")} <a href="/admin/advanced#connection">عرض الاتصال</a></div>`
      : ""
  ].filter(Boolean).join("");
  return `<!doctype html><html lang="ar" dir="rtl" data-palette="studio"><head><meta charset="utf-8">${appearanceHead}<meta name="viewport" content="width=device-width, initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>${PRODUCT_NAME} · إدارة المحادثات</title><style>${baseStyles}${formStyles}${headerStyles}${styles}${sectionStyles}${sentRowStyles}${dmFeaturesStyles}${view === "overview" ? botPreviewStyles : ""}</style><link rel="stylesheet" href="/reply-studio.css?v=5">${appearanceStyles}</head><body class="dashboard-page view-${view}">
  <a class="skip" href="#main">انتقل إلى المحتوى</a>
  ${renderHeader(view, mode)}
  <main id="main" class="shell">
    ${notices ? `<div class="notices">${notices}</div>` : ""}
    <section id="overview" class="overview" aria-labelledby="overview-title">
      <div class="page-head"><h1 id="overview-title">نظرة عامة</h1>${handle ? `<span>${esc(handle)}</span>` : ""}</div>
      ${view === "overview" ? `<div class="overview-lead"><p>المخزن، الردود، وحساباتك.<br>تحكّم فيها من مكان واحد.</p><a class="button primary" href="/admin/settings?tab=accounts">اربط حساباتك ${icon("arrow")}</a></div><div class="reply-stage"><div class="stage-inner"><div class="stage-story"><h2>كود واحد.<br>والرد حاضر.</h2><p>جرّب الرد الحقيقي من مخزنك.<br>صورة المنتج، اسمه وسعره.</p>${data.featuredProduct ? `<button type="button" class="button stage-try" data-try-message="${esc(data.featuredProduct.code)}">جرّب ${esc(data.featuredProduct.code)} ${icon("arrow")}</button><span class="stage-product">${esc(data.featuredProduct.name)} · ${esc(formatProductPrice(data.featuredProduct))}</span>` : '<a href="/admin/products" class="button stage-try">أضف أول منتج</a>'}<small>تجربة داخل النظام؛ لا تُرسل رسائل لحساباتك.</small></div>${renderBotPreview("product")}</div></div><div class="overview-section-head"><h2>النشاط بالأرقام</h2><a class="text-link" href="/admin/activity">عرض النشاط ${icon("arrow")}</a></div>` : ""}
      <dl class="figures" aria-label="${data.localPreview ? "بيانات تجريبية محلية" : "إجمالي النشاط"}">
        ${figure("الرسائل المرسلة", data.stats.sent, data.dryRun ? `مطابقات تجريبية: ${number(data.stats.testMatches)}` : "الإجمالي · التعليقات والرسائل")}
        ${figure("الوارد", data.stats.comments + data.stats.messages, `${`تعليقات: ${number(data.stats.comments)}`} · ${`رسائل: ${number(data.stats.messages)}`}`)}
        ${figure("الأخطاء", data.stats.errors, data.stats.errors ? "رسائل أو ردود علنية تعذّر إرسالها" : "لا توجد أخطاء", data.stats.errors ? "danger" : "")}
        ${figure("الأتمتة المفعّلة", active, `من ${number(data.rules.length)}`)}
      </dl>
    </section>
    <section id="recent" class="block" aria-labelledby="recent-title">
      <div class="block-head"><h2 id="recent-title">أحدث الرسائل</h2><a class="link" href="/admin/sent">كل الرسائل المرسلة ${icon("arrow")}</a></div>
      ${data.recentDms.length ? `<div class="recent-dms">${renderSentRows(data.recentDms)}</div>` : `<p class="empty">${data.dryRun ? "لم تُرسل رسائل بعد. تظهر مطابقات الاختبار في قسم النشاط." : "لم تُرسل رسائل بعد."}</p>`}
    </section>
    <section id="automations" class="block" aria-labelledby="automations-title">
      <div class="block-head"><div><h1 id="automations-title">الأتمتة</h1><p class="block-sub">أرسل ردًا خاصًا عند ورود كلمة مفتاحية في تعليق أو رسالة أو رد على قصة.</p></div><button class="button secondary" type="button" data-new-rule>${icon("plus")}أتمتة جديدة</button></div>
      <div class="automations-layout">
        <div class="auto-list">${data.rules.map((rule) => ruleRow(rule, data.replyStats.find((row) => row.key === ruleReplyKey(rule.id)))).join("")}
        ${data.rules.length ? "" : '<div class="empty">لا توجد أتمتة بعد. <button class="text-link" type="button" data-new-rule>أنشئ أول أتمتة</button></div>'}</div>
        ${previewPanel(firstRule)}
      </div>
    </section>
    <section id="performance" class="block performance" aria-labelledby="performance-title"><div class="block-head"><div><h1 id="performance-title">إحصاءات الردود</h1><p class="block-sub">${data.localPreview ? "بيانات تجريبية محلية." : "الإجمالي لكل أتمتة ورد مخصص."}</p></div></div>${analytics(data.replyStats, data.rules)}</section>
    <section id="activity" class="block activity" aria-labelledby="activity-title"><div class="block-head"><div><h1 id="activity-title">النشاط</h1><p class="block-sub">كل التعليقات والرسائل الواردة، بما فيها التي لم تطابق أتمتة.</p></div><span class="activity-links"><a class="link" href="/admin/stats">إحصاءات الردود</a><a class="link" href="/admin/sent">الرسائل المرسلة فقط</a><a class="link quiet" href="/admin/activity">تحديث</a></span></div>
      <div class="connected-activity"><h2>تعليقات TikTok</h2>${data.tiktokActivity?.length ? `<div class="events">${data.tiktokActivity.map(row=>`<article class="event"><div class="event-body"><div class="event-title"><strong translate="no">${esc(row.username??"عميل")} · ${esc(row.display_name)}</strong>${time(row.received_at)}</div><p translate="no">${esc(row.text)}</p>${row.reply_text?`<p class="channel-reply">${esc(row.reply_text)}</p>`:""}${row.error?`<p class="notice">${esc(row.error)}</p>`:""}</div>${status(({test:"dry_run_matched",error:"send_error",ignored:"ignored_no_match"} as Record<string,string>)[row.status]??row.status)}</article>`).join("")}</div>`:'<p class="empty">اربط حساب تيك توك وفعّل المتابعة من الإعدادات لعرض التعليقات والردود هنا.</p>'}</div><div class="connected-activity"><h2>رسائل الحسابات المربوطة</h2>${data.channelActivity?.length ? `<div class="events">${data.channelActivity.map(row => `<article class="event"><div class="event-body"><div class="event-title"><strong>${esc(row.display_name)} · ${PLATFORM_NAMES[row.platform]}</strong>${time(row.received_at)}</div><p translate="no">${esc(row.text)}</p>${productImagePath(row.reply_image_id) ? `<img class="channel-photo" src="${productImagePath(row.reply_image_id)}" width="120" height="120" loading="lazy" alt="صورة المنتج المرسلة">` : ""}${row.error ? `<p class="notice">${esc(row.error)}</p>` : ""}${row.reply_text ? `<p class="channel-reply">${esc(row.reply_text)}</p>` : ""}</div>${status(({test:"dry_run_matched",error:"send_error",ignored:"ignored_no_match",expired:"ignored_expired"} as Record<string,string>)[row.status] ?? row.status)}</article>`).join("")}</div>` : '<p class="empty">تظهر هنا الرسائل بعد ربط حساب من الإعدادات واستقبال أول رسالة.</p>'}</div><h2 class="legacy-activity-title">نشاط إنستغرام المتقدم</h2><div class="activity-tabs" role="tablist" aria-label="نوع النشاط"><button id="comments-tab" type="button" role="tab" aria-selected="true" aria-controls="comment-activity" data-tab="comment-activity">التعليقات <span>${data.recentEvents.length}</span></button><button id="messages-tab" type="button" role="tab" aria-selected="false" aria-controls="message-activity" data-tab="message-activity" tabindex="-1">الرسائل الخاصة <span>${data.messageEvents.length}</span></button></div>
      <div id="comment-activity" role="tabpanel" aria-labelledby="comments-tab">${filters(data.filters)}${comments(data.recentEvents, data.dryRun)}</div>
      <div id="message-activity" role="tabpanel" aria-labelledby="messages-tab" hidden><p class="field-help list-note">آخر 30 رسالة وتفاعل مع أزرار بدء المحادثة والقصص والروابط. تُطبّق الفلاتر على التعليقات فقط.</p>${messages(data.messageEvents)}</div>
    </section>
    <div id="settings" class="settings">
      <div class="block-head"><div><h1>أدوات إنستغرام المتقدمة</h1><p class="block-sub">أدوات المراسلة والردود المخصصة والاتصال بإنستغرام.</p></div></div>
      ${renderDmFeaturesPanel({
        settings: data.dmFeatures,
        publication: data.publication,
        options: replyOptions,
        username: data.accountUsername,
        dryRun: data.dryRun
      })}
      ${connectionPanel(data.connection, data.dryRun)}
    </div>
  </main>
  ${renderFooter()}
  ${newRuleDialog(data.rules, data.accountUsername)}<script>${dashboardInlineScript(view)}</script></body></html>`;
}

export function dashboardInlineScript(view: Page): string {
  return clientScript + newRuleScript + dmFeaturesClientScript + (view === "overview" ? botPreviewScript : "");
}

function connectionPanel(connection: InstagramTokenStatus, dryRun: boolean): string {
  const label = dryRun ? "وضع الاختبار" : connection.state === "healthy" ? "متصل" : connection.needsReconnect ? "يلزم إعادة الربط" : connection.state === "error" ? "تعذّر التحقق" : "لم يُفحص بعد";
  return `<section id="connection" class="setting connection-panel" aria-labelledby="connection-title">
    <div class="setting-intro"><h3 id="connection-title">الاتصال بإنستغرام</h3><p>${dryRun ? "فحص الاتصال وتجديد رمز الوصول متوقفان في وضع الاختبار." : "يُفحص يوميًا ويُجدّد رمز الوصول تلقائيًا قبل انتهائه."}</p>${tag(label, !dryRun && connection.state === "healthy" ? "ok" : "warn")}</div>
    <div class="setting-body">
      ${connection.username ? `<p class="connection-handle">@${esc(connection.username)}</p>` : ""}
      ${connection.error ? `<p class="notice" role="status">${esc(connection.error)}</p>` : ""}
      <dl class="connection-dates"><div><dt>آخر فحص</dt><dd>${connection.lastCheckedAt ? time(connection.lastCheckedAt) : "لم يحدث بعد"}</dd></div><div><dt>آخر تجديد</dt><dd>${connection.lastRefreshedAt ? time(connection.lastRefreshedAt) : "لم يحدث بعد"}</dd></div><div><dt>التجديد القادم</dt><dd>${connection.nextRefreshAt ? time(connection.nextRefreshAt) : "بعد أول فحص"}</dd></div><div><dt>انتهاء رمز الوصول</dt><dd>${connection.expiresAt ? time(connection.expiresAt) : "يتحدد بعد أول تجديد"}</dd></div></dl>
      <div class="form-actions"><a class="text-link" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">فتح إعدادات Meta ${icon("external")}</a><form action="/admin/connection/check" method="post"><button class="button secondary" ${dryRun ? "disabled" : ""}>فحص الاتصال</button></form></div>
    </div>
  </section>`;
}

function previewHref(url: string | null): string {
  try {
    if (url && new URL(url).protocol === "https:") return `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;
  } catch { /* An invalid link is shown without a target. */ }
  return "";
}

type ReplyPreview = {
  title: string; keyword: string; text: string; source: string; active: boolean; comments: boolean;
  publicReply: string; buttons: Array<{ title: string; url: string }>;
};

function rulePreview(rule: Rule): ReplyPreview {
  return {
    title: rule.label,
    keyword: rule.keywords[0]?.toUpperCase() ?? "",
    text: rule.replyText,
    source: `${channelSummary(rule.channels)} ← رسالة خاصة`,
    active: rule.active,
    comments: rule.channels.includes("comments"),
    publicReply: rule.publicReplyText ?? "",
    buttons: rule.linkUrl && rule.linkButtonLabel ? [{ title: rule.linkButtonLabel, url: rule.linkUrl }] : []
  };
}

function autoSummary(rule: Rule, sent: number): string {
  return `<span class="auto-name"><strong translate="no">${esc(rule.label)}</strong><span>${esc(channelSummary(rule.channels))}</span></span><span class="auto-keys">${rule.keywords.map((key) => esc(key.toUpperCase())).join('<span class="sep">, </span>')}</span><span class="auto-sent">${number(sent)} مُرسل</span><span class="auto-state ${rule.active ? "on" : ""}">${rule.active ? "مفعّل" : "متوقف"}</span>${icon("chevron", "chevron")}`;
}

function ruleRow(rule: Rule, stats?: ReplyStatsRow): string {
  return `<details class="auto rule-card ${rule.active ? "" : "paused"}" data-preview="${esc(JSON.stringify(rulePreview(rule)))}"><summary>${autoSummary(rule, stats?.sent ?? 0)}</summary>
    <form action="/admin/rules/${rule.id}" method="post" class="auto-edit"><div class="two-fields"><label>الاسم<input name="label" value="${esc(rule.label)}" required maxlength="100"></label><label>الكلمات المفتاحية<input name="keywords" value="${esc(rule.keywords.join(", "))}" required></label></div>${channelPicker(rule.channels)}
    <label>نص الرسالة الخاصة<textarea name="reply_text" rows="3" required>${esc(rule.replyText)}</textarea><span class="field-help">حتى 1,000 حرف، أو 640 حرفًا مع زر.</span></label><label>الرد العلني على التعليق <span class="optional">اختياري · صيغة واحدة في كل سطر · للتعليقات فقط</span><textarea name="public_reply_text" rows="2">${esc(rule.publicReplyText ?? "")}</textarea></label><div class="two-fields"><label>رابط الزر<input name="link_url" type="url" value="${esc(rule.linkUrl ?? "")}" placeholder="https://…"></label><label>عنوان الزر<input name="link_button_label" value="${esc(rule.linkButtonLabel ?? "")}" maxlength="20" placeholder="اقرأ المزيد"></label></div><div class="form-actions"><label class="switch-label"><input type="checkbox" name="active" ${rule.active ? "checked" : ""}><span class="switch"></span>مفعّل</label><div><button class="button danger" name="action" value="delete" formnovalidate data-delete>حذف</button><button class="button primary" name="action" value="save">حفظ التعديلات</button></div></div></form></details>`;
}

// Chat-style preview of the selected automation. The client script updates it as you edit.
function previewPanel(rule: Rule | undefined): string {
  const preview = rule ? rulePreview(rule) : null;
  const publicReplies = preview?.comments ? preview.publicReply.split("\n").map((line) => line.trim()).filter(Boolean) : [];
  return `<aside class="preview-panel" id="reply-preview" aria-label="معاينة الرد"><div class="preview-heading"><span id="preview-heading">${esc(preview?.title ?? "معاينة الرد")}</span><span class="preview-tag">معاينة</span></div>
    <div class="chat"><div class="chat-date" id="preview-source">${esc(preview?.source ?? "تعليق ← رسالة خاصة")}</div><div class="incoming"><span id="preview-keyword">${esc(preview?.keyword || "الكلمة")}</span></div>
      <div class="chat-reply"><div id="preview-message" class="bubble">${esc(preview?.text ?? "سيظهر نص رسالتك هنا.")}</div><div class="chat-buttons" id="preview-buttons">${(preview?.buttons ?? []).map((button) => `<a ${previewHref(button.url)}>${esc(button.title)} ↗</a>`).join("")}</div></div>
      <div class="public-preview" id="preview-public" ${publicReplies.length ? "" : "hidden"}><span id="preview-public-label">${publicReplies.length > 1 ? `رد علني · 1 من ${publicReplies.length}` : "الرد العلني"}</span><p id="preview-public-text">${esc(publicReplies[0] ?? "")}</p></div></div>
    <p class="preview-note" id="preview-note">${preview ? (preview.active ? "تتحدث المعاينة أثناء التعديل دون إرسال." : "هذه الأتمتة متوقفة ولن ترسل ردودًا.") : "أنشئ أتمتة لمعاينة الرد."}</p></aside>`;
}

function analytics(rows: ReplyStatsRow[], rules: Rule[]): string {
  if (!rows.length) return '<p class="empty">لا توجد أتمتة بعد.</p>';
  const source = (row: ReplyStatsRow): string => {
    if (row.kind === "text") return "رد مخصص · رسائل خاصة";
    if (row.kind === "fallback") return "الرد الاحتياطي · تعليقات";
    const rule = rules.find((item) => ruleReplyKey(item.id) === row.key);
    return `الكلمة المفتاحية · ${rule ? channelSummary(rule.channels) : "التعليقات"}`;
  };
  return `<div class="table-scroll"><table><thead><tr><th>الأتمتة</th><th>مطابقات التعليقات</th><th>مطابقات الرسائل</th><th>الرسائل المرسلة</th><th>الأخطاء</th><th>آخر إرسال</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.label)}</strong><div class="table-sub">${esc(source(row))}</div></td><td>${row.kind === "text" ? '<span class="muted">—</span>' : number(row.commentMatches)}</td><td>${row.kind === "fallback" ? '<span class="muted">—</span>' : number(row.dmMatches)}</td><td><span class="sent-value">${number(row.sent)}</span></td><td>${row.errors ? `<span class="error-value">${number(row.errors)}</span>` : '<span class="muted">0</span>'}</td><td class="muted">${row.lastSentAt ? time(row.lastSentAt) : "لم يُرسل بعد"}</td></tr>`).join("")}</tbody></table></div><p class="field-help table-foot">تشمل المطابقات الاختبارات وأزرار المحادثة والقصص والروابط. يشمل عدد الرسائل المرسلة ما تم تسليمه فقط.</p>`;
}

function filters(value: ActivityFilters): string {
  const options = [["", "كل الحالات"], ["sent", "تم الإرسال"], ["error", "الأخطاء"], ["dry_run_matched", "مطابقات تجريبية"], ["ignored_no_keyword", "لا توجد كلمة مطابقة"], ["ignored_owner", "تعليقاتك"]];
  return `<form class="filters" action="/admin/activity" method="get"><label>الحالة<select name="status">${options.map(([key, name]) => `<option value="${key}" ${value.status === key ? "selected" : ""}>${name}</option>`).join("")}</select></label><label>الكلمة المفتاحية<input name="keyword" value="${esc(value.keyword)}" placeholder="أي كلمة مفتاحية"></label><label>اسم المستخدم<input name="username" value="${esc(value.username)}" placeholder="@reader"></label><label>التاريخ (UTC)<input name="date" type="date" value="${esc(value.date)}"></label><button class="button secondary">تطبيق</button><a href="/admin/activity" class="text-link">مسح الفلاتر</a></form>`;
}

const STATUS_NAMES: Record<string, string> = {
  sent: "تم الإرسال", sent_public_reply_error: "تعذّر إرسال الرد العلني", send_error: "تعذّر الإرسال", dry_run_matched: "مطابقة تجريبية",
  ignored_no_keyword: "لا توجد كلمة مطابقة", ignored_no_match: "لا توجد مطابقة", ignored_owner: "تعليقك", ignored_self: "رسالتك",
  ignored_paused: "متوقف", ignored_expired: "انتهت مهلة الرد", ignored_recipient: "حساب آخر",
  ignored_invalid: "وقت الرسالة غير صالح", ignored_missing_reply: "الرد محذوف", received: "الوارد", retrying: "جارٍ إعادة المحاولة"
};

function status(value: string): string {
  const tone = value === "sent" ? "ok" : value.includes("error") ? "danger" : value === "dry_run_matched" ? "warn" : "";
  return `<span class="status ${tone}">${esc(STATUS_NAMES[value] ?? value.replace(/_/g, " "))}</span>`;
}

function comments(rows: RecentEventRow[], dryRun: boolean): string {
  if (!rows.length) return '<p class="empty">لا توجد تعليقات مطابقة. تظهر التعليقات عند وصولها من إنستغرام؛ امسح الفلاتر لعرض الكل.</p>';
  return `<div class="events">${rows.map((row) => `<article class="event"><div class="event-body"><div class="event-title"><strong>${esc(row.username ? "@" + row.username : "مستخدم غير معروف")}</strong>${time(row.received_at)}</div><p translate="no">${esc(row.comment_text)}</p><span class="event-rule">${esc(row.rule_label ?? "دون أتمتة")}${row.matched_keyword ? ` <span>· ${esc(row.matched_keyword.toUpperCase())}</span>` : ""}</span>${row.error ? `<details class="error-details"><summary>عرض الخطأ</summary><p>${esc(row.error)}</p></details>` : ""}</div><div class="event-state">${status(row.status)}${!dryRun && (row.status === "send_error" || row.status === "sent_public_reply_error") ? `<form action="/admin/events/${encodeURIComponent(row.comment_id)}/retry" method="post"><button class="text-link">${row.status === "sent_public_reply_error" ? "إعادة إرسال الرد العلني" : "إعادة الإرسال"}</button></form>` : ""}</div></article>`).join("")}</div><p class="field-help list-foot">آخر ${number(rows.length)} تعليقًا مطابقًا (حتى 50).</p>`;
}

function messages(rows: RecentMessageRow[]): string {
  if (!rows.length) return '<p class="empty">لا توجد رسائل بعد. فعّل إشعارات messages وmessaging_postbacks وmessaging_referral لاستقبالها.</p>';
  return `<div class="events">${rows.map((row) => `<article class="event"><div class="event-body"><div class="event-title"><strong>${row.sender_username ? `@${esc(row.sender_username.replace(/^@/, ""))}` : `مستخدم إنستغرام …${esc(row.sender_id.slice(-4))}`}</strong>${time(row.received_at)}</div>${row.message_text ? `<p>${esc(row.message_text)}</p>` : ""}<span class="event-rule">${esc(row.matched_choice ?? "دون أتمتة")}</span>${renderDmMessageContext(row)}${row.error ? `<details class="error-details"><summary>عرض الخطأ</summary><p>${esc(row.error)}</p></details>` : ""}</div><div class="event-state">${status(row.status)}</div></article>`).join("")}</div>`;
}

const RULE_TEMPLATES = [
  { label: "كتاب أو منتج", name: "رابط المنتج", keyword: "رابط", message: "تفضل الرابط، شكرًا لتواصلك!", button: "افتح الرابط" },
  { label: "دليل مجاني", name: "دليل مجاني", keyword: "دليل", message: "تفضل الدليل المجاني، نتمنى لك الاستفادة!", button: "احصل على الدليل" },
  { label: "فعالية أو ورشة", name: "التسجيل في الفعالية", keyword: "انضم", message: "تفضل التفاصيل ورابط التسجيل.", button: "احجز مكاني" },
  { label: "قائمة الانتظار", name: "قائمة الانتظار", keyword: "انتظار", message: "انضم إلى قائمة الانتظار من الرابط التالي.", button: "انضم لقائمة الانتظار" },
  { label: "حلقة بودكاست", name: "حلقة بودكاست", keyword: "حلقة", message: "تفضل الحلقة الكاملة.", button: "استمع الآن" }
];
const SUGGESTED_PUBLIC_REPLIES = ["أرسلنا لك الرابط", "راجع رسائلك الخاصة", "تم الإرسال، تفضل بمراجعة الخاص", "الرابط في رسائلك الخاصة", "حاضر، راجع الخاص"];

function newRuleDialog(rules: Rule[], username: string | null): string {
  // Keywords of automations that are on, per channel. Paused automations may share a keyword.
  const taken: Record<string, Array<{ label: string; channels: Channel[] }>> = {};
  for (const rule of rules.filter((item) => item.active)) {
    for (const keyword of rule.keywords) (taken[keyword.trim().toLowerCase()] ??= []).push({ label: rule.label, channels: rule.channels });
  }
  const you = username?.replace(/^@/, "") || "yourhandle";
  return `<dialog id="new-rule" class="new-rule" aria-labelledby="new-rule-title" data-taken="${esc(JSON.stringify(taken))}" data-suggested="${esc(JSON.stringify(SUGGESTED_PUBLIC_REPLIES))}">
  <form method="post" action="/admin/rules" class="new-rule-form">
    <div class="dialog-heading"><div><h2 id="new-rule-title">أتمتة جديدة</h2><p class="dialog-sub">حدد كلمة مفتاحية ومصدر التفاعل. يتلقى العميل رسالتك عند إرسالها.</p></div><button class="close-dialog" aria-label="إغلاق" type="button">×</button></div>
    <div class="templates" role="group" aria-label="ابدأ بقالب"><span class="templates-label">ابدأ بقالب</span>${RULE_TEMPLATES.map((template) => `<button type="button" class="template" aria-pressed="false" data-template="${esc(JSON.stringify(template))}">${esc(template.label)}</button>`).join("")}<button type="button" class="template" aria-pressed="true" data-template="{}">بدون قالب</button></div>
    <div class="new-rule-grid">
      <div class="new-rule-fields">
        <fieldset class="step"><legend>شرط التشغيل</legend>
          <label>الكلمة المفتاحية<input name="keywords" id="nr-keywords" placeholder="دليل" required autocomplete="off" autocapitalize="characters"><span class="field-help">افصل الكلمات بفاصلة عادية أو عربية. لا فرق بين الحروف الكبيرة والصغيرة.</span></label>
          ${channelPicker(["comments"])}
          <p class="field-error" id="nr-keyword-error" role="alert" hidden></p>
          <div class="tester"><label>جرّب رسالة<input id="nr-test" placeholder="دليل من فضلك" autocomplete="off"></label><p class="tester-result" id="nr-test-result" aria-live="polite">أضف كلمة مفتاحية ثم جرّب رسالة للتحقق من تشغيل الرد.</p></div>
          <p class="field-help">تعمل الرسائل القصيرة التي تركز على الكلمة المفتاحية. مثل «دليل من فضلك»، بخلاف الحديث المطوّل عنها.</p>
        </fieldset>
        <fieldset class="step"><legend>الرسالة التي يستلمها العميل</legend>
          <label>الرسالة<textarea name="reply_text" id="nr-message" rows="4" required placeholder="تفضل الرابط…"></textarea><span class="field-help counter" id="nr-message-count">0 / 1,000</span></label>
          <div class="two-fields"><label>نص الزر <span class="optional">اختياري</span><input name="link_button_label" id="nr-button" maxlength="20" placeholder="افتح الرابط"></label><label>رابط الزر<input name="link_url" id="nr-link" type="url" inputmode="url" placeholder="https://…"></label></div>
          <p class="field-error" id="nr-button-error" role="alert" hidden></p>
        </fieldset>
        <fieldset class="step" id="nr-public-step"><legend>الرد العلني <span class="optional">اختياري، للتعليقات فقط</span></legend>
          <label class="sr-only" for="nr-public">الرد العلني</label><textarea name="public_reply_text" id="nr-public" rows="3" placeholder="رد واحد في كل سطر"></textarea>
          <div class="step-help"><span class="field-help">يُنشر تحت التعليق. عند إدخال عدة صيغ يختار النظام إحداها لكل تعليق.</span><button type="button" class="text-link" id="nr-suggest">استخدم الردود المقترحة</button></div>
        </fieldset>
        <fieldset class="step"><legend>الاسم</legend>
          <label class="sr-only" for="nr-name">الاسم</label><input name="label" id="nr-name" maxlength="100" required placeholder="اسم يظهر في لوحة الإدارة">
        </fieldset>
      </div>
      <aside class="new-rule-preview" aria-label="معاينة">
        <p class="preview-label">معاينة</p>
        <div id="nrp-as-comment"><div class="ig-comment"><span class="ig-avatar" aria-hidden="true"></span><p><strong>عميل</strong> <span id="nrp-comment">الكلمة</span></p></div>
        <div class="ig-comment ig-reply" id="nrp-public-wrap" hidden><span class="ig-avatar you" aria-hidden="true"></span><p><strong>${esc(you)}</strong> <span id="nrp-public"></span></p></div>
        <p class="preview-divider">ثم في رسائله الخاصة</p></div>
        <div id="nrp-as-dm" hidden><p class="preview-divider" id="nrp-dm-caption">في الرسائل الخاصة</p><div class="incoming" id="nrp-dm-text">الكلمة</div></div>
        <div class="chat-reply"><div class="bubble" id="nrp-message">سيظهر نص رسالتك هنا.</div><div class="chat-buttons"><a id="nrp-button" hidden></a></div></div>
        <p class="preview-status" id="nrp-status"></p>
      </aside>
    </div>
    <p class="dialog-more">أزرار المحادثات الجديدة وقواعد القصص وروابط الردود موجودة في <a href="/admin/advanced" data-close-dialog>الإعدادات</a>.</p>
    <div class="dialog-footer"><label class="switch-label"><input name="active" type="checkbox" checked><span class="switch"></span>تفعيل الآن</label><div><button type="button" class="button secondary" data-close-dialog>إلغاء</button><button class="button primary">إنشاء الأتمتة</button></div></div>
  </form>
</dialog>`;
}

// The message tester runs the server's own matcher, embedded from its source.
const newRuleScript = `
(() => {
  const keywordMatch = (${keywordMatch.toString()});
  const dialog = document.getElementById('new-rule');
  const form = dialog.querySelector('form');
  const taken = JSON.parse(dialog.dataset.taken || '{}');
  const suggested = JSON.parse(dialog.dataset.suggested || '[]').join(String.fromCharCode(10));
  const field = id => document.getElementById(id);
  const keywords = field('nr-keywords'), test = field('nr-test'), message = field('nr-message');
  const button = field('nr-button'), link = field('nr-link'), publicReply = field('nr-public'), name = field('nr-name');
  const turnOn = form.elements.namedItem('active');
  const reasons = { missing: 'الكلمة المفتاحية غير موجودة ككلمة مستقلة.', too_long: 'الرسالة طويلة؛ يلزم إرسال رسالة قصيرة.', extra_words: 'الرسالة تتضمن كلمات إضافية كثيرة.' };
  const channelNames = { comments: 'التعليقات', dms: 'الرسائل الخاصة', stories: 'ردود القصص' };
  const channelBoxes = [...form.querySelectorAll('input[type="checkbox"][name="channels"]')];
  let templateName = '';
  let nameEdited = false;
  const list = () => keywords.value.split(/[,،]/).map(item => item.trim()).filter(Boolean);
  const show = (element, text) => { element.textContent = text; element.hidden = !text; };
  function update() {
    const items = list();
    const channels = channelBoxes.filter(box => box.checked).map(box => box.value);
    channelBoxes[0].setCustomValidity(channels.length ? '' : 'اختر مصدر تفاعل واحدًا على الأقل.');
    let keywordProblem = '';
    for (const item of items) {
      if (keywordMatch(item, item).reason === 'missing') { keywordProblem = '“' + item + '” لن تطابق أي رسالة. استخدم حروفًا أو أرقامًا.'; break; }
      if (keywordMatch(item, item).reason === 'too_long') { keywordProblem = '“' + item + '” طويلة جدًا. استخدم ثماني كلمات أو أقل.'; break; }
      const clash = turnOn.checked && (taken[item.toLowerCase()] || []).find(rule => rule.channels.some(channel => channels.includes(channel)));
      if (clash) {
        const shared = clash.channels.filter(channel => channels.includes(channel)).map(channel => channelNames[channel]).join(' و');
        keywordProblem = item.toUpperCase() + ' مستخدمة بالفعل في «' + clash.label + '» في ' + shared + '. اختر كلمة أو مصدر تفاعل آخر.';
        break;
      }
    }
    show(field('nr-keyword-error'), keywordProblem);
    keywords.setCustomValidity(keywordProblem);
    field('nr-public-step').hidden = !channels.includes('comments');

    const sample = test.value.trim();
    const result = field('nr-test-result');
    if (!items.length) { result.textContent = 'أضف كلمة مفتاحية ثم جرّب رسالة للتحقق من تشغيل الرد.'; result.className = 'tester-result'; }
    else if (!sample) { result.textContent = 'اكتب رسالة لتجربة تشغيل الرد.'; result.className = 'tester-result'; }
    else {
      const results = items.map(item => keywordMatch(sample, item));
      const hit = results.find(item => item.match);
      const closest = results.find(item => item.reason !== 'missing') || results[0];
      result.textContent = hit ? '✓ سيتم إرسال الرد لهذه الرسالة.' : '✕ لن تُرسل رسالة لأن ' + reasons[closest.reason];
      result.className = 'tester-result ' + (hit ? 'yes' : 'no');
    }

    const buttonText = button.value.trim(), url = link.value.trim();
    const limit = buttonText || url ? 640 : 1000;
    const count = message.value.trim().length;
    const counter = field('nr-message-count');
    counter.textContent = count.toLocaleString() + ' / ' + limit.toLocaleString() + (limit === 640 ? ' مع زر' : '');
    counter.classList.toggle('over', count > limit);
    message.setCustomValidity(count > limit ? 'الحد الأقصى للرسالة ' + limit.toLocaleString() + ' حرفًا' + (limit === 640 ? ' عند إضافة زر.' : '.') : '');

    let validUrl = false;
    try { validUrl = new URL(url).protocol === 'https:'; } catch {}
    const buttonProblem = buttonText && !url ? 'أضف الرابط الذي يفتحه الزر.'
      : url && !buttonText ? 'أضف نصًا للزر، مثل «افتح الرابط».'
      : url && !validUrl ? 'يجب أن يبدأ الرابط بـ https://' : '';
    show(field('nr-button-error'), buttonProblem);
    button.setCustomValidity(url && !buttonText ? buttonProblem : '');
    link.setCustomValidity((buttonText && !url) || (url && !validUrl) ? buttonProblem : '');

    if (!nameEdited) name.value = templateName || (items[0] ? items[0].charAt(0).toUpperCase() + items[0].slice(1).toLowerCase() : '');

    const shown = sample || (items[0] || 'keyword').toUpperCase();
    const asComment = !channels.length || channels.includes('comments');
    field('nrp-as-comment').hidden = !asComment;
    field('nrp-as-dm').hidden = asComment;
    field('nrp-dm-caption').textContent = channels[0] === 'stories' ? 'رد على قصتك' : 'في الرسائل الخاصة';
    field('nrp-dm-text').textContent = shown;
    field('nrp-comment').textContent = shown;
    field('nrp-message').textContent = message.value.trim() || 'سيظهر نص رسالتك هنا.';
    const previewButton = field('nrp-button');
    previewButton.hidden = !buttonText;
    previewButton.textContent = buttonText + ' ↗';
    const replies = publicReply.value.split(String.fromCharCode(10)).map(item => item.trim()).filter(Boolean);
    field('nrp-public-wrap').hidden = !replies.length || !channels.includes('comments');
    field('nrp-public').textContent = replies[0] || '';
    field('nrp-status').textContent = sample && items.length && !result.classList.contains('yes') ? 'لن تستلم هذه الرسالة ردًا آليًا.' : replies.length > 1 && channels.includes('comments') ? 'الرد العلني المعروض 1 من ' + replies.length + '.' : '';
  }
  name.addEventListener('input', () => { nameEdited = name.value.trim() !== ''; });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  dialog.querySelectorAll('[data-template]').forEach(choice => choice.addEventListener('click', () => {
    const template = JSON.parse(choice.dataset.template);
    dialog.querySelectorAll('[data-template]').forEach(item => item.setAttribute('aria-pressed', String(item === choice)));
    keywords.value = template.keyword || '';
    message.value = template.message || '';
    button.value = template.button || '';
    link.value = '';
    publicReply.value = template.keyword ? suggested : '';
    test.value = '';
    templateName = template.name || '';
    nameEdited = false;
    update();
    (template.keyword ? link : keywords).focus();
  }));
  field('nr-suggest').addEventListener('click', () => { publicReply.value = suggested; update(); });
  document.querySelectorAll('.rule-card form').forEach(editForm => {
    const boxes = [...editForm.querySelectorAll('input[type="checkbox"][name="channels"]')];
    const check = () => boxes[0] && boxes[0].setCustomValidity(boxes.some(box => box.checked) ? '' : 'اختر مصدر تفاعل واحدًا على الأقل.');
    editForm.addEventListener('change', check);
    check();
  });
  dialog.querySelectorAll('[data-close-dialog]').forEach(element => element.addEventListener('click', () => dialog.close()));
  update();
})();
`;

const clientScript = `
const legacySections = { '#settings': '/admin/settings', '#connection': '/admin/advanced#connection', '#automations': '/admin/automations', '#activity': '/admin/activity', '#performance': '/admin/stats', '#messages': '/admin/activity#messages' };
if (location.pathname === '/admin' && legacySections[location.hash]) location.replace(legacySections[location.hash]);

const dialog = document.getElementById('new-rule');
document.querySelectorAll('[data-new-rule]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', event => { if (!confirm(window.ReplyI18n?.t('هل تريد حذف هذه الأتمتة؟') ?? 'هل تريد حذف هذه الأتمتة؟')) event.preventDefault(); }));
const previewPanel = document.getElementById('reply-preview');
const previewMessage = document.getElementById('preview-message');
const previewButtons = document.getElementById('preview-buttons');
const channelTitles = { comments: 'التعليقات', dms: 'الرسائل الخاصة', stories: 'ردود القصص' };
function validPreviewUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } }
function previewLink(title, url) { const link = document.createElement('a'); const href = validPreviewUrl(url); link.textContent = title; if (href) { link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; } return link; }
function showPreview(config) {
  document.getElementById('preview-heading').textContent = config.title || 'معاينة الرد';
  document.getElementById('preview-keyword').textContent = config.keyword || 'الكلمة';
  document.getElementById('preview-source').textContent = config.source;
  previewPanel.setAttribute('aria-label', (config.title || 'الرد') + ' · معاينة');
  previewMessage.textContent = config.text || 'سيظهر نص رسالتك هنا.';
  previewButtons.replaceChildren();
  (config.buttons || []).forEach(button => { if (validPreviewUrl(button.url)) previewButtons.append(previewLink(button.title + ' ↗', button.url)); });
  const publicReplies = config.comments ? (config.publicReply || '').split(String.fromCharCode(10)).map(text => text.trim()).filter(Boolean) : [];
  document.getElementById('preview-public').hidden = !publicReplies.length;
  document.getElementById('preview-public-label').textContent = publicReplies.length > 1 ? 'رد علني · 1 من ' + publicReplies.length : 'الرد العلني';
  document.getElementById('preview-public-text').textContent = publicReplies[0] || '';
  document.getElementById('preview-note').textContent = config.active ? 'تتحدث المعاينة أثناء التعديل دون إرسال.' : 'هذه الأتمتة متوقفة ولن ترسل ردودًا.';
}
function previewRule(card) {
  const config = JSON.parse(card.dataset.preview);
  const form = card.querySelector('form');
  const channels = [...form.querySelectorAll('input[type="checkbox"][name="channels"]:checked')].map(box => box.value);
  config.title = form.elements.namedItem('label').value || 'الرد';
  config.keyword = form.elements.namedItem('keywords').value.split(/[,،]/)[0].trim().toUpperCase();
  config.active = form.elements.namedItem('active').checked;
  config.comments = channels.includes('comments');
  config.source = (channels.map(channel => channelTitles[channel]).join(', ') || 'لم يُحدد المصدر') + ' ← رسالة خاصة';
  config.publicReply = form.elements.namedItem('public_reply_text').value;
  config.text = form.elements.namedItem('reply_text').value;
  config.buttons = [{ title: form.elements.namedItem('link_button_label').value, url: form.elements.namedItem('link_url').value }].filter(button => button.title && button.url);
  showPreview(config);
}
document.querySelectorAll('.rule-card').forEach(card => {
  card.addEventListener('toggle', () => { if (card.open) previewRule(card); });
  card.addEventListener('focusin', () => { if (card.open) previewRule(card); });
  card.addEventListener('input', () => previewRule(card));
  card.addEventListener('change', () => previewRule(card));
});
const tabs = [...document.querySelectorAll('[data-tab]')];
function selectTab(tab) { tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; document.getElementById(item.dataset.tab).hidden = !active; }); }
tabs.forEach((tab, index) => { tab.addEventListener('click', () => selectTab(tab)); tab.addEventListener('keydown', event => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); selectTab(tabs[next]); } }); });
if (location.hash === '#messages' && tabs[1]) selectTab(tabs[1]);
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
navLinks.forEach(link => link.addEventListener('click', () => { navLinks.forEach(item => item === link ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current')); }));
const localTime = new Intl.DateTimeFormat("ar-LY", { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
document.querySelectorAll('main time[datetime]').forEach(element => { const date = new Date(element.dateTime); if (!Number.isNaN(date.getTime())) { element.textContent = localTime.format(date); element.title = date.toLocaleString("ar-LY"); } });
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', () => { form.setAttribute('aria-busy', 'true'); }));
`;

const styles = `
.direction-arrow{transform:scaleX(-1)}
.shell{max-width:1120px;margin:0 auto;padding:0 32px}
.icon{width:16px;height:16px;flex:none;vertical-align:middle}
.muted{color:var(--muted)}
.notices{display:flex;flex-direction:column;gap:8px;padding-top:24px}
.flash{background:var(--accent-soft);color:var(--accent);border-radius:8px;padding:10px 14px;font-size:13px}
.overview{padding-top:48px}
.page-head{display:flex;align-items:baseline;gap:12px;margin-bottom:24px}
.page-head h1{font-size:26px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}
.page-head span{font-size:14px;color:var(--faint)}
.figures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.figure{padding:20px 24px 22px;border-inline-start:1px solid var(--line);min-width:0}
.figure:first-child{border-inline-start:0;padding-inline-start:0}
.figure dt{font-size:13px;color:var(--muted)}
.figure-value{font-size:32px;font-weight:500;letter-spacing:-.03em;line-height:1.2;color:var(--ink);font-variant-numeric:tabular-nums;margin:6px 0 2px}
.figure-detail{font-size:12.5px;color:var(--faint)}
.figure.danger .figure-value{color:var(--danger)}
.block{padding-top:56px}
.block-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
.block-head h2{font-size:17px;font-weight:600;letter-spacing:-.01em;color:var(--ink)}
.block-sub{font-size:13px;color:var(--muted);margin-top:3px}
.link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--accent);white-space:nowrap}
.link:hover{text-decoration:underline;text-underline-offset:3px}
.link.quiet{color:var(--muted);font-weight:400}
.link .icon{width:14px;height:14px}
.empty{color:var(--muted);padding:20px 0;font-size:13.5px;border-top:1px solid var(--line)}
.recent-dms{border-top:1px solid var(--line)}
.recent-dms .dm-row{background:transparent;border:0;border-bottom:1px solid var(--line);border-radius:0;margin:0;padding:14px 0}
.automations-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px;align-items:start}
.auto-list{border-top:1px solid var(--line)}
.auto-list>.empty{border-top:0}
.auto{border-bottom:1px solid var(--line)}
.auto>summary{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 72px 72px 16px;gap:16px;align-items:center;padding:14px 6px;margin:0 -6px;border-radius:6px;cursor:pointer;list-style:none;transition:background .15s}
.auto>summary::-webkit-details-marker{display:none}
.auto>summary:hover{background:#f3f3ef}
.auto-name{display:flex;flex-direction:column;min-width:0}
.auto-name strong{font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auto-name span{font-size:12.5px;color:var(--faint)}
.auto-keys{font-family:var(--mono);font-size:12px;letter-spacing:.02em;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auto-keys .sep{font-family:var(--sans)}
.auto-sent{font-size:13px;color:var(--muted);text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
.auto-state{font-size:13px;color:var(--faint);white-space:nowrap}
.auto-state.on{color:var(--accent)}
.auto-state.on:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-inline-end:7px;vertical-align:2px}
.chevron{width:16px;height:16px;color:var(--faint);transition:transform .2s}
.auto[open] .chevron{transform:rotate(180deg)}
.paused .auto-name strong{color:var(--muted)}
.auto-edit{display:flex;flex-direction:column;gap:16px;padding:6px 0 28px}
.preview-panel{position:sticky;top:84px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.preview-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);font-size:13px;font-weight:500;color:var(--ink)}
.preview-heading>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.preview-tag{font-size:12px;font-weight:400;color:var(--faint)}
.chat{display:flex;flex-direction:column;gap:10px;padding:16px;background:#fcfcfa}
.chat-date{text-align:center;font-size:11.5px;color:var(--faint)}
.incoming{align-self:flex-end;max-width:80%;background:#ebeae5;color:var(--ink);border-radius:16px 16px 4px 16px;padding:7px 12px;font-size:13.5px;overflow-wrap:anywhere}
.chat-reply{display:flex;flex-direction:column;gap:6px;max-width:90%}
.bubble{background:var(--surface);border:1px solid var(--line);border-radius:16px 16px 16px 4px;padding:9px 12px;font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}
.chat-buttons{display:flex;flex-direction:column;gap:6px}
.chat-buttons>a{display:flex;align-items:center;justify-content:center;gap:6px;background:var(--surface);border:1px solid var(--line-strong);border-radius:10px;padding:7px 10px;font-size:13px;font-weight:500;color:var(--accent)}
.public-preview{margin-top:4px;padding-top:10px;border-top:1px dashed var(--line-strong)}
.public-preview>span{font-size:11.5px;color:var(--faint)}
.public-preview>p{font-size:13px;margin-top:2px;white-space:pre-wrap;overflow-wrap:anywhere}
.preview-note{padding:10px 16px;border-top:1px solid var(--line);font-size:12px;color:var(--faint)}
.table-scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:start;font-weight:500;font-size:12.5px;color:var(--faint);padding-block:0 10px;padding-inline:0 16px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding-block:12px;padding-inline:0 16px;border-bottom:1px solid var(--line);vertical-align:top;font-variant-numeric:tabular-nums;white-space:nowrap}
td strong{font-weight:500;color:var(--ink)}
.table-sub{font-size:12px;color:var(--faint)}
.table-foot{margin-top:12px}
.sent-value{font-weight:500;color:var(--accent)}
.error-value{color:var(--danger)}
.activity-links{display:flex;gap:20px}
.activity-tabs{display:flex;gap:24px;border-bottom:1px solid var(--line);margin-bottom:18px}
.activity-tabs>button{background:none;border:0;border-bottom:1.5px solid transparent;padding:0 0 10px;margin-bottom:-1px;font-size:13.5px;color:var(--muted)}
.activity-tabs>button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ink);font-weight:500}
.activity-tabs>button>span{color:var(--faint);margin-inline-start:4px;font-weight:400;font-variant-numeric:tabular-nums}
.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto auto;gap:12px;align-items:end;margin-bottom:18px}
.filters .text-link{height:34px}
.list-note{margin-bottom:12px}
.list-foot{margin-top:12px}
.events{border-top:1px solid var(--line)}
.event{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}
.event-title{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.event-title strong{font-weight:500;color:var(--ink);overflow-wrap:anywhere}
.event-title time{font-size:12.5px;color:var(--faint)}
.event-body{min-width:0}
.event-body>p{margin:3px 0 4px;overflow-wrap:anywhere}
.event-rule{font-size:12.5px;color:var(--faint)}
.event-rule>span{color:var(--muted)}
.event-state{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.event-state form{margin:0}
.event-state .text-link{font-size:12.5px}
.status{font-size:12.5px;color:var(--faint);white-space:nowrap}
.status.ok{color:var(--accent)}
.status.danger{color:var(--danger)}
.status.warn{color:var(--warn)}
.error-details{margin-top:6px;font-size:12.5px;color:var(--danger)}
.error-details summary{cursor:pointer;width:fit-content}
.error-details p{margin-top:4px;overflow-wrap:anywhere}
.settings{padding-top:72px}
.settings>.block-head{margin-bottom:0;padding-bottom:14px}
.setting{display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px;padding:28px 0;border-top:1px solid var(--line)}
.setting-intro h3{font-size:14.5px;font-weight:600;color:var(--ink)}
.setting-intro p{font-size:13px;color:var(--muted);margin-top:4px}
.setting-intro .field-help{margin-top:8px}
.setting-intro .tag{margin-top:12px}
.setting-body{display:flex;flex-direction:column;gap:16px;min-width:0}
.connection-handle{font-weight:500;color:var(--ink)}
.connection-dates{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.connection-dates dt{font-size:12.5px;color:var(--faint);margin-bottom:2px}
.connection-dates dd{font-size:13px}
.channel-picker{border:0;margin:0;padding:0;min-width:0}
.channel-picker legend{padding:0;margin-bottom:6px;font-size:13px;font-weight:500;color:var(--ink)}
.channels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.channel{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);cursor:pointer;font-weight:400;transition:border-color .15s,background .15s}
.channel:hover{border-color:var(--faint)}
.channel:has(input:checked){border-color:var(--accent);background:var(--accent-soft)}
.channel input{margin:2px 0 0;accent-color:var(--accent);flex:none}
.channel span{display:flex;flex-direction:column;min-width:0}
.channel strong{font-size:13px;font-weight:500;color:var(--ink)}
.channel small{font-size:12px;color:var(--muted);line-height:1.4}
dialog{border:1px solid var(--line);border-radius:14px;width:min(540px,calc(100% - 32px));max-height:calc(100dvh - 48px);overflow:auto;padding:28px;background:var(--surface);color:var(--text);box-shadow:0 24px 80px #15191626}
dialog::backdrop{background:#15191640;backdrop-filter:blur(2px)}
.dialog-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}
.dialog-heading h2{font-size:17px;font-weight:600;color:var(--ink)}
.close-dialog{background:none;border:0;padding:2px 6px;font-size:22px;line-height:1;color:var(--faint)}
.close-dialog:hover{color:var(--ink)}
dialog.new-rule{width:min(900px,calc(100% - 32px));padding:0}
.new-rule .dialog-heading{align-items:flex-start;padding:24px 28px 0;margin-bottom:16px}
.dialog-sub{font-size:13px;color:var(--muted);margin-top:3px}
.templates{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 28px 18px;border-bottom:1px solid var(--line)}
.templates-label{font-size:12.5px;color:var(--faint);margin-inline-end:4px}
.template{background:var(--surface);border:1px solid var(--line-strong);border-radius:999px;padding:4px 12px;font-size:12.5px;color:var(--text)}
.template:hover{border-color:var(--faint)}
.template[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#fff}
.new-rule-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px}
.new-rule-fields{padding:4px 28px 4px;min-width:0}
.step{border:0;margin:0;padding:18px 0 20px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:12px;min-width:0}
.step:last-child{border-bottom:0}
.step legend{padding:0;margin-bottom:12px;font-size:14px;font-weight:600;color:var(--ink)}
.step legend .optional{font-size:13px}
.tester{background:#f6f6f2;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px}
.tester-result{font-size:13px;color:var(--muted)}
.tester-result.yes{color:var(--accent);font-weight:500}
.tester-result.no{color:var(--danger)}
.field-error{font-size:12.5px;color:var(--danger)}
.counter{text-align:end;font-variant-numeric:tabular-nums}
.counter.over{color:var(--danger)}
.step-help{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.new-rule-preview{background:#f6f6f2;border-inline-start:1px solid var(--line);padding:22px 20px;display:flex;flex-direction:column;gap:10px}
.preview-label{font-size:12.5px;color:var(--faint);margin-bottom:4px}
.ig-comment{display:flex;gap:9px;align-items:flex-start;font-size:13.5px}
.ig-comment p{overflow-wrap:anywhere;min-width:0}
.ig-comment strong{font-weight:600;color:var(--ink)}
.ig-reply{margin-inline-start:28px;font-size:13px}
.ig-avatar{width:24px;height:24px;border-radius:50%;background:#dcdbd4;flex:none}
.ig-avatar.you{width:20px;height:20px;background:var(--accent)}
#nrp-as-dm{display:flex;flex-direction:column;gap:8px}
#nrp-as-dm .incoming{align-self:flex-end}
.preview-divider{font-size:11.5px;color:var(--faint);text-align:center;margin:10px 0 2px}
.new-rule-preview .chat-reply{max-width:100%}
.preview-status{font-size:12px;color:var(--faint)}
.dialog-more{padding:14px 28px;font-size:12.5px;color:var(--faint);border-top:1px solid var(--line)}
.dialog-more a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
.dialog-footer{position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 28px;border-top:1px solid var(--line);background:var(--surface)}
.dialog-footer>div{display:flex;gap:8px}
.site-footer{max-width:1120px;margin:0 auto;padding:72px 32px 40px;display:flex;justify-content:space-between;gap:16px;font-size:12.5px;color:var(--faint)}
.site-footer a{display:inline-flex;align-items:center;gap:5px}
.site-footer a:hover{color:var(--ink)}
.site-footer .icon{width:12px;height:12px}
form[aria-busy=true] button{opacity:.6}
@media(max-width:1000px){.automations-layout{grid-template-columns:1fr}.preview-panel{position:static;max-width:420px}.filters{grid-template-columns:1fr 1fr}.connection-dates{grid-template-columns:1fr 1fr}}
@media(max-width:860px){.setting{grid-template-columns:1fr;gap:16px}}
@media(max-width:760px){.shell{padding:0 20px}.overview{padding-top:32px}.figures{grid-template-columns:1fr 1fr}.figure:nth-child(3){border-inline-start:0;padding-inline-start:0}.figure:nth-child(n+3){border-top:1px solid var(--line)}.figure{padding-block:16px 18px;padding-inline:0 20px}.figure-value{font-size:28px}.block{padding-top:44px}.block-head{align-items:flex-start;flex-direction:column;gap:10px}.site-footer{padding:56px 20px 32px}.channels{grid-template-columns:1fr}.new-rule-grid{grid-template-columns:1fr}.new-rule-preview{border-inline-start:0;border-top:1px solid var(--line)}.new-rule .dialog-heading,.templates,.new-rule-fields,.dialog-more,.dialog-footer{padding-inline-start:20px;padding-inline-end:20px}}
@media(max-width:640px){.auto>summary{grid-template-columns:minmax(0,1fr) auto 16px;row-gap:2px}.auto-name{grid-column:1;grid-row:1}.auto-state{grid-column:2;grid-row:1}.chevron{grid-column:3;grid-row:1}.auto-keys{grid-column:1;grid-row:2}.auto-sent{grid-column:2;grid-row:2;text-align:start}.filters{grid-template-columns:1fr}.event{grid-template-columns:1fr;gap:6px}.event-state{align-items:flex-start;flex-direction:row;gap:12px}.dialog-footer{flex-wrap:wrap}}
`;

export function renderAccessArtwork(): string {
  return `<div class="login-art" aria-hidden="true">
    <div class="login-pattern pattern-solid"><div class="pattern-turn"><i></i><i></i><i></i><i></i></div></div>
    <div class="login-pattern pattern-outline"><div class="pattern-turn"><i></i><i></i><i></i><i></i></div></div>
    <div class="login-wordmark" dir="ltr">${[..."REPLY"].map((letter, index) => `<span style="--letter:${index}">${letter}</span>`).join("")}</div>
  </div>`;
}

export function renderAccessPage(title: string, body: string): string {
  return `<!doctype html><html lang="ar" dir="rtl" data-palette="studio"><head><meta charset="utf-8">${appearanceHead}<meta name="viewport" content="width=device-width, initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>${esc(title)} · ${PRODUCT_NAME} · إدارة المحادثات</title><style>${baseStyles}${formStyles}
  .login-shell{min-height:100dvh;display:grid;place-items:center;padding:24px}.login-panel{width:100%;max-width:360px}.login-panel .wordmark{margin-bottom:48px}.login-panel h1{font-size:22px;font-weight:600;letter-spacing:-.02em;line-height:1.3;color:var(--ink);margin-bottom:20px;overflow-wrap:anywhere}.login-panel .eyebrow{font-size:13px;color:var(--muted);margin-bottom:6px}.login-panel button{width:100%;height:38px;background:var(--accent);color:#fff;border:0;border-radius:7px;font-size:14px;font-weight:500}.login-panel button:hover{background:var(--accent-hover)}.login-panel .alert{padding:10px 12px;border-radius:7px;background:var(--danger-soft);color:var(--danger);font-size:13px;margin-bottom:16px}.login-panel a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}.login-panel pre{white-space:pre-wrap;font:12.5px/1.5 var(--mono);background:#f0efea;border-radius:7px;padding:12px;margin:16px 0 0}.login-panel p.muted{font-size:13px;color:var(--muted)}
  </style><link rel="stylesheet" href="/reply-studio.css?v=5">${appearanceStyles}</head><body><div class="access-language">${themeToggle}${languageSwitch}</div>${body}</body></html>`;
}

const wordmark = renderWordmark();

export function renderLoginPage(invalid: boolean): string {
  return renderAccessPage("تسجيل الدخول", `
    <main class="login-shell">
      ${renderAccessArtwork()}
      <section class="login-panel">
        ${wordmark}
        <h1>تسجيل الدخول</h1>
        ${invalid ? '<p class="alert">رمز الدخول غير صحيح.</p>' : ""}
        <form method="post" action="/admin/login" class="stack">
          <label>
            <span>رمز دخول الإدارة</span>
            <input name="token" type="password" autocomplete="current-password" autofocus required>
          </label>
          <button type="submit">فتح لوحة الإدارة</button>
        </form>
      </section>
    </main>
  `);
}

export function renderMissingAdminTokenPage(): string {
  return renderAccessPage("رمز دخول الإدارة غير مضبوط", `
    <main class="login-shell">
      ${renderAccessArtwork()}
      <section class="login-panel">
        ${wordmark}
        <p class="eyebrow">يلزم الإعداد</p>
        <h1>اضبط ADMIN_TOKEN</h1>
        <p class="muted">أنشئ رمز دخول للإدارة قبل استخدام لوحة التحكم.</p>
        <pre>npx wrangler secret put ADMIN_TOKEN</pre>
      </section>
    </main>
  `);
}

export function renderErrorPage(message: string): string {
  return renderAccessPage("خطأ", `
    <main class="login-shell">
      ${renderAccessArtwork()}
      <section class="login-panel">
        ${wordmark}
        <p class="eyebrow">تعذّر الحفظ</p>
        <h1>${esc(message)}</h1>
        <p><a href="/admin">العودة للوحة الإدارة</a></p>
      </section>
    </main>
  `);
}

const sectionStyles = `
.dashboard-page main>section,.dashboard-page main>.settings{display:none}
.view-overview main>#overview,.view-overview main>#recent,.view-automations main>#automations,.view-activity main>#activity,.view-stats main>#performance,.view-advanced main>#settings{display:block}
.dashboard-page main>#automations,.dashboard-page main>#activity,.dashboard-page main>#performance,.dashboard-page main>#settings{border-top:0;margin-top:0;padding-top:0}
.connected-activity{margin-bottom:36px}.connected-activity h2,.legacy-activity-title{font-size:17px;margin-bottom:18px}.channel-photo{display:block;width:120px;height:120px;object-fit:contain;border-radius:8px;margin-top:12px}.channel-reply{white-space:pre-wrap;background:var(--accent-soft);padding:10px 14px;border-radius:8px;margin-top:10px!important}.dashboard-page h1{font-size:28px;font-weight:700;line-height:1.5;color:var(--ink)}
`;
