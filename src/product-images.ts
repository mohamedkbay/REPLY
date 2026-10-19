export const MAX_PRODUCT_IMAGE_BYTES = 1_500_000;
export type ProductImage = { id: string; mime: 'image/jpeg' | 'image/png'; bytes: Uint8Array };
export type ReplyImage = { path: string; alt: string };

export function productImagePath(id: string | null | undefined): string | null {
  return id && /^[a-f0-9]{64}$/.test(id) ? `/media/products/${id}` : null;
}

export async function parseProductImage(form: FormData): Promise<{ ok: true; image?: ProductImage | null } | { ok: false; error: string }> {
  const file = form.get('image_file');
  if (!(file instanceof File) || file.size === 0) return { ok: true, ...(form.get('remove_image') === 'on' ? { image: null } : {}) };
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return { ok: false, error: 'الصورة كبيرة. اختار صورة JPG أو PNG أصغر من 1.5 ميغابايت.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes.length >= 33 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte) && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR';
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length-2] === 255 && bytes[bytes.length-1] === 217;
  if ((!png && !jpeg) || (file.type && !['image/jpeg','image/png'].includes(file.type))) return { ok: false, error: 'الملف مش صورة مدعومة. اختار صورة JPG أو PNG.' };
  const id = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2,'0')).join('');
  return { ok: true, image: { id, mime: png ? 'image/png' : 'image/jpeg', bytes } };
}

/** Public read-only image URLs allow messaging platforms to retrieve uploaded product photos. */
export async function serveProductImage(request: Request, db: D1Database, id: string): Promise<Response> {
  if (!['GET','HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404 });
  const row = await db.prepare('SELECT mime, data FROM product_images WHERE id = ?').bind(id).first<{ mime: string; data: ArrayBuffer | number[] | Uint8Array }>();
  if (!row) return new Response(null, { status: 404 });
  const headers = { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", etag: `"${id}"` };
  if (request.headers.get('if-none-match') === `"${id}"`) return new Response(null, { status: 304, headers });
  const bytes = Array.isArray(row.data) ? new Uint8Array(row.data) : row.data;
  return new Response(request.method === 'HEAD' ? null : bytes, { headers });
}

/** Instagram/Messenger use an image and a text message; WhatsApp/Telegram use a caption. */
export async function sendPhotoReply(image: ReplyImage, text: string, origin: string,
  sendText: () => Promise<unknown>, sendPhoto: (url: string, caption: string) => Promise<unknown>, captioned: boolean
): Promise<{ metaResponse: unknown; imageId: string | null; warning?: string }> {
  let response: unknown;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !/^\/media\/products\/[a-f0-9]{64}$/.test(image.path)) throw new Error();
    response = await sendPhoto(new URL(image.path, url.origin).href, text);
  } catch {
    return { metaResponse: await sendText(), imageId: null, warning: 'أُرسل النص فقط؛ تعذّر إرسال صورة المنتج. تحقق من الرابط العام وصلاحيات الحساب.' };
  }
  // Keep the text send outside the photo catch: a failed text must not trigger a second photo/text attempt.
  return { metaResponse: captioned ? response : [response, await sendText()], imageId: image.path.split('/').at(-1)! };
}
