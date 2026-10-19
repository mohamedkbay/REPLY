-- LOCAL UI DEMO ONLY. Run after local migrations, never with --remote.
-- Example prices below are fictional. INSERT OR IGNORE preserves existing edits.
INSERT OR IGNORE INTO products (code, name, price_milli, currency, active) VALUES
  ('DEMO-101', 'حقيبة يد — مثال تجريبي', 120000, 'LYD', 1),
  ('DEMO-102', 'ساعة — مثال تجريبي', 85500, 'LYD', 1);
INSERT OR IGNORE INTO automation_settings (key, value, updated_at) VALUES
  ('product_bot', '{"enabled":true,"prompt":"أهلًا بيك 🌷 أرسل كود المنتج المكتوب في المنشور، ونقولك اسمه وسعره على طول.","unknown":"الكود مش موجود، تأكد من الكود وأرسله مرة ثانية."}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
