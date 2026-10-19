export function renderBotPreview(mode: "product" | "business" | "tiktok" = "business"): string {
  return `<section class="chat-panel" aria-labelledby="chat-heading"><div class="chat-heading"><h2 id="chat-heading">${mode === "tiktok" ? "جرّب تعليق TikTok" : "جرّب المحادثة"}</h2><span>${mode === "tiktok" ? "تعليق نصّي فقط" : "رسائل · صور ونص"}</span></div>
    <div class="chat-messages" id="product-chat" role="log" aria-live="polite" aria-relevant="additions"><p class="bot-message">أهلًا بيك! جرّب سؤالًا أو كود منتج وشوف كيف يرد ${mode === "business" ? "Reply" : "البوت"}.</p></div>
    <form id="product-chat-form" class="chat-compose" data-endpoint="/admin/${mode === "tiktok" ? "tiktok" : mode === "business" ? "settings" : "products"}/preview"><label class="sr-only" for="chat-input">رسالتك التجريبية</label><input id="chat-input" name="text" placeholder="بكم؟ أو كود المنتج" autocomplete="off" dir="auto" maxlength="1000"><button class="button primary" type="submit">إرسال</button></form>
    <div class="chat-bottom"><button class="text-link" type="button" id="simulate-photo" ${mode === "tiktok" ? "hidden" : ""}>جرّب وصول صورة</button><p class="field-help">${mode === "tiktok" ? "هذه معاينة لتعليق عام نصّي؛ لا تنشر تعليقًا على حسابك." : "الصور تظهر للمنتجات المتوفرة والمرفقة بصورة. لا تُرسل التجربة أي رسالة لحساباتك."}</p><p id="chat-error" class="chat-error" role="alert"></p></div>
  </section>`;
}

export const botPreviewScript = `
(() => {
  const form = document.getElementById('product-chat-form'); if (!form) return;
  const input = document.getElementById('chat-input'), list = document.getElementById('product-chat'), photo = document.getElementById('simulate-photo'), error = document.getElementById('chat-error');
  let busy = false;
  const append = (text, role, image) => { const line = document.createElement('p'); line.className = role + '-message'; line.dir = 'auto'; line.translate = false; if (image && new RegExp('^/media/products/[a-f0-9]{64}$').test(image.path)) { const photo = document.createElement('img'); photo.src = image.path; photo.alt = image.alt || 'صورة المنتج'; photo.className = 'bot-product-photo'; photo.addEventListener('load', () => { list.scrollTop = list.scrollHeight; }); photo.addEventListener('error', () => { photo.remove(); }); line.append(photo); } line.append(document.createTextNode(text)); list.append(line); list.scrollTop = list.scrollHeight; };
  async function send(image) {
    if (busy || (!image && !input.value.trim())) return;
    const text = image ? '' : input.value.trim(); busy = true; error.textContent = ''; form.setAttribute('aria-busy', 'true');
    form.querySelector('button').disabled = true; photo.disabled = true; append(image ? 'صورة منتج' : text, 'user');
    try {
      const body = new FormData(); body.set('text', text); body.set('image', String(image));
      const response = await fetch(form.dataset.endpoint, { method: 'POST', body, credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(response.status === 401 ? 'انتهت جلسة الدخول. أعد تسجيل الدخول.' : 'تعذّر تحميل الرد. حاول مجددًا.');
      const result = await response.json(); append(result.text, 'bot', result.image); if (!image) input.value = '';
    } catch (caught) { error.textContent = caught.message || 'تعذّر الاتصال بالخادم.'; }
    finally { busy = false; form.removeAttribute('aria-busy'); form.querySelector('button').disabled = false; photo.disabled = false; input.focus(); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); send(false); }); photo.addEventListener('click', () => send(true));
  document.querySelectorAll('[data-try-message]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.tryMessage; send(false); }));
})();
`;

export const botPreviewStyles = `
.chat-panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}.chat-heading{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:18px;border-bottom:1px solid var(--line)}.chat-heading h2{font-size:17px}.chat-heading span{font-size:12px;color:var(--muted)}.chat-messages{height:460px;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:18px;background:var(--bg)}.chat-messages p{padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;font-size:14px;max-width:94%;flex-shrink:0}.bot-product-photo{display:block;width:100%;max-width:240px;height:180px;object-fit:contain;border-radius:7px;margin-bottom:10px;background:var(--surface)}.bot-message{align-self:flex-start;background:var(--accent-soft);color:var(--ink)}.user-message{align-self:flex-end;background:#eeede7}.chat-compose{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}.chat-compose input{min-width:0}.chat-compose .button{height:42px}.chat-bottom{padding:0 18px 18px}.chat-bottom p{margin-top:8px}.chat-error{font-size:13px;color:var(--danger)}
`;
