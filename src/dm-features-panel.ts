import {
  buildReplyLink,
  MAX_CUSTOM_REPLIES,
  MAX_STARTERS,
  MAX_STORY_RULES,
  parseReplyRef,
  type CustomReply,
  type DmFeatureSettings,
  type IceBreakersPublicationStatus,
  type StoryRule
} from "./dm-features";

// A reply that a starter, story rule or DM link can point at.
export type ReplyOption = { key: string; label: string; group: "rule" | "text"; detail: string };

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function replyOptions(options: ReplyOption[], selected: string): string {
  const groups: Array<[ReplyOption["group"], string]> = [["rule", "أتمتة الكلمات المفتاحية"], ["text", "الردود المخصصة"]];
  const missing = selected && !options.some((option) => option.key === selected)
    ? `<option value="${esc(selected)}" selected>رد محذوف (اختر غيره)</option>` : "";
  const body = groups.map(([group, label]) => {
    const items = options.filter((option) => option.group === group);
    return items.length
      ? `<optgroup label="${label}">${items.map((option) => `<option translate="no" value="${esc(option.key)}" ${option.key === selected ? "selected" : ""}>${esc(option.label)}${option.detail ? ` · ${esc(option.detail)}` : ""}</option>`).join("")}</optgroup>`
      : "";
  }).join("");
  return missing + (body || '<option value="">أضف أتمتة أو ردًا مخصصًا أولًا</option>');
}

function displayTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return `<time datetime="${esc(date.toISOString())}">${esc(date.toLocaleString("ar-LY", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC"
  }))} UTC</time>`;
}

function publication(status: IceBreakersPublicationStatus, enabled: boolean): string {
  const label = status.state === "synced"
    ? enabled ? "منشورة على إنستغرام" : "أُزيلت من إنستغرام"
    : status.state === "pending" ? "النسخة المنشورة أقدم من المحفوظة"
      : status.state === "error" ? "تعذّر النشر" : "لم تُنشر على إنستغرام بعد";
  return `<div class="dm-publish-status"><span class="tag ${status.state === "synced" ? "ok" : status.state === "error" ? "danger" : "warn"}">${label}</span>
    ${status.syncedAt ? `<span class="field-help">آخر نشر ${displayTime(status.syncedAt)}</span>` : ""}
    ${status.error ? `<p class="dm-publish-error" role="status">${esc(status.error)}</p>` : ""}</div>`;
}

function publishHelp(status: IceBreakersPublicationStatus, dryRun: boolean): string {
  if (dryRun) return "النشر متوقف في وضع الاختبار.";
  return status.state === "pending"
    ? "تغيّرت أزرار المحادثة بعد آخر نشر. انشرها لتحديث ما يظهر في إنستغرام."
    : "يحدّث النشر الأزرار التي تظهر عند بدء محادثة جديدة.";
}

