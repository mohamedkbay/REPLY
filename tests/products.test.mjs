import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { buildWorker, createHarness, messagePayload, createRule } from './worker-harness.mjs';
let built;
before(async () => { built = await buildWorker(); });
after(async () => { await built?.dispose(); });
async function fixture(t, overrides = {}) {
  const h = await createHarness(built.worker, overrides);
  t.after(() => h.dispose());
  const cookie = await h.login();
  const settings = await h.postForm('/admin/products/settings', {
    enabled: 'on', prompt: 'أهلًا بيك، أرسل كود المنتج ونقولك سعره 🌷', unknown: 'الكود غير موجود، تأكد منه وحاول مجددًا.'
  }, cookie);
  assert.equal(settings.status, 303);
  return { h, cookie };
}
async function product(h, cookie, values = {}, path = '/admin/products') {
  return h.postForm(path, { code: 'P100', name: 'حقيبة يد', price: '120.500', currency: 'LYD', active: 'on', ...values }, cookie);
}
function sends(h) { return h.calls.filter(call => call.url.pathname.endsWith('/messages')); }

test('product CRUD preserves decimal prices, validates unique codes, and escapes user names', async t => {
  const { h, cookie } = await fixture(t);
  assert.equal((await product(h, cookie, { code: 'p١٠٠', name: '<img src=x onerror=alert(1)>' })).status, 303);
  let row = h.query('SELECT * FROM products');
  assert.equal(row.code, 'P100'); assert.equal(row.price_milli, 120500);
  assert.equal((await product(h, cookie)).status, 400);
  assert.equal((await product(h, cookie, { code: 'P200', price: '-5' })).status, 400);
  assert.equal((await product(h, cookie, { code: 'P200', price: '12.1234' })).status, 400);
  assert.equal((await product(h, cookie, { code: 'P200', currency: 'FAKE' })).status, 400);
  const page = await (await h.request('/admin/products', { headers: { cookie } })).text();
  assert.match(page, /lang="ar" dir="rtl"/); assert.match(page, /&lt;img/); assert.doesNotMatch(page, /<img src=x/);
  assert.equal((await product(h, cookie, { price: '١٥٠٫٢٥٠' }, '/admin/products/' + row.id)).status, 303);
  row = h.query('SELECT * FROM products'); assert.equal(row.price_milli, 150250);
});

test('signed code message sends the current product name and price once, with case and Arabic digits supported', async t => {
  const { h, cookie } = await fixture(t);
  await product(h, cookie);
  const payload = messagePayload('catalog-1', 'بكم p١٠٠ من فضلك');
  await h.webhook(payload); await h.webhook(payload);
  assert.equal(sends(h).length, 1);
  const text = sends(h)[0].body.message.text;
  assert.match(text, /حقيبة يد/); assert.match(text, /120[,٫.]5/); assert.match(text, /دينار ليبي/);
  assert.equal(h.query("SELECT reply_key FROM message_events WHERE message_id = 'catalog-1'").reply_key, 'catalog:1');
  await product(h, cookie, { price: '95' }, '/admin/products/1');
  await h.webhook(messagePayload('catalog-2', 'P100'));
  assert.match(sends(h)[1].body.message.text, /95/); assert.doesNotMatch(sends(h)[1].body.message.text, /120[,٫.]5/);
});

test('a price inquiry or a real image-only webhook asks for the code without treating echoes as new customers', async t => {
  const { h } = await fixture(t);
  await h.webhook(messagePayload('price-question', 'بكم؟'));
  assert.match(sends(h)[0].body.message.text, /أرسل كود المنتج/);
  const image = messagePayload('image-1', '');
  image.entry[0].messaging[0].message.attachments = [{ type: 'image', payload: { url: 'https://example.test/photo.jpg' } }];
  await h.webhook(image); await h.webhook(image);
  assert.equal(sends(h).length, 2); assert.match(sends(h)[1].body.message.text, /أرسل كود المنتج/);
  assert.equal(h.query("SELECT message_text FROM message_events WHERE message_id = 'image-1'").message_text, '📷 صورة منتج');
  image.entry[0].messaging[0].message.mid = 'echo-image'; image.entry[0].messaging[0].message.is_echo = true;
  await h.webhook(image); assert.equal(sends(h).length, 2);
});

