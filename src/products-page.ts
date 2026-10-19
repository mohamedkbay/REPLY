import { appearanceHead, appearanceStyles } from "./appearance";
import { productImagePath } from "./product-images";
import { baseStyles, formStyles, headerStyles, PRODUCT_NAME, renderHeader, renderFooter } from "./theme";
import { formatProductPrice, PRODUCT_CURRENCIES, type Product, type ProductBotSettings } from "./products";
import { renderBotPreview, botPreviewScript, botPreviewStyles } from "./bot-preview";

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function productForm(product?: Product, draft?: FormData): string {
  const value = (key: string, fallback: string) => esc(draft ? String(draft.get(key) ?? "") : fallback);
  const price = product ? String(product.price_milli / 1000) : "";
  const active = draft ? draft.get("active") === "on" : product ? Boolean(product.active) : true;
  return `<form class="inventory-form" method="post" enctype="multipart/form-data" action="/admin/products${product ? `/${product.id}` : ""}">
    <label>اسم المنتج<input name="name" dir="auto" value="${value("name", product?.name ?? "")}" placeholder="مثال: حقيبة يد" maxlength="120" required></label>
    <label>الكود<input name="code" dir="ltr" value="${value("code", product?.code ?? "")}" placeholder="P100" maxlength="40" required autocomplete="off"></label>
    <label>السعر<input name="price" dir="ltr" inputmode="decimal" value="${value("price", price)}" placeholder="120" required></label>
    <label>العملة<select name="currency">${Object.entries(PRODUCT_CURRENCIES).map(([code, label]) => `<option value="${code}" ${value("currency", product?.currency ?? "LYD") === code ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <div class="product-image-field"><div class="image-choice"><img data-image-preview ${productImagePath(product?.image_id) ? `src="${productImagePath(product?.image_id)}"` : "hidden"} alt="معاينة صورة المنتج" width="88" height="88"><div><label>صورة المنتج <span class="optional">اختيارية</span><input type="file" name="image_file" accept="image/jpeg,image/png" data-product-image><span class="field-help">اختار صورة من جهازك. تظهر للعميل مع الاسم والسعر.</span></label><p class="image-upload-status" data-image-status role="status"></p>${product?.image_id ? '<label class="remove-image"><input type="checkbox" name="remove_image"> إزالة الصورة الحالية</label>' : ""}</div></div></div>
    <div class="inventory-form-footer"><label class="switch-label"><input name="active" type="checkbox" ${active ? "checked" : ""}><span class="switch"></span>متوفر للبيع</label><div>${product ? '<a class="button secondary" href="/admin/products">إلغاء</a>' : ""}<button name="action" value="save" class="button primary">${product ? "حفظ التعديل" : "إضافة للمخزن"}</button></div></div>
  </form>`;
}

export function renderProductsPage(data: {
  products: Product[]; settings: ProductBotSettings; dryRun: boolean;
  saved?: boolean; error?: string; editId?: number;
  draft?: { id: number | null; form: FormData };
}): string {
  const mode = `<span class="mode ${data.dryRun ? "test" : ""}"><i></i>${data.dryRun ? "وضع الاختبار" : "مباشر"}</span>`;
  const available = data.products.filter(product => product.active).length;
  return `<!doctype html><html lang="ar" dir="rtl" data-palette="studio"><head><meta charset="utf-8">${appearanceHead}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>المخزن · ${PRODUCT_NAME}</title><style>${baseStyles}${formStyles}${headerStyles}${styles}${botPreviewStyles}</style><link rel="stylesheet" href="/reply-studio.css?v=5">${appearanceStyles}</head><body>
    <a class="skip" href="#main">انتقل إلى المحتوى</a>${renderHeader("products", mode)}
    <main id="main" class="inventory-shell" data-stock-view="gallery">
      <div class="inventory-heading"><div><h1>المخزن</h1><p>بضاعتك وأسعارها. فعّل المتوفر، وأوقف الباقي بضغطة.</p></div><div class="inventory-heading-actions"><button type="button" class="button primary studio-add" id="studio-add" aria-controls="inventory-add" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>إضافة منتج</button><a class="text-link" href="/admin/settings?tab=replies">إعداد ردود البوت</a></div></div>
      ${data.saved ? '<p class="inventory-success" role="status">تم الحفظ.</p>' : ""}
      ${data.error ? `<p class="notice inventory-error" role="alert">${esc(data.error)}</p>` : ""}
      <details id="inventory-add" class="inventory-add" ${data.draft?.id === null ? "open" : ""}><summary class="button primary">إضافة منتج</summary><div class="inventory-add-body"><h2>منتج جديد</h2>${productForm(undefined, data.draft?.id === null ? data.draft.form : undefined)}</div></details>
      <section class="stock-list" aria-labelledby="stock-heading">
        <div class="stock-toolbar"><div><h2 id="stock-heading">كل البضاعة</h2><span>${available} متوفر من ${data.products.length}</span></div><div class="stock-tools"><div class="stock-view-toggle" role="group" aria-label="طريقة عرض المنتجات"><button type="button" data-stock-view="gallery" aria-pressed="true">صور</button><button type="button" data-stock-view="list" aria-pressed="false">قائمة</button></div><label class="stock-search"><span class="sr-only">ابحث في المخزن</span><input type="search" id="stock-search" placeholder="ابحث بالاسم أو الكود"></label></div></div>
        ${data.products.length ? `<table class="stock-table"><thead><tr><th>المنتج</th><th>الكود</th><th>السعر</th><th>التوفر</th><th><span class="sr-only">التعديل</span></th></tr></thead><tbody>${data.products.map(product => {
          const editing = data.editId === product.id || data.draft?.id === product.id;
          return `<tr data-stock-item data-search="${esc((product.name + " " + product.code).toLowerCase())}"><td data-column="المنتج"><span class="stock-product">${productImagePath(product.image_id) ? `<img src="${productImagePath(product.image_id)}" alt="${esc(product.name)}" width="48" height="48" loading="lazy">` : `<span class="stock-photo-empty"><bdi>${esc(product.code)}</bdi><small>بدون صورة</small></span>`}<strong dir="auto" translate="no">${esc(product.name)}</strong></span></td><td data-column="الكود"><bdi class="stock-code">${esc(product.code)}</bdi></td><td data-column="السعر">${esc(formatProductPrice(product))}</td><td data-column="التوفر"><form method="post" action="/admin/products/${product.id}/availability"><input type="hidden" name="active" value="${product.active ? "0" : "1"}"><button class="stock-switch ${product.active ? "available" : ""}" role="switch" aria-checked="${Boolean(product.active)}" aria-label="توفر ${esc(product.name)}"><span aria-hidden="true"></span>${product.active ? "متوفر" : "غير متوفر"}</button></form></td><td><a class="text-link" href="/admin/products?edit=${product.id}#edit-${product.id}" aria-label="تعديل ${esc(product.name)}">تعديل</a></td></tr>${editing ? `<tr class="stock-edit" id="edit-${product.id}"><td colspan="5"><h3>تعديل ${esc(product.name)}</h3>${productForm(product, data.draft?.id === product.id ? data.draft.form : undefined)}</td></tr>` : ""}`;
        }).join("")}</tbody></table><p class="stock-empty" id="stock-no-results" hidden>لا توجد منتجات مطابقة للبحث.</p>` : '<div class="stock-empty"><h3>ابدأ بأول منتج</h3><p>اضغط «إضافة منتج» واكتب الاسم والكود والسعر.</p></div>'}
        <p class="stock-note">المنتج الموقوف: «متأسف، المنتج غير متوفر حاليًا». الكود المجهول: «الكود مش موجود، تأكد من الكود».</p>
      </section>
      <details class="inventory-preview"><summary>جرّب رد البوت على كود منتج</summary><div>${renderBotPreview("product")}</div></details>
    </main>${renderFooter()}<script>${script}${botPreviewScript}</script></body></html>`;
}

const script = `
const studioAdd = document.getElementById('studio-add'), inventoryAdd = document.getElementById('inventory-add');
const syncAdd = () => studioAdd.setAttribute('aria-expanded', String(inventoryAdd.open)); syncAdd(); inventoryAdd.addEventListener('toggle', syncAdd);
studioAdd.addEventListener('click', () => { inventoryAdd.open = !inventoryAdd.open; if (inventoryAdd.open) inventoryAdd.querySelector('input[name=name]').focus(); });
document.querySelectorAll('button[data-stock-view]').forEach(button => button.addEventListener('click', () => {
  const update = () => { document.querySelector('.inventory-shell').dataset.stockView = button.dataset.stockView; document.querySelectorAll('button[data-stock-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update); else update();
}));
const stockSearch = document.getElementById('stock-search');
stockSearch.addEventListener('input', () => {
  let shown = 0; const query = stockSearch.value.trim().toLowerCase();
  document.querySelectorAll('[data-stock-item]').forEach(row => { row.hidden = !row.dataset.search.includes(query); if (!row.hidden) shown++; });
  const empty = document.getElementById('stock-no-results'); if (empty) empty.hidden = shown > 0;
});
document.querySelectorAll('[data-product-image]').forEach(input => {
  const form = input.form, preview = form.querySelector('[data-image-preview]'), status = form.querySelector('[data-image-status]'), submit = form.querySelector('button[value="save"]');
  const original = preview.getAttribute('src'); let generation = 0, objectUrl = null;
  input.addEventListener('change', async () => {
    const current = ++generation; input.setCustomValidity(''); status.textContent = '';
    const file = input.files[0];
    if (!file) { if (original) preview.src = original; else preview.removeAttribute('src'); preview.hidden = !original; return; }
    submit.disabled = true; status.textContent = 'تجهيز الصورة…';
    let localUrl;
    try {
      if (!['image/jpeg','image/png'].includes(file.type) || file.size > 25_000_000) throw new Error('اختار صورة JPG أو PNG بحجم أقل من 25 ميغابايت.');
      localUrl = URL.createObjectURL(file); const image = new Image(); image.src = localUrl; await image.decode();
      if (current !== generation) return;
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.86));
      if (current !== generation) return;
      if (!blob || blob.size > 1_500_000) throw new Error('الصورة كبيرة. اختار صورة أصغر.');
      const transfer = new DataTransfer(); transfer.items.add(new File([blob],'product.jpg',{type:'image/jpeg'})); input.files = transfer.files;
      if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(blob); preview.src = objectUrl; preview.hidden = false;
      const remove = form.querySelector('[name="remove_image"]'); if (remove) remove.checked = false;
      status.textContent = 'الصورة جاهزة. احفظ المنتج لإضافتها.';
    } catch (error) { if (current === generation) { input.value = ''; input.setCustomValidity(error.message); status.textContent = error.message; } }
    finally { if (localUrl) URL.revokeObjectURL(localUrl); if (current === generation) submit.disabled = false; }
  });
  const remove = form.querySelector('[name="remove_image"]'); if (remove) remove.addEventListener('change', () => { if (!input.files.length) preview.hidden = remove.checked; });
});
document.querySelectorAll('.stock-switch').forEach(button => button.form.addEventListener('submit', () => { button.disabled = true; }));
`;

const styles = `
.studio-add{display:none}.inventory-heading-actions{display:flex;flex-direction:column;align-items:flex-end;gap:14px}.inventory-shell{max-width:1100px;margin:auto;padding:44px 32px 80px}.inventory-heading{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:28px}.inventory-heading h1{font-size:28px;color:var(--ink);font-weight:700}.inventory-heading p{color:var(--muted);margin-top:4px}.inventory-success{padding:10px 14px;color:var(--accent);background:var(--accent-soft);border-radius:8px;margin-bottom:18px}.inventory-error{color:var(--danger);margin-bottom:18px}.inventory-add>summary{width:fit-content;list-style:none;height:40px}.inventory-add>summary::-webkit-details-marker{display:none}.inventory-add>summary:before{content:'+';font-size:20px;line-height:1}.inventory-add[open]>summary{margin-bottom:16px}.inventory-add-body{background:var(--surface);padding:24px;border:1px solid var(--line);border-radius:12px}.inventory-add-body h2{font-size:17px;margin-bottom:18px}.inventory-form{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,1.2fr);gap:16px}.inventory-form label{min-width:0}.product-image-field{grid-column:1/-1;padding-block:8px}.image-choice{display:flex;gap:18px;align-items:flex-start}.image-choice>img{flex:none;width:88px;height:88px;object-fit:contain;border-radius:10px;background:var(--accent-soft)}.image-choice>div{min-width:0;flex:1}.image-choice input[type=file]{max-width:420px;padding:8px;font-size:13px}.image-choice input::file-selector-button{font:inherit;background:var(--accent-soft);color:var(--accent);border:0;border-radius:5px;padding:6px 10px;margin-inline-end:10px;cursor:pointer}.image-upload-status{font-size:12px;color:var(--accent);margin-top:6px}.remove-image{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:10px;color:var(--muted)}.stock-product{display:flex;align-items:center;gap:12px}.stock-photo-empty{display:none}.stock-product img{flex:none;object-fit:contain;border-radius:8px;background:var(--accent-soft)}.inventory-form-footer{grid-column:1/-1;display:flex;justify-content:space-between;gap:16px;align-items:center}.inventory-form-footer>div{display:flex;gap:8px}.stock-list{margin-top:28px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}.stock-toolbar{padding:22px 24px;display:flex;justify-content:space-between;gap:20px;align-items:center}.stock-toolbar>div{display:flex;align-items:baseline;gap:12px}.stock-toolbar h2{font-size:17px;color:var(--ink)}.stock-toolbar span{font-size:13px;color:var(--muted)}.stock-search{width:240px}.stock-table{width:100%;border-collapse:collapse;font-size:14px}.stock-table th{padding:12px 24px;background:#f6f6f2;text-align:start;font-weight:500;color:var(--muted);font-size:12px;white-space:nowrap;border-block:1px solid var(--line)}.stock-table td{padding:18px 24px;border-bottom:1px solid var(--line);vertical-align:middle}.stock-table td:first-child{width:32%}.stock-table strong{font-weight:600;overflow-wrap:anywhere}.stock-table form{margin:0}.stock-code{overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;color:var(--muted)}.stock-switch{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);border-radius:999px;background:#f4f3ef;color:var(--muted);font-size:12px;padding:6px 12px;white-space:nowrap}.stock-switch>span{width:7px;height:7px;background:currentColor;border-radius:50%}.stock-switch.available{color:var(--accent);border-color:#c4d2c7;background:var(--accent-soft)}.stock-switch:hover{border-color:var(--accent)}.stock-switch:disabled{opacity:.5;cursor:wait}.stock-edit>td{background:#f8f8f4!important;padding:24px}.stock-edit h3{font-size:15px;margin-bottom:18px}.stock-note{padding:16px 24px;font-size:12px;color:var(--muted);line-height:1.8}.stock-empty{padding:40px 24px;text-align:center;color:var(--muted)}.stock-empty h3{color:var(--ink);font-size:17px;margin-bottom:6px}.inventory-preview{margin-top:28px;border-top:1px solid var(--line);padding-top:20px}.inventory-preview>summary{cursor:pointer;color:var(--accent);font-size:14px;width:fit-content}.inventory-preview>div{max-width:480px;margin-top:20px}
@media(max-width:1050px){.stock-table th,.stock-table td{padding-inline:16px}.inventory-form{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.image-choice{gap:12px}.image-choice>img{width:64px;height:64px}.inventory-shell{padding:28px 20px 56px}.inventory-heading{align-items:flex-start;flex-direction:column;gap:12px}.inventory-heading h1{font-size:24px}.stock-toolbar{flex-direction:column;align-items:stretch;padding:18px}.stock-search{width:100%}.stock-table thead{display:none}.stock-table,.stock-table tbody{display:block}.stock-table tr[data-stock-item]{display:grid;grid-template-columns:minmax(0,1fr) auto;padding:18px;gap:10px;border-top:1px solid var(--line)}.stock-table td{display:block;padding:0;border:0;width:auto!important}.stock-table td:first-child{grid-column:1/-1}.stock-table td:nth-child(3){grid-column:1;grid-row:3}.stock-table td:nth-child(4){grid-column:2;grid-row:2}.stock-table td:last-child{grid-column:2;grid-row:3;text-align:end}.stock-edit,.stock-edit>td{display:block}.inventory-add-body{padding:18px}.inventory-form{grid-template-columns:1fr 1fr;gap:14px}.inventory-form>label:first-child{grid-column:1/-1}.inventory-form-footer{flex-wrap:wrap}.stock-note{padding:16px 18px}}
`;