/** The DM tools part of Settings: one two-column row per tool. */
export function renderDmFeaturesPanel(data: {
  settings: DmFeatureSettings;
  publication: IceBreakersPublicationStatus;
  options: ReplyOption[];
  username: string | null;
  dryRun: boolean;
}): string {
  const { settings, options } = data;
  const normalizedUsername = (data.username ?? "").trim().replace(/^@/, "");
  const canBuildLinks = /^[A-Za-z0-9._]{1,30}$/.test(normalizedUsername);
  const defaultReply = options[0]?.key ?? "";
  return `<section class="dm-tools" id="dm-tools" aria-label="أدوات المراسلة">
    <form action="/admin/dm-features" method="post" id="dm-feature-settings" class="dm-settings-form">
      <div class="setting dm-feature">
        <div class="setting-intro"><h3 id="dm-starters-title">أزرار بدء المحادثة</h3><p>حتى ${MAX_STARTERS} أزرار تظهر في المحادثة الجديدة. يرسل كل زر رد أتمتة أو ردًا مخصصًا.</p></div>
        <div class="setting-body">
          <label class="switch-label"><input type="checkbox" name="starters_enabled" ${settings.startersEnabled ? "checked" : ""}><span class="switch"></span>إظهار أزرار بدء المحادثة</label>
          <div class="dm-starter-list">${Array.from({ length: MAX_STARTERS }, (_, index) => {
            const starter = settings.starters[index];
            return `<div class="dm-starter-row"><span class="dm-row-number" aria-hidden="true">${index + 1}</span><label>الزر ${index + 1}<input name="starter_title" value="${esc(starter?.title ?? "")}" maxlength="80" placeholder="اتركه فارغًا لتجاوزه"></label><label>الرد<select name="starter_reply">${replyOptions(options, starter?.reply ?? defaultReply)}</select></label></div>`;
          }).join("")}</div>
          <p class="field-help">الحفظ يحتفظ بالأزرار هنا. استخدم النشر أدناه لإظهارها في إنستغرام.</p>
        </div>
      </div>
      <div class="setting dm-feature">
        <div class="setting-intro"><h3 id="dm-followers-title">حالة المتابعة</h3><p>أضف ترحيبًا مختلفًا للمتابعين وغير المتابعين. يُفحص من يراسلك أو يضغط زر محادثة فقط.</p></div>
        <div class="setting-body">
          <label class="switch-label"><input type="checkbox" name="follower_check_enabled" ${settings.followerCheckEnabled ? "checked" : ""}><span class="switch"></span>فحص متابعة أصحاب الرسائل الواردة</label>
          <div class="two-fields"><label>للمتابعين <span class="optional">اختياري</span><textarea name="follower_reply" rows="2" maxlength="80" placeholder="شكرًا لمتابعتك!">${esc(settings.followerReply)}</textarea></label>
          <label>لغير المتابعين <span class="optional">اختياري</span><textarea name="non_follower_reply" rows="2" maxlength="80" placeholder="أهلًا بك، شكرًا لتواصلك!">${esc(settings.nonFollowerReply)}</textarea></label></div>
          <p class="field-help">حتى 80 حرفًا قبل الرد ضمن حدود إنستغرام. تُستخدم الرسالة العادية إذا تُرك الترحيب فارغًا أو تعذّر فحص المتابعة. تُحفظ النتيجة 24 ساعة؛ لا تُرسل رسائل تلقائية للمتابعين الجدد.</p>
          <div class="form-actions dm-save-actions"><span class="field-help">الحفظ لا يرسل رسالة ولا ينشر الأزرار.</span><button class="button primary">حفظ إعدادات المراسلة</button></div>
        </div>
      </div>
    </form>
    <div class="setting dm-publish-row">
      <div class="setting-intro"><h3>نشر أزرار المحادثة</h3><p>يحفظ الأزرار في لوحة الإدارة؛ ينشرها زر النشر في تطبيق إنستغرام.</p></div>
      <div class="setting-body">${publication(data.publication, settings.startersEnabled)}<form action="/admin/dm-features/publish" method="post" id="dm-publish-form"><button class="button secondary" data-publish-starters ${data.dryRun ? "disabled" : ""}>${settings.startersEnabled ? "نشر الأزرار المحفوظة" : "إزالة الأزرار من إنستغرام"}</button></form><p class="field-help" id="dm-publish-help">${publishHelp(data.publication, data.dryRun)}</p></div>
    </div>
    ${customReplies(settings.customReplies)}
    <section class="setting dm-feature dm-story-section" aria-labelledby="dm-story-title">
      <div class="setting-intro"><h3 id="dm-story-title">ردود القصص</h3><p>أرسل ردًا على قصة محددة أو كلمة في أي قصة. للقصة المحددة الأولوية، والقاعدة المتوقفة تمنع القواعد العامة. تُنفذ هذه القواعد قبل أتمتة ردود القصص.</p><p class="field-help">استخدم معرّف القصة أو رابط ملصقها؛ روابط وسائط القصص مؤقتة. المستخدم: ${settings.storyRules.length} من ${MAX_STORY_RULES}.</p></div>
      <div class="setting-body">
      ${storyRules(settings.storyRules, options)}
      ${settings.storyRules.length < MAX_STORY_RULES ? `<details class="dm-add-story"><summary>إضافة قاعدة قصة</summary><form action="/admin/story-rules" method="post" class="stack dm-new-story-form">
        <input type="hidden" name="action" value="save"><div class="two-fields"><label>اسم القاعدة<input name="label" required maxlength="80" placeholder="قصة الورشة"></label><label>الرد<select name="reply">${replyOptions(options, defaultReply)}</select></label></div>
        <div class="two-fields"><label>معرّف القصة <span class="optional">اختياري</span><input name="story_id" maxlength="40" inputmode="numeric" pattern="[0-9]*" placeholder="من قسم النشاط"></label><label>الكلمة المفتاحية <span class="optional">اختياري</span><input name="keyword" maxlength="80" placeholder="WORKSHOP"></label></div>
        <label>رابط القصة أو ملصق الرابط <span class="optional">اختياري</span><input name="story_url" type="url" maxlength="2000" placeholder="https://…"></label>
        <p class="field-help">أضف معرّف قصة أو رابطًا أو كلمة مفتاحية على الأقل.</p><div class="form-actions"><label class="switch-label"><input type="checkbox" name="enabled" checked><span class="switch"></span>مفعّل</label><button class="button primary">إضافة قاعدة القصة</button></div>
      </form></details>` : ""}
      </div>
    </section>
    <section class="setting dm-feature dm-flow-links" aria-labelledby="dm-links-title" data-dm-link-username="${esc(canBuildLinks ? normalizedUsername : "")}">
      <div class="setting-intro"><h3 id="dm-links-title">روابط المحادثات</h3><p>روابط تفتح محادثة برد محدد. أضف مصدرًا لمعرفة من أين وصل العملاء.</p>${canBuildLinks ? `<p class="field-help">@${esc(normalizedUsername)}</p>` : ""}</div>
      <div class="setting-body">
      <label class="dm-link-source">المصدر <span class="optional">اختياري</span><input id="dm-link-source" value="website" maxlength="80" pattern="[A-Za-z0-9_\\-]{1,80}" placeholder="website" aria-describedby="dm-link-source-help"><span class="field-help" id="dm-link-source-help">حروف إنجليزية وأرقام وشرطات، مثل website أو newsletter.</span></label>
      ${canBuildLinks
        ? options.length
          ? `<div class="dm-links-list">${options.map((option, index) => `<div class="dm-link-row"><label for="dm-link-${index}">${esc(option.label)}</label><input id="dm-link-${index}" data-reply-key="${esc(option.key)}" value="${esc(buildReplyLink(normalizedUsername, option.key, "website"))}" readonly aria-label="${esc(option.label)} رابط المحادثة"><button type="button" class="button secondary" data-copy-dm-link="dm-link-${index}">نسخ<span class="sr-only"> ${esc(option.label)}</span></button></div>`).join("")}</div>`
          : '<p class="dm-empty">أضف أتمتة أو ردًا مخصصًا لإنشاء الروابط.</p>'
        : '<p class="notice">افحص اتصال إنستغرام أو اضبط OWNER_IG_USERNAME لعرض روابط الحساب.</p>'}
      <p id="dm-link-feedback" class="field-help" role="status" aria-live="polite"></p><p class="field-help">يفتح إنستغرام على الهاتف. تبدأ المحادثة بعد إرسال رسالة أو الضغط على زر.</p>
      </div>
    </section>
  </section>`;
}

