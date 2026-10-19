import { isBasicallyKeyword } from "./keyword-match";
import { findProductReply, getProductSettings, productHelpReply, type ProductReply } from "./products";

export const REPLY_TOPICS = [
  { id: "greeting", title: "الترحيب", hint: "سلام، أهلًا، صباح الخير", example: "السلام عليكم", text: "وعليكم السلام، أهلًا وسهلًا بيك 🌷 كيف نقدر نساعدوك؟ لو تبي سعر منتج، أرسل كوده." },
  { id: "delivery", title: "التوصيل", hint: "التوصيل، الشحن، المناطق", example: "في توصيل؟", text: "لتفاصيل التوصيل، أرسل المدينة والمنطقة ونأكدلك التوفر والتكلفة." },
  { id: "payment", title: "طرق الدفع", hint: "كاش، تحويل، كيف ندفع", example: "شن طرق الدفع؟", text: "بخصوص الدفع، فريق الصفحة يقدر يأكدلك الطرق المتاحة قبل تأكيد الطلب." },
  { id: "location", title: "الموقع والعنوان", hint: "وين مكانكم؟ عندكم محل؟", example: "وين مكانكم؟", text: "لمعرفة الموقع وطريقة الاستلام، اكتب المدينة اللي تبي تستلم فيها وفريق الصفحة يساعدك." },
  { id: "hours", title: "أوقات العمل", hint: "متى تفتحوا؟ متى تسكروا؟", example: "شن أوقات العمل؟", text: "أرسل استفسارك هنا، وفريق الصفحة يراجع رسالتك ويأكدلك مواعيد العمل." },
  { id: "returns", title: "الاستبدال والاسترجاع", hint: "نبدله، نرجعه، المنتج فيه مشكلة", example: "نقدر نبدل المنتج؟", text: "متأسفين لو صار أي إشكال. أرسل كود المنتج وتفاصيل المشكلة، وفريق الصفحة يراجع طلبك ويوضحلك الخيارات المتاحة." },
  { id: "order", title: "طلب منتج", hint: "نبي نطلب، نحجز، نشتري", example: "نبي نطلب منتج", text: "يسعدنا طلبك 🌷 أرسل كود المنتج والكمية المطلوبة، وفريق الصفحة يكمل معاك التفاصيل." },
  { id: "human", title: "التواصل مع شخص", hint: "نبي موظف، خدمة العملاء", example: "نبي نتكلم مع شخص", text: "أكيد، اكتب استفسارك هنا. رسالتك ظاهرة لفريق الصفحة ويقدروا يتابعوها معاك." },
  { id: "thanks", title: "الشكر", hint: "شكرًا، مشكور، تسلم", example: "شكرا", text: "العفو، هذا واجبنا 🌷 موجودين لمساعدتك لو عندك أي استفسار ثاني." },
  { id: "fallback", title: "سؤال غير واضح", hint: "عندما لا نجد ردًا مناسبًا", example: "عندي استفسار مختلف", text: "أهلًا بيك 🌷 نقدر نساعدك في أسعار المنتجات، التوصيل، الدفع، أو الطلب. اكتب سؤالك بوضوح، أو أرسل كود المنتج لمعرفة سعره." }
] as const;
export type ReplyTopic = typeof REPLY_TOPICS[number]["id"];
export type BusinessReplies = { enabled: boolean; topics: Record<ReplyTopic, { enabled: boolean; text: string }> };

export function defaultBusinessReplies(): BusinessReplies {
  return { enabled: false, topics: Object.fromEntries(REPLY_TOPICS.map(topic => [topic.id, { enabled: true, text: topic.text }])) as BusinessReplies["topics"] };
}

export async function getBusinessReplies(db: D1Database): Promise<BusinessReplies> {
  const defaults = defaultBusinessReplies();
  const row = await db.prepare("SELECT value FROM automation_settings WHERE key = 'business_replies'").first<{ value: string }>();
  if (!row) return defaults;
  try {
    const stored = JSON.parse(row.value);
    defaults.enabled = stored?.enabled === true;
    for (const topic of REPLY_TOPICS) {
      const value = stored?.topics?.[topic.id];
      if (value && typeof value.enabled === "boolean" && typeof value.text === "string" && value.text.trim() && value.text.length <= 800) defaults.topics[topic.id] = { enabled: value.enabled, text: value.text };
    }
  } catch { /* Use safe defaults if the saved configuration cannot be read. */ }
  return defaults;
}