test('unknown codes never invent a price and inactive products never quote their stored price', async t => {
  const { h, cookie } = await fixture(t);
  await h.webhook(messagePayload('unknown', 'P999'));
  assert.match(sends(h)[0].body.message.text, /الكود غير موجود/);
  await product(h, cookie, { active: '' });
  await h.webhook(messagePayload('inactive', 'P100'));
  assert.match(sends(h)[1].body.message.text, /غير متوفر/); assert.doesNotMatch(sends(h)[1].body.message.text, /120/);
});

test('product previews never send externally, and test mode records matches while keeping Meta untouched', async t => {
  const { h, cookie } = await fixture(t, { DRY_RUN: 'true' });
  await product(h, cookie);
  const preview = await h.postForm('/admin/products/preview', { text: 'P100' }, cookie);
  assert.equal(preview.status, 200); assert.match((await preview.json()).text, /120[,٫.]5/);
  await h.webhook(messagePayload('dry-code', 'P100'));
  assert.equal(h.calls.length, 0); assert.equal(h.query("SELECT status FROM message_events WHERE message_id = 'dry-code'").status, 'dry_run_matched');
  const settings = await h.postForm('/admin/products/settings', { prompt: 'أرسل الكود', unknown: 'غير موجود' }, cookie);
  assert.equal(settings.status, 303);
  const disabled = await h.postForm('/admin/products/preview', { text: 'P100' }, cookie);
  assert.match((await disabled.json()).text, /متوقف/);
});

test('catalog changes and previews require authentication and reject cross-site requests', async t => {
  const { h, cookie } = await fixture(t);
  assert.equal((await product(h, undefined)).status, 303);
  assert.equal((await h.postForm('/admin/products/preview', { text: 'P100' })).status, 401);
  const response = await h.request('/admin/products', { method: 'POST', headers: { cookie, origin: 'https://other.test' }, body: new URLSearchParams({ code: 'P100' }) });
  assert.equal(response.status, 403); assert.equal(h.query('SELECT COUNT(*) AS n FROM products').n, 0);
});

test('existing keyword automations keep priority over catalog general help, and expired DMs cannot trigger sends', async t => {
  const { h, cookie } = await fixture(t);
  await createRule(h, cookie, { label: 'استفسار الشحن', keywords: 'شحن', channels: 'dms', reply_text: 'الشحن خلال يومين' });
  await h.webhook(messagePayload('shipping', 'شحن'));
  assert.equal(sends(h)[0].body.message.text, 'الشحن خلال يومين');
  const old = messagePayload('old-price', 'بكم'); old.entry[0].messaging[0].timestamp = Date.now() - 25 * 60 * 60 * 1000;
  await h.webhook(old); assert.equal(sends(h).length, 1);
  assert.equal(h.query("SELECT status FROM message_events WHERE message_id = 'old-price'").status, 'ignored_expired');
});


test('Arabic automations accept Arabic commas and polite requests with the same server matcher', async t => {
  const { h, cookie } = await fixture(t);
  await createRule(h, cookie, { label: 'رابط الدليل', keywords: 'دليل،كتيب', channels: 'dms', reply_text: 'تفضل الدليل' });
  const row = h.query("SELECT keywords FROM rules WHERE label = ?", 'رابط الدليل');
  assert.deepEqual(JSON.parse(row.keywords), ['دليل', 'كتيب']);
  await h.webhook(messagePayload('arabic-guide', 'ممكن ترسل لي دليل من فضلك'));
  assert.equal(sends(h)[0].body.message.text, 'تفضل الدليل');
});
