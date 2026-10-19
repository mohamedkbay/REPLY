import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { before, after, test } from 'node:test';
import { buildModule, buildWorker, createHarness, createRule, messagePayload } from './worker-harness.mjs';
let built, replies, accounts;
before(async () => { built = await buildWorker(); replies = await buildModule('src/smart-replies.ts'); accounts = await buildModule('src/accounts.ts'); });
after(async () => { await Promise.all([built?.dispose(), replies?.dispose(), accounts?.dispose()]); });
const appSecret = 'testMetaAppSecret1234567890123456';
const token = 'testAccessToken1234567890123456789';
async function fixture(t, overrides = {}) {
  const h = await createHarness(built.worker, { ACCOUNT_ENCRYPTION_KEY: 'fake-encryption-key-for-tests-32-characters', ...overrides });
  t.after(() => h.dispose()); const cookie = await h.login(); return { h, cookie };
}
function fields() {
  return { business_enabled: 'on', product_enabled: 'on', product_prompt: 'أرسل كود المنتج ونقولك سعره.', product_unknown: 'الكود مش موجود، تأكد من الكود.',
    ...Object.fromEntries(replies.module.REPLY_TOPICS.flatMap(topic => [[`topic_${topic.id}_enabled`, 'on'], [`topic_${topic.id}_text`, topic.text]])) };
}
async function configure(h, cookie, changes = {}) {
  const response = await h.postForm('/admin/settings/replies', { ...fields(), ...changes }, cookie);
  assert.equal(response.status, 303); return response;
}
async function preview(h, cookie, text, image = 'false') { return (await (await h.postForm('/admin/settings/preview', { text, image }, cookie)).json()).text; }
function provider(h, platform, id = '12345') {
  h.setResponder(call => new Response(JSON.stringify(platform === 'telegram' ? { ok: true, result: { is_bot: true, id: Number(id), username: 'test_bot' } } : platform === 'instagram' ? { user_id: id, username: 'test_ig' } : platform === 'facebook' ? { id, name: 'Test Page', category: 'Shopping' } : { id, display_phone_number: '+218900000000', verified_name: 'Test Shop' }), { headers: { 'content-type': 'application/json' } }));
}
async function connect(h, cookie, platform = 'facebook', id = '12345') {
  provider(h, platform, id);
  const response = await h.postForm('/admin/connections', { platform, account_id: id, token: platform === 'telegram' ? '12345:abcdefghijklmnopqrstuvwxyz' : token, app_secret: appSecret }, cookie);
  assert.equal(response.status, 303);
  return h.query('SELECT * FROM connected_accounts WHERE platform = ? AND account_id = ?', platform, id);
}
function payload(platform, id = '12345', event = 'event1', text = 'السلام عليكم', timestamp = Date.now()) {
  if (platform === 'telegram') return { update_id: Number(event), message: { date: Math.floor(timestamp / 1000), chat: { id: 998877, type: 'private' }, from: { is_bot: false }, text } };
  if (platform === 'whatsapp') return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: id }, messages: [{ id: event, from: '998877', timestamp: String(Math.floor(timestamp / 1000)), type: 'text', text: { body: text } }] } }] }] };
  return { object: platform === 'instagram' ? 'instagram' : 'page', entry: [{ id, messaging: [{ sender: { id: '998877' }, recipient: { id }, timestamp, message: { mid: event, text } }] }] };
}
async function webhook(h, platform, data, account, bad = false) {
  const body = JSON.stringify(data);
  const secrets = await accounts.module.accountSecrets(h.env, account.id);
  const headers = platform === 'telegram' ? { 'x-telegram-bot-api-secret-token': bad ? 'bad' : secrets.verifyToken } : { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', bad ? 'bad' : appSecret).update(body).digest('hex') };
  return h.request('/channels/' + platform + (platform === 'telegram' ? '/' + account.id : ''), { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body });
}

test('FAQ preview uses saved responses, supports Arabic, and keeps price and code precedence', async t => {
  const { h, cookie } = await fixture(t);
  await configure(h, cookie);
  assert.match(await preview(h, cookie, 'السَّلام عليكم'), /وعليكم السلام/);
  assert.match(await preview(h, cookie, 'سلام في توصيل لطرابلس؟'), /المدينة والمنطقة/);
  assert.match(await preview(h, cookie, 'التوصيل لمنطقة 123'), /المدينة والمنطقة/);
  assert.match(await preview(h, cookie, 'شن طرق الدفع؟'), /الدفع/);
  assert.match(await preview(h, cookie, 'بكم؟'), /أرسل كود المنتج/);
  assert.match(await preview(h, cookie, '', 'true'), /أرسل كود المنتج/);
  assert.match(await preview(h, cookie, 'P999'), /الكود مش موجود/);
  assert.match(await preview(h, cookie, 'XYZ'), /الكود مش موجود/);
  assert.equal(h.calls.length, 0);
  await h.postForm('/admin/products', { name: 'حقيبة', code: 'P1', price: '40', active: 'on' }, cookie);
  assert.equal(h.query('SELECT currency FROM products').currency, 'LYD');
  assert.match(await preview(h, cookie, 'P1'), /40 دينار ليبي/);
  await h.postForm('/admin/products/1/availability', { active: '0' }, cookie);
  const inactive = await preview(h, cookie, 'P1'); assert.equal(inactive, 'متأسف، المنتج غير متوفر حاليًا.'); assert.doesNotMatch(inactive, /40/);
  assert.equal((await h.postForm('/admin/products/1/availability', { active: '2' }, cookie)).status, 400);
});

test('FAQ edits affect webhook and preview, disabled topics stay silent, and custom rules retain precedence', async t => {
  const { h, cookie } = await fixture(t);
  await configure(h, cookie, { topic_delivery_text: 'التوصيل داخل طرابلس حسب الاتفاق.', topic_greeting_enabled: '' });
  assert.match(await preview(h, cookie, 'سلام'), /لا يوجد رد تلقائي/);
  await h.webhook(messagePayload('greet-disabled', 'سلام'));
  assert.equal(h.calls.length, 0);
  await h.webhook(messagePayload('delivery', 'في توصيل؟'));
  assert.equal(h.calls.at(-1).body.message.text, 'التوصيل داخل طرابلس حسب الاتفاق.');
  await createRule(h, cookie, { label: 'دفع مخصص', keywords: 'كاش', channels: 'dms', reply_text: 'ندعم الدفع النقدي.' });
  assert.equal(await preview(h, cookie, 'كاش'), 'ندعم الدفع النقدي.');
  const previous = h.query("SELECT value FROM automation_settings WHERE key = 'business_replies'").value;
  assert.equal((await h.postForm('/admin/settings/replies', { ...fields(), topic_delivery_text: '' }, cookie)).status, 400);
  assert.equal(h.query("SELECT value FROM automation_settings WHERE key = 'business_replies'").value, previous);
});

test('settings and connection mutations are authenticated and reject cross-origin forms', async t => {
  const { h, cookie } = await fixture(t);
  assert.equal((await h.request('/admin/settings')).status, 303);
  assert.equal((await h.postForm('/admin/settings/preview', { text: 'سلام' })).status, 401);
  assert.equal((await h.postForm('/admin/connections', { platform: 'telegram', token })).status, 303);
  const response = await h.request('/admin/connections', { method: 'POST', headers: { cookie, origin: 'https://evil.example' }, body: new URLSearchParams({ platform: 'telegram' }) });
  assert.equal(response.status, 403); assert.equal(h.calls.length, 0);
});

test('provider verifies identity before connecting, encrypts credentials and does not render access tokens', async t => {
  const { h, cookie } = await fixture(t);
  const account = await connect(h, cookie);
  assert.match(account.credentials, /^v1\./); assert.doesNotMatch(account.credentials, new RegExp(token)); assert.doesNotMatch(account.credentials, new RegExp(appSecret));
  assert.equal((await accounts.module.accountSecrets(h.env, account.id)).token, token);
  const page = await (await h.request('/admin/settings?setup=' + account.id, { headers: { cookie } })).text();
  assert.match(page, /تم التحقق/); assert.doesNotMatch(page, new RegExp(token)); assert.doesNotMatch(page, new RegExp(appSecret));
  provider(h, 'facebook', '555');
  assert.equal((await h.postForm('/admin/connections', { platform: 'facebook', account_id: '999', token, app_secret: appSecret }, cookie)).status, 400);
  assert.equal(h.query('SELECT COUNT(*) n FROM connected_accounts').n, 1);
  const encrypted = account.credentials;
  await h.db.prepare('UPDATE connected_accounts SET credentials = ? WHERE id = ?').bind(encrypted.slice(0, -4) + 'xxxx', account.id).run();
  await assert.rejects(accounts.module.accountSecrets(h.env, account.id));
});

test('failed providers and unsafe hosts never expose credentials or create connections', async t => {
  const { h, cookie } = await fixture(t);
  h.setResponder(() => new Response(JSON.stringify({ error: { message: token } }), { status: 401 }));
  const response = await h.postForm('/admin/connections', { platform: 'facebook', account_id: '12345', token, app_secret: appSecret }, cookie);
  assert.equal(response.status, 400); assert.doesNotMatch(await response.text(), new RegExp(token));
  const count = h.calls.length;
  await assert.rejects(accounts.module.platformRequest('https://evil.example/steal', token));
  assert.equal(h.calls.length, count); assert.equal(h.query('SELECT COUNT(*) n FROM connected_accounts').n, 0);
  h.setResponder(() => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }));
  await assert.rejects(accounts.module.platformRequest('https://graph.facebook.com/v25.0/me', token));
});