export async function saveBusinessReplies(db: D1Database, settings: BusinessReplies): Promise<void> {
  await db.prepare("INSERT INTO automation_settings (key, value, updated_at) VALUES ('business_replies', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(settings), new Date().toISOString()).run();
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\u064B-\u065F\u0670ـ]/gu, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function detectReplyTopic(input: string): ReplyTopic {
  const text = ` ${normalize(input)} `;
  const rules: Array<[ReplyTopic, RegExp]> = [
    ["human", /موظف|خدمه العملاء|خدمة العملاء|نتكلم مع|نكلم|انسان|بشري|مشرف|شخص|human|agent/],
    ["returns", /استبدال|استرجاع|نرجع|نبدل|ارجع|نرده|نردها|مشكله|مشكلة|خرب|تالف|return|refund/],
    ["delivery", /توصيل|توصل|شحن|دليفري|delivery|shipping/],
    ["payment", /الدفع|ندفع|دفع|كاش|تحويل|بطاقه|بطاقة|مصرف|cash|payment/],
    ["location", /مكانكم|موقعكم|عنوان|وين المحل|محلكم|وين موجود|عندكم محل|وينكم|location|address/],
    ["hours", /اوقات|مواعيد|تفتح|تسكر|تقفل|ساعات العمل|دوام|working hours|opening/],
    ["order", /نطلب|نحجز|نشتري|ابي اطلب|اريد اطلب|اريد شراء|حجز|طلب منتج|order|buy/],
    ["thanks", /شكرا|مشكور|تسلم|يسلمو|بارك الله|thanks|thank you/],
    ["greeting", /سلام|مرحبا|اهلا|صباح الخير|مساء الخير|^ hi $|^ hello $|^ hey $/]
  ];
  return rules.find(([, rule]) => rule.test(text))?.[0] ?? "fallback";
}

/** Does not invent prices or delivery policies. Specific product-code help precedes general FAQ. */
export async function generalBusinessReply(db: D1Database, text: string, hasImage: boolean): Promise<ProductReply | null> {
  const settings = await getBusinessReplies(db);
  if (!settings.enabled) return null;
  const productSettings = await getProductSettings(db);
  const help = productHelpReply(productSettings, text, hasImage);
  const normalized = normalize(text);
  const topic = detectReplyTopic(text);
  if (productSettings.enabled && (hasImage || (help.key === "catalog:unknown" && topic === "fallback") || /بكم|بقداش|قداش|كم سعر|السعر|سعره|سعرها|price|how much/.test(normalized))) return help;
  const selected = settings.topics[topic];
  // Turning off a topic means it is not answered by a generic fallback either.
  if (!selected.enabled) return null;
  return { key: `business:${topic}`, label: REPLY_TOPICS.find(item => item.id === topic)!.title, paused: false, message: { text: selected.text } };
}

/** Shared by connected channels and the settings preview. Existing keyword automations keep their place. */
export async function resolveCustomerReply(db: D1Database, text: string, hasImage: boolean, channel: "dms" | "comments" = "dms"): Promise<ProductReply | null> {
  const products = await getProductSettings(db);
  const direct = products.enabled ? await findProductReply(db, text) : null;
  if (direct) return direct;
  const rows = (await db.prepare("SELECT id, label, channels, keywords, reply_text, public_reply_text, link_url FROM rules WHERE active = 1 ORDER BY id").all<{ id: number; label: string; channels: string; keywords: string; reply_text: string; public_reply_text: string | null; link_url: string | null }>()).results;
  for (const row of rows) {
    try {
      const channels = JSON.parse(row.channels || '["comments"]');
      const keywords = JSON.parse(row.keywords);
      if (Array.isArray(channels) && channels.includes(channel) && Array.isArray(keywords) && keywords.some(keyword => typeof keyword === "string" && isBasicallyKeyword(text, keyword))) {
        if (channel === "comments" && !row.public_reply_text?.trim()) continue;
        return { key: `rule-${row.id}`, label: row.label, paused: false, message: { text: channel === "comments" ? row.public_reply_text!.split("\n").find(line => line.trim())! : row.reply_text + (row.link_url ? `\n${row.link_url}` : "") } };
      }
    } catch { /* A malformed rule cannot stop other replies. */ }
  }
  const business = await generalBusinessReply(db, text, hasImage);
  if (business) return business;
  // Explicitly disabled FAQ topics stay silent even if product guidance is enabled.
  const settings = await getBusinessReplies(db);
  if (settings.enabled && !settings.topics[detectReplyTopic(text)].enabled) return null;
  return products.enabled ? productHelpReply(products, text, hasImage) : null;
}