function customReplies(replies: CustomReply[]): string {
  return `<section class="setting dm-feature dm-custom-section" aria-labelledby="dm-custom-title">
    <div class="setting-intro"><h3 id="dm-custom-title">الردود المخصصة</h3><p>ردود نصية لأزرار المحادثة وقواعد القصص والروابط، مستقلة عن الأتمتة.</p><p class="field-help">المستخدم: ${replies.length} من ${MAX_CUSTOM_REPLIES}.</p></div>
    <div class="setting-body">
    ${replies.length ? `<div class="dm-custom-list">${replies.map((reply) => `<details class="dm-custom"><summary><strong translate="no">${esc(reply.label)}</strong><span translate="no">${esc(reply.text.length > 140 ? `${reply.text.slice(0, 137)}…` : reply.text)}</span></summary>
      <form action="/admin/custom-replies" method="post" class="stack"><input type="hidden" name="id" value="${esc(reply.id)}"><label>الاسم<input name="label" value="${esc(reply.label)}" maxlength="80" required></label><label>الرسالة<textarea name="text" rows="3" maxlength="1000" required>${esc(reply.text)}</textarea></label>
      <div class="form-actions"><span class="dm-reply-key">text-${esc(reply.id)}</span><div><button class="button danger" name="action" value="delete" formnovalidate data-confirm="هل تريد حذف هذا الرد المخصص؟">حذف</button><button class="button primary" name="action" value="save">حفظ الرد</button></div></div></form></details>`).join("")}</div>` : '<p class="dm-empty">لا توجد ردود مخصصة بعد.</p>'}
    ${replies.length < MAX_CUSTOM_REPLIES ? `<details class="dm-add-story"><summary>إضافة رد مخصص</summary><form action="/admin/custom-replies" method="post" class="stack dm-new-story-form">
      <input type="hidden" name="action" value="save"><label>الاسم<input name="label" required maxlength="80" placeholder="اسأل سؤالًا"></label><label>الرسالة<textarea name="text" rows="3" maxlength="1000" required placeholder="أرسل سؤالك هنا وسنرد عليك قريبًا."></textarea></label>
      <div class="form-actions"><span class="field-help">حتى 1,000 حرف.</span><button class="button primary">إضافة الرد المخصص</button></div>
    </form></details>` : ""}
    </div>
  </section>`;
}