for (const platform of ['instagram', 'facebook', 'whatsapp', 'telegram']) {
  test(`${platform}: verifies inbound authentication, sends saved reply once, rejects stale events, and pauses`, async t => {
    const { h, cookie } = await fixture(t);
    await configure(h, cookie); const account = await connect(h, cookie, platform);
    h.calls.length = 0;
    const data = payload(platform, '12345', platform === 'telegram' ? '101' : 'event1');
    assert.equal((await webhook(h, platform, data, account, true)).status, 401); assert.equal(h.calls.length, 0);
    assert.equal((await webhook(h, platform, data, account)).status, 200);
    assert.equal((await webhook(h, platform, data, account)).status, 200);
    assert.equal(h.calls.length, 1);
    assert.match(platform === 'telegram' ? h.calls[0].body.text : platform === 'whatsapp' ? h.calls[0].body.text.body : h.calls[0].body.message.text, /وعليكم السلام/);
    assert.equal(h.query('SELECT status FROM channel_events').status, 'sent');
    const feed = await (await h.request('/admin/sent?format=json', { headers: { cookie } })).json();
    assert.match(feed.rows, /وعليكم السلام/); assert.match(feed.summary, /<strong>1<\/strong>/);
    assert.doesNotMatch(feed.rows, new RegExp(token));
    await webhook(h, platform, payload(platform, '12345', platform === 'telegram' ? '102' : 'expired', 'سلام', Date.now() - 25 * 3600000), account);
    assert.equal(h.calls.length, 1);
    await h.postForm(`/admin/connections/${account.id}/pause`, {}, cookie);
    await webhook(h, platform, payload(platform, '12345', platform === 'telegram' ? '103' : 'paused'), account);
    assert.equal(h.calls.length, 1);
    await h.postForm(`/admin/connections/${account.id}/resume`, {}, cookie);
    await h.postForm(`/admin/connections/${account.id}/disconnect`, {}, cookie);
    assert.equal(h.query('SELECT credentials FROM connected_accounts').credentials, '');
  });
}

