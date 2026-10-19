import { productImagePath, type ProductImage, type ReplyImage } from "./product-images";
import { isBasicallyKeyword } from "./keyword-match";

export type Product = {
  id: number;
  code: string;
  name: string;
  price_milli: number;
  currency: string;
  active: number;
  updated_at: string;
  image_id: string | null;
};

export type ProductBotSettings = { enabled: boolean; prompt: string; unknown: string };
export type ProductReply = { key: string; label: string; paused: boolean; message: { text: string }; image?: ReplyImage };
export const PRODUCT_CURRENCIES = { LYD: "دينار ليبي", USD: "دولار أمريكي", EUR: "يورو", TND: "دينار تونسي", EGP: "جنيه مصري" };
export const DEFAULT_PRODUCT_SETTINGS: ProductBotSettings = {
  enabled: false,
  prompt: "أهلًا بيك 🌷 أرسل كود المنتج المكتوب في المنشور، ونقولك اسمه وسعره على طول.",
  unknown: "الكود مش موجود، تأكد من الكود وأرسله مرة ثانية."
};

export function normalizeProductInput(value: string): string {
  return value.normalize("NFKC")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .trim();
}

export function formatProductPrice(product: Pick<Product, "price_milli" | "currency">): string {
  const price = new Intl.NumberFormat("ar-LY", { maximumFractionDigits: 3 }).format(product.price_milli / 1000);
  return `${price} ${PRODUCT_CURRENCIES[product.currency as keyof typeof PRODUCT_CURRENCIES] ?? product.currency}`;
}

export function parseProductForm(form: FormData): { ok: true; product: Omit<Product, "id" | "updated_at" | "image_id"> } | { ok: false; error: string } {
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const code = normalizeProductInput(field("code")).toUpperCase();
  const name = field("name");
  const price = normalizeProductInput(field("price")).replace(/٫/g, ".");
  const currency = field("currency") || "LYD";
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) return { ok: false, error: "اكتب كودًا من 1 إلى 40 حرفًا إنجليزيًا أو رقمًا. يُسمح بالشرطة والشرطة السفلية، مثل P100." };
  if (!name || name.length > 120) return { ok: false, error: "اكتب اسم المنتج من 1 إلى 120 حرفًا." };
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(price)) return { ok: false, error: "اكتب سعرًا صالحًا دون فواصل آلاف، مثل 120 أو 120.500، وبحد أقصى 3 خانات عشرية." };
  if (!Object.hasOwn(PRODUCT_CURRENCIES, currency)) return { ok: false, error: "اختر عملة من القائمة." };
  const [whole, fraction = ""] = price.split(".");
  return { ok: true, product: { code, name, price_milli: Number(whole) * 1000 + Number(fraction.padEnd(3, "0")), currency, active: form.get("active") === "on" ? 1 : 0 } };
}

export async function getProducts(db: D1Database): Promise<Product[]> {
  return (await db.prepare("SELECT * FROM products ORDER BY id DESC").all<Product>()).results;
}

export async function getProductSettings(db: D1Database): Promise<ProductBotSettings> {
  const row = await db.prepare("SELECT value FROM automation_settings WHERE key = 'product_bot'").first<{ value: string }>();
  if (!row) return { ...DEFAULT_PRODUCT_SETTINGS };
  try {
    const value = JSON.parse(row.value);
    return {
      enabled: value?.enabled === true,
      prompt: typeof value?.prompt === "string" && value.prompt.trim() && value.prompt.length <= 500 ? value.prompt : DEFAULT_PRODUCT_SETTINGS.prompt,
      unknown: typeof value?.unknown === "string" && value.unknown.trim() && value.unknown.length <= 500 ? value.unknown : DEFAULT_PRODUCT_SETTINGS.unknown
    };
  } catch { return { ...DEFAULT_PRODUCT_SETTINGS }; }
}