function storyRules(rules: StoryRule[], options: ReplyOption[]): string {
  if (!rules.length) return '<p class="dm-empty">لا توجد قواعد قصص بعد.</p>';
  return `<div class="table-scroll"><table class="dm-story-table"><thead><tr><th>القاعدة</th><th>القصة</th><th>الكلمة المفتاحية</th><th>الرد</th><th>مفعّل</th><th>الإجراءات</th></tr></thead><tbody>${rules.map((rule, index) => {
    const formId = `dm-story-rule-${index}`;
    return `<tr><td data-column="القاعدة"><form action="/admin/story-rules" method="post" id="${formId}"><input type="hidden" name="id" value="${esc(rule.id)}"><input name="label" value="${esc(rule.label)}" maxlength="80" required aria-label="اسم القاعدة"></form></td>
      <td data-column="القصة"><div class="dm-story-target"><input name="story_id" maxlength="40" form="${formId}" value="${esc(rule.storyId)}" pattern="[0-9]*" inputmode="numeric" placeholder="أي قصة · أضف معرّفًا" aria-label="معرّف القصة"><input name="story_url" form="${formId}" value="${esc(rule.storyUrl)}" type="url" maxlength="2000" placeholder="رابط القصة أو ملصق الرابط" aria-label="رابط القصة أو ملصق الرابط"></div></td>
      <td data-column="الكلمة المفتاحية"><input name="keyword" form="${formId}" value="${esc(rule.keyword)}" maxlength="80" placeholder="أي رد" aria-label="الكلمة المفتاحية لرد القصة"></td>
      <td data-column="الرد"><select name="reply" form="${formId}" aria-label="رد القصة">${replyOptions(options, rule.reply)}</select></td>
      <td data-column="مفعّل"><label class="switch-label dm-table-switch"><input type="checkbox" name="enabled" form="${formId}" ${rule.enabled ? "checked" : ""}><span class="switch"></span><span class="sr-only">تفعيل ${esc(rule.label)}</span></label></td>
      <td data-column="الإجراءات"><div class="dm-story-actions"><button class="button secondary" name="action" value="save" form="${formId}">حفظ</button><button class="button danger" name="action" value="delete" form="${formId}" formnovalidate data-confirm="هل تريد حذف قاعدة القصة؟">حذف</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

export type DmMessageContext = {
  source?: string | null;
  referral_ref?: string | null;
  story_id?: string | null;
  story_url?: string | null;
  story_link_url?: string | null;
  is_follower?: number | null;
  profile_error?: string | null;
  profile_checked_at?: string | null;
};

const SOURCE_NAMES: Record<string, string> = {
  dm: "رسالة خاصة",
  starter: "زر بدء محادثة",
  story_reply: "رد على قصة",
  story_mention: "إشارة في قصة",
  referral: "رابط المحادثة",
  postback: "ضغطة زر"
};

/** Where an incoming DM came from, shown under each DM in the activity list. */
export function renderDmMessageContext(row: DmMessageContext): string {
  const parts: string[] = [];
  if (row.source) parts.push(`<span>${esc(SOURCE_NAMES[row.source] ?? row.source.replace(/_/g, " "))}</span>`);
  if (row.referral_ref) {
    const source = parseReplyRef(row.referral_ref)?.source ?? null;
    parts.push(`<span>مصدر الرابط: ${esc(source ?? row.referral_ref)}</span>`);
  }
  if (row.is_follower === 1) parts.push('<span class="dm-follower">يتابعك</span>');
  else if (row.is_follower === 0) parts.push("<span>لا يتابعك</span>");
  else if (row.profile_checked_at || row.profile_error) parts.push("<span>حالة المتابعة غير متاحة</span>");
  if (row.story_id) parts.push(`<span class="dm-story-id">معرّف القصة: ${esc(row.story_id)}</span>`);
  const link = row.story_link_url || row.story_url;
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol === "https:" && !url.username && !url.password) {
        parts.push(`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${row.story_link_url ? "ملصق رابط القصة" : "وسائط القصة"} ↗</a>`);
      }
    } catch { /* Omit malformed activity links. */ }
  }
  return parts.length ? `<div class="dm-message-context">${parts.join("")}</div>` : "";
}