test('test mode records connected messages without outbound sends and callback validates verify token', async t => {
  const { h, cookie } = await fixture(t, { DRY_RUN: 'true' });
  await configure(h, cookie); const account = await connect(h, cookie, 'facebook'); h.calls.length = 0;
  const secret = await accounts.module.accountSecrets(h.env, account.id);
  assert.equal((await h.request('/channels/facebook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=42')).status, 403);
  assert.equal(await (await h.request('/channels/facebook?hub.mode=subscribe&hub.verify_token=' + secret.verifyToken + '&hub.challenge=42')).text(), '42');
  await webhook(h, 'facebook', payload('facebook'), account);
  assert.equal(h.calls.length, 0); assert.equal(h.query('SELECT status FROM channel_events').status, 'test');
});

test('telegram registration uses the public callback and inbound secret, and local origins are rejected', async t => {
  const { h, cookie } = await fixture(t);
  const account = await connect(h, cookie, 'telegram'); h.calls.length = 0;
  await accounts.module.subscribeAccount(h.env, account, 'https://reply.example.com');
  assert.equal(h.calls[0].body.url, 'https://reply.example.com/channels/telegram/' + account.id);
  assert.ok(h.calls[0].body.secret_token); const count = h.calls.length;
  await assert.rejects(accounts.module.subscribeAccount(h.env, account, 'http://localhost:8787'));
  assert.equal(h.calls.length, count);
});


test('messages are scoped to the verified account and image-only messages request the product code', async t => {
  const { h, cookie } = await fixture(t);
  await configure(h, cookie); const first = await connect(h, cookie, 'facebook', '12345');
  await connect(h, cookie, 'facebook', '54321'); h.calls.length = 0;
  const photo = payload('facebook', '12345', 'photo', '');
  photo.entry[0].messaging[0].message.attachments = [{ type: 'image', payload: { url: 'https://example.test/a.jpg' } }];
  await webhook(h, 'facebook', photo, first);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url.pathname, '/v25.0/12345/messages');
  assert.match(h.calls[0].body.message.text, /أرسل كود المنتج/);
  assert.equal(h.query('SELECT COUNT(*) n FROM channel_events').n, 1);
  const mismatch = payload('facebook', '99999', 'mismatch');
  await webhook(h, 'facebook', mismatch, first); assert.equal(h.calls.length, 1);
  const echo = payload('facebook', '12345', 'echo'); echo.entry[0].messaging[0].message.is_echo = true;
  await webhook(h, 'facebook', echo, first); assert.equal(h.calls.length, 1);
});