export async function saveProduct(db: D1Database, product: Omit<Product, "id" | "updated_at" | "image_id">, id: number | null, image?: ProductImage | null): Promise<{ ok: boolean; error?: string }> {
  const duplicate = await db.prepare("SELECT id FROM products WHERE code = ? AND id != ?").bind(product.code, id ?? 0).first();
  if (duplicate) return { ok: false, error: "هذا الكود مستخدم لمنتج آخر. اختر كودًا مختلفًا." };
  const existing = id !== null ? await db.prepare("SELECT id, image_id FROM products WHERE id = ?").bind(id).first<{ id: number; image_id: string | null }>() : null;
  if (id !== null && !existing) return { ok: false, error: "المنتج غير موجود. حدّث الصفحة وحاول مجددًا." };
  const now = new Date().toISOString();
  try {
    const statements: D1PreparedStatement[] = [];
    if (image) statements.push(db.prepare("INSERT OR IGNORE INTO product_images(id, mime, data) VALUES (?, ?, ?)").bind(image.id, image.mime, image.bytes));
    const imageId = image === undefined ? existing?.image_id ?? null : image?.id ?? null;
    if (id === null) statements.push(db.prepare("INSERT INTO products (code, name, price_milli, currency, active, updated_at, image_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(product.code, product.name, product.price_milli, product.currency, product.active, now, imageId));
    else statements.push(db.prepare("UPDATE products SET code = ?, name = ?, price_milli = ?, currency = ?, active = ?, updated_at = ?, image_id = ? WHERE id = ?")
      .bind(product.code, product.name, product.price_milli, product.currency, product.active, now, imageId, id));
    await db.batch(statements);
    return { ok: true };
  } catch (error) {
    if (String(error).includes("reply_trial_product_limit")) return { ok: false, error: "التجربة المجانية تسمح بإضافة 20 منتجًا." };
    if (String(error).includes("UNIQUE constraint failed: products.code")) return { ok: false, error: "هذا الكود مستخدم لمنتج آخر. اختر كودًا مختلفًا." };
    throw error;
  }
}

function reply(key: string, label: string, text: string): ProductReply {
  return { key, label, paused: false, message: { text } };
}

/** Product lookups precede keyword rules. General help is only used after other automations have had a chance. */
export async function findProductReply(db: D1Database, input: string): Promise<ProductReply | null> {
  const normalized = normalizeProductInput(input);
  const candidates = [...new Set(normalized.toUpperCase().split(/[^\p{L}\p{N}_-]+/u).filter((word) => /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(word)))].slice(0, 30);
  if (!candidates.length) return null;
  const products = (await db.prepare(`SELECT * FROM products WHERE code IN (${candidates.map(() => "?").join(",")})`).bind(...candidates).all<Product>()).results
    .filter((product) => isBasicallyKeyword(normalized, product.code));
  if (products.length > 1) return reply("catalog:help", "طلب كود واحد", "أرسل كود منتج واحد في كل رسالة، ونقولك اسمه وسعره 🌷");
  const product = products[0];
  if (!product) return null;
  if (!product.active) return reply(`catalog:${product.id}`, `منتج متوقف: ${product.name}`, "متأسف، المنتج غير متوفر حاليًا.");
  const result = reply(`catalog:${product.id}`, `سعر: ${product.name}`, `أهلًا بيك 🌷\nالمنتج: ${product.name}\nالكود: \u2066${product.code}\u2069\nالسعر: ${formatProductPrice(product)}\nلو تبي تطلبه أو عندك أي سؤال، يسعدنا نساعدوك.`);
  const path = productImagePath(product.image_id);
  if (path) result.image = { path, alt: product.name };
  return result;
}

export function productHelpReply(settings: ProductBotSettings, text: string, hasImage: boolean): ProductReply {
  const normalized = normalizeProductInput(text).toLowerCase().replace(/[!?؟.،,🌷]/gu, "").trim();
  if (hasImage) return reply("catalog:help", "طلب كود المنتج بعد صورة", settings.prompt);
  if (/^(شكرا|شكراً|شكرًا|مشكور|تسلم|يسلمو|thanks|thank you)$/.test(normalized)) return reply("catalog:thanks", "شكر العميل", "العفو، هذا واجبنا 🌷 لو تبي سعر منتج ثاني أرسل كوده.");
  if (/^[a-z][a-z_-]{1,39}$/i.test(normalized) && !/^(hello|hi|hey|thanks|price|delivery|shipping|payment|order|buy|return|refund|location|address|human|agent)$/.test(normalized)) return reply("catalog:unknown", "كود منتج غير موجود", settings.unknown);
  if (normalized.split(/[^\p{L}\p{N}_-]+/u).some((word) => /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(word) && /\d/.test(word) && isBasicallyKeyword(normalized, word))) return reply("catalog:unknown", "كود منتج غير موجود", settings.unknown);
  return reply("catalog:help", "طلب كود المنتج", settings.prompt);
}

export async function previewProductReply(db: D1Database, text: string, hasImage: boolean): Promise<ProductReply | null> {
  const settings = await getProductSettings(db);
  if (!settings.enabled) return null;
  return await findProductReply(db, text) ?? productHelpReply(settings, text, hasImage);
}