export const dmFeaturesClientScript = `
(() => {
  const form = document.getElementById('dm-feature-settings');
  const publish = document.querySelector('[data-publish-starters]');
  const publishHelp = document.getElementById('dm-publish-help');
  if (form && publish && !publish.disabled) {
    const markUnsaved = () => { publish.disabled = true; publishHelp.textContent = 'احفظ التعديلات قبل النشر.'; };
    form.addEventListener('input', markUnsaved);
    form.addEventListener('change', markUnsaved);
  }
  document.querySelectorAll('[data-confirm]').forEach(button => button.addEventListener('click', event => {
    if (!confirm(button.dataset.confirm)) event.preventDefault();
  }));
  const panel = document.querySelector('[data-dm-link-username]');
  if (!panel || !panel.dataset.dmLinkUsername) return;
  const source = document.getElementById('dm-link-source');
  const feedback = document.getElementById('dm-link-feedback');
  const linkInputs = [...panel.querySelectorAll('[data-reply-key]')];
  const copyButtons = [...panel.querySelectorAll('[data-copy-dm-link]')];
  source.addEventListener('input', () => {
    const value = source.value.trim() || 'website';
    const valid = /^[A-Za-z0-9_-]{1,80}$/.test(value);
    source.setAttribute('aria-invalid', String(!valid));
    feedback.textContent = valid ? '' : 'استخدم حروفًا إنجليزية أو أرقامًا أو شرطات للمصدر.';
    copyButtons.forEach(button => { button.disabled = !valid; });
    linkInputs.forEach(input => {
      input.value = valid ? 'https://ig.me/' + encodeURIComponent(panel.dataset.dmLinkUsername) + '?ref=' + input.dataset.replyKey + '__' + value : '';
    });
  });
  copyButtons.forEach(button => button.addEventListener('click', async () => {
    const input = document.getElementById(button.dataset.copyDmLink);
    if (!input || !input.value) return;
    try { await navigator.clipboard.writeText(input.value); feedback.textContent = 'تم نسخ الرابط.'; }
    catch { input.focus(); input.select(); feedback.textContent = 'تم تحديد الرابط. انسخه باستخدام لوحة المفاتيح.'; }
  }));
})();
`;

