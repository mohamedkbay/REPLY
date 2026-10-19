(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const transitionKey = 'reply_preference_transition';
  const read = (storage, key) => { try { return storage.getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { storage.setItem(key, value); } catch {} };
  const forget = key => { try { sessionStorage.removeItem(key); } catch {} };
  const storage = name => { try { return window[name]; } catch { return { getItem() {}, setItem() {} }; } };
  const local = storage('localStorage'), session = storage('sessionStorage');
  const cookieTheme = document.cookie.match(/(?:^|;\s*)reply_theme=(dark|light)(?:;|$)/)?.[1];
  let desiredTheme = read(local, 'reply_theme') ?? cookieTheme;
  desiredTheme = desiredTheme === 'dark' ? 'dark' : 'light';
  root.dataset.theme = desiredTheme;
  let active = null, sequence = 0, navigating = false;
  let arrival = null;
  try {
    const value = JSON.parse(read(session, transitionKey));
    if (value?.kind === 'language' && Date.now() - value.created < 10_000 && value.target === location.pathname + location.search + location.hash) arrival = value;
  } catch {}
  const enableNavigation = () => {
    if (document.querySelector('#preference-navigation')) return;
    const style = document.createElement('style');
    style.id = 'preference-navigation';
    style.textContent = '@view-transition{navigation:auto}';
    document.head.append(style);
  };
  if (arrival) {
    root.dataset.languageArrival = '';
    if (arrival.animate && !reduced.matches) { root.dataset.preferenceTransition = 'language'; enableNavigation(); }
  }
  const warmFonts = () => !document.fonts ? Promise.resolve() : Promise.all([400, 500, 600, 700].map(weight => document.fonts.load(weight + ' 16px Cairo', 'أبجد ABC 123'))).catch(() => {});
  const originFor = element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: innerWidth, height: innerHeight };
  };
  function waveFrames(origin) {
    const w = innerWidth, h = innerHeight;
    const backwards = origin.x > origin.width / 2;
    const ox = backwards ? w - origin.x * w / origin.width : origin.x * w / origin.width;
    const oy = origin.y * h / origin.height;
    const point = (x, y) => `${(backwards ? w - x : x).toFixed(2)} ${y.toFixed(2)}`;
    const shape = (left, top, topEdge, bottomEdge, bottom, bulge) => {
      const height = bottom - top, spread = Math.max(1, topEdge - left);
      return `path("M ${point(left, top)} C ${point(left + spread * .45, top - height * .12)} ${point(topEdge - spread * .1, top - height * .08)} ${point(topEdge, top + height * .12)} C ${point(topEdge + bulge, top + height * .45)} ${point(bottomEdge - bulge * .25, bottom - height * .28)} ${point(bottomEdge, bottom)} C ${point(bottomEdge - spread * .3, bottom + height * .1)} ${point(left, bottom + height * .13)} ${point(left, bottom)} C ${point(left - spread * .05, bottom - height * .2)} ${point(left - spread * .05, top + height * .2)} ${point(left, top)} Z")`;
    };
    const radius = Math.min(40, w * .1);
    return [
      { offset: 0, clipPath: shape(ox - 1, oy - 1, ox + 1, ox + 1, oy + 1, .5) },
      { offset: .12, clipPath: shape(ox - radius, oy - radius, ox + radius * .9, ox + radius * .5, oy + radius, radius * .3) },
      { offset: .35, clipPath: shape(-w * .18, -h * .18, w * .28, w * .03, h * 1.12, w * .18) },
      { offset: .63, clipPath: shape(-w * .18, -h * .2, w * .68, w * .34, h * 1.16, w * .2) },
      { offset: .84, clipPath: shape(-w * .18, -h * .2, w * 1.05, w * .79, h * 1.16, w * .14) },
      { offset: 1, clipPath: shape(-w * .2, -h * .22, w * 1.48, w * 1.4, h * 1.22, w * .04) }
    ];
  }
  async function reveal(transition, origin) {
    active = transition;
    const kind = root.dataset.preferenceTransition;
    try {
      await transition.ready;
      if (reduced.matches) { transition.skipTransition(); return; }
      performance.mark(`reply:${kind}-wave:start`);
      const animation = root.animate(waveFrames(origin), { duration: 880, easing: 'linear', fill: 'both', pseudoElement: '::view-transition-new(root)' });
      await animation.finished;
      performance.mark(`reply:${kind}-wave:end`);
    } catch { transition.skipTransition(); }
    finally {
      await transition.finished.catch(() => {});
      if (active === transition) { active = null; delete root.dataset.preferenceTransition; }
    }
  }
  function updateButtons() {
    const dark = root.dataset.theme === 'dark', english = root.lang === 'en';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', english ? 'Dark mode' : 'الوضع الداكن');
      button.title = dark ? english ? 'Switch to light mode' : 'تفعيل الوضع الفاتح' : english ? 'Switch to dark mode' : 'تفعيل الوضع الداكن';
    });
    document.querySelectorAll('[data-language]').forEach(link => {
      if (link.dataset.language === root.lang) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    });
  }
  function applyTheme(value) {
    root.dataset.theme = value;
    write(local, 'reply_theme', value);
    document.cookie = `reply_theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    updateButtons();
  }
  function announceTheme() {
    let status = document.querySelector('#preference-status');
    if (!status) { status = document.createElement('div'); status.id = 'preference-status'; status.className = 'sr-only'; status.setAttribute('role', 'status'); document.body.append(status); }
    const dark = root.dataset.theme === 'dark';
    status.textContent = root.lang === 'en' ? dark ? 'Dark mode enabled' : 'Light mode enabled' : dark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح';
  }
  async function changeTheme(button) {
    desiredTheme = desiredTheme === 'dark' ? 'light' : 'dark';
    const next = desiredTheme, current = ++sequence;
    active?.skipTransition();
    await warmFonts();
    if (current !== sequence || navigating) return;
    if (!document.startViewTransition || reduced.matches || !CSS.supports('clip-path', 'path("M 0 0 L 1 0 L 0 1 Z")')) { applyTheme(next); announceTheme(); return; }
    root.dataset.preferenceTransition = 'theme';
    const origin = originFor(button);
    const transition = document.startViewTransition(() => applyTheme(next));
    await reveal(transition, origin);
    if (current === sequence) announceTheme();
  }
  const editable = element => /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) && !['password', 'file', 'hidden', 'submit', 'button'].includes(element.type) && !/token|secret|password|key|code/i.test(element.name + ' ' + element.id);
  function captureFields() {
    const fields = [];
    [...document.forms].forEach((form, formIndex) => [...form.elements].forEach((element, fieldIndex) => {
      if (editable(element) && element.value.length <= 20_000) fields.push({ formIndex, fieldIndex, name: element.name, value: element.value, checked: element.checked });
    }));
    return fields;
  }
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const theme = event.target.closest('[data-theme-toggle]');
    if (theme) { event.preventDefault(); changeTheme(theme); return; }
    const link = event.target.closest('a[data-language]');
    if (!link) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || target.pathname !== '/admin/language') return;
    event.preventDefault(); event.stopPropagation();
    if (navigating || link.dataset.language === root.lang) return;
    navigating = true;
    active?.skipTransition();
    const verifying = document.querySelector('form[action="/auth/verify"]');
    const returnTo = verifying ? '/auth/verify' : location.pathname + location.search + location.hash;
    target.searchParams.set('returnTo', returnTo);
    const intent = { kind: 'language', created: Date.now(), target: returnTo, origin: originFor(link), animate: !reduced.matches, menuOpen: document.querySelector('.site-header')?.hasAttribute('data-open') ?? false, scroll: scrollY, fields: captureFields() };
    write(session, transitionKey, JSON.stringify(intent));
    await warmFonts();
    if (intent.animate) { root.dataset.preferenceTransition = 'language'; enableNavigation(); await new Promise(requestAnimationFrame); }
    location.assign(target.href);
  }, true);
  addEventListener('pageswap', event => {
    if (event.viewTransition && (!navigating || reduced.matches)) event.viewTransition.skipTransition();
  });
  addEventListener('pagereveal', event => {
    forget(transitionKey);
    if (!event.viewTransition) { delete root.dataset.preferenceTransition; return; }
    if (!arrival?.animate || reduced.matches) { event.viewTransition.skipTransition(); delete root.dataset.preferenceTransition; return; }
    reveal(event.viewTransition, arrival.origin).then(() => {
      document.querySelector(`[data-language="${root.lang}"]`)?.focus({ preventScroll: true });
    });
  });
  addEventListener('pageshow', event => {
    if (event.persisted) { navigating = false; arrival = null; forget(transitionKey); delete root.dataset.preferenceTransition; desiredTheme = read(local, 'reply_theme') === 'dark' ? 'dark' : 'light'; root.dataset.theme = desiredTheme; updateButtons(); }
    if (!active && !navigating) { forget(transitionKey); delete root.dataset.preferenceTransition; }
  });
  addEventListener('storage', event => { if (event.key === 'reply_theme') { active?.skipTransition(); desiredTheme = event.newValue === 'dark' ? 'dark' : 'light'; root.dataset.theme = desiredTheme; updateButtons(); } });
  reduced.addEventListener('change', () => { if (reduced.matches) active?.skipTransition(); });
  document.addEventListener('DOMContentLoaded', () => {
    if (arrival) {
      for (const field of arrival.fields ?? []) {
        const element = document.forms[field.formIndex]?.elements[field.fieldIndex];
        if (element && editable(element) && element.name === field.name) { element.value = field.value; if (typeof field.checked === 'boolean') element.checked = field.checked; }
      }
      scrollTo(0, arrival.scroll ?? 0);
    }
    updateButtons();
  });
  window.ReplyPreferences = { arrival };
})();