export const dmFeaturesStyles = `
.dm-settings-form{margin:0}
.dm-starter-list{display:flex;flex-direction:column;gap:10px}
.dm-starter-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);gap:10px;align-items:end}
.dm-row-number{display:none}
.dm-save-actions{padding-top:4px}
.dm-publish-status{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.dm-publish-error{flex-basis:100%;font-size:12.5px;color:var(--danger);overflow-wrap:anywhere}
#dm-publish-form{margin:0}
.dm-tools button:disabled{opacity:.45;cursor:not-allowed}
.dm-story-table{min-width:760px}
.dm-story-table th{padding-inline-end:10px}
.dm-story-table td{padding-block:10px;padding-inline:0 10px;white-space:normal}
.dm-story-table input,.dm-story-table select{font-size:13px;padding:6px 8px}
.dm-story-table select{padding-inline-end:26px}
.dm-story-target{display:grid;gap:6px}
.dm-story-actions{display:flex;gap:4px}
.dm-story-actions .button{height:30px;padding:0 10px;font-size:12.5px}
.dm-table-switch{height:30px}
.dm-empty{color:var(--muted);font-size:13px}
.dm-add-story{border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.dm-add-story>summary{cursor:pointer;padding:10px 14px;font-size:13px;font-weight:500;color:var(--accent);list-style:none}
.dm-add-story>summary::-webkit-details-marker{display:none}
.dm-add-story>summary:before{content:"+";display:inline-block;width:14px;color:var(--faint)}
.dm-add-story[open]>summary{border-bottom:1px solid var(--line)}
.dm-new-story-form{padding:16px 14px}
.dm-custom-list{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.dm-custom{border-bottom:1px solid var(--line)}
.dm-custom>summary{display:flex;flex-direction:column;gap:2px;padding:10px 0;cursor:pointer;list-style:none}
.dm-custom>summary::-webkit-details-marker{display:none}
.dm-custom>summary strong{font-weight:500;color:var(--ink)}
.dm-custom>summary span{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.dm-custom>form{padding:4px 0 18px}
.dm-reply-key{font-family:var(--mono);font-size:12px;color:var(--faint)}
.dm-links-list{display:flex;flex-direction:column;gap:8px}
.dm-link-row{display:grid;grid-template-columns:130px minmax(0,1fr) auto;gap:10px;align-items:center}
.dm-link-row>label{font-weight:400;color:var(--muted);overflow-wrap:anywhere}
.dm-link-row input{font-family:var(--mono);font-size:12.5px}
.dm-link-source{max-width:320px}
.dm-message-context{display:flex;flex-wrap:wrap;gap:2px 12px;margin-top:2px;font-size:12.5px;color:var(--faint)}
.dm-message-context a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}
.dm-message-context .dm-follower{color:var(--accent)}
.dm-message-context .dm-story-id{overflow-wrap:anywhere}
@media(max-width:760px){.dm-starter-row{grid-template-columns:minmax(0,1fr) 130px;gap:8px}.dm-story-table{min-width:0}.dm-story-table thead{display:none}.dm-story-table,.dm-story-table tbody{display:block;width:100%}.dm-story-table tr{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}.dm-story-table td{display:block;padding:0;border:0;min-width:0}.dm-story-table td:before{content:attr(data-column);display:block;font-size:12px;color:var(--faint);margin-bottom:4px}.dm-story-table td:first-child,.dm-story-table td:nth-child(2){grid-column:1/-1}.dm-story-target{grid-template-columns:1fr 1fr}.dm-link-row{grid-template-columns:minmax(0,1fr) auto;gap:6px}.dm-link-row>label{grid-column:1/-1}}
@media(max-width:420px){.dm-story-target{grid-template-columns:1fr}.dm-save-actions .button{width:100%}}
`;
