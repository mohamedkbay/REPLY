(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.16,1,.3,1)';
  reduced.addEventListener('change', () => { if (reduced.matches) document.querySelector('.login-shell')?.getAnimations({ subtree: true }).forEach(animation => animation.cancel()); });
  const header = document.querySelector('.site-header');
  if (header) {
    const toggle = header.querySelector('.menu-toggle');
    const scene = header.querySelector('.menu-scene');
    const sheet = header.querySelector('.menu-sheet');
    const layers = [...header.querySelectorAll('.menu-layers i')];
    const links = [...header.querySelectorAll('.menu-large>a')];
    const tiles = [...header.querySelectorAll('.menu-feature')];
    let open = false, version = 0;
    const animate = (element, frames, duration, delay = 0) => element.animate(frames, { duration, delay, easing: ease, fill: 'both' });
    const setOpen = async (next, restoreFocus = false, instant = false) => {
      const hidden = scene.hidden;
      const pose = element => { const style = getComputedStyle(element); return { transform: style.transform, opacity: style.opacity, translate: style.translate }; };
      const sheetPose = hidden ? 'translateY(105%)' : pose(sheet).transform;
      const layerPoses = layers.map(layer => hidden ? 'translateY(102%)' : pose(layer).transform);
      const linkPoses = links.map(link => hidden ? { transform: 'translateY(32px)', opacity: 0 } : pose(link));
      const tilePoses = tiles.map(tile => hidden ? { translate: '0 45px', opacity: 0 } : pose(tile));
      open = next;
      const current = ++version;
      scene.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      scene.hidden = false;
      scene.inert = !next;
      header.toggleAttribute('data-open', next);
      toggle.setAttribute('aria-expanded', String(next));
      toggle.querySelector('.sr-only').textContent = next ? 'إغلاق القائمة' : 'فتح القائمة';
      document.body.toggleAttribute('data-menu-open', next);
      document.querySelectorAll('main,.reply-footer').forEach(element => { element.inert = next; });
      if (reduced.matches || instant) {
        scene.hidden = !next;
        if (restoreFocus) toggle.focus();
        return;
      }
      if (next) {
        layers.forEach((layer, index) => animate(layer, [{ transform: layerPoses[index] }, { transform: 'translateY(0)' }], 560, hidden ? index * 45 : 0));
        animate(sheet, [{ transform: sheetPose }, { transform: 'translateY(0)' }], 620, hidden ? 100 : 0);
        links.forEach((link, index) => animate(link, [{ transform: linkPoses[index].transform, opacity: linkPoses[index].opacity }, { transform: 'translateY(0)', opacity: 1 }], 450, hidden ? 220 + index * 35 : 0));
        tiles.forEach((tile, index) => animate(tile, [{ opacity: tilePoses[index].opacity, translate: tilePoses[index].translate }, { opacity: 1, translate: '0 0' }], 480, hidden ? 270 + index * 70 : 0));
      } else {
        const closing = [animate(sheet, [{ transform: sheetPose }, { transform: 'translateY(105%)' }], 280)];
        layers.forEach((layer, index) => closing.push(animate(layer, [{ transform: layerPoses[index] }, { transform: 'translateY(105%)' }], 300, (2 - index) * 35)));
        links.forEach((link, index) => closing.push(animate(link, [{ transform: linkPoses[index].transform, opacity: linkPoses[index].opacity }, { transform: linkPoses[index].transform, opacity: linkPoses[index].opacity }], 370)));
        tiles.forEach((tile, index) => closing.push(animate(tile, [{ translate: tilePoses[index].translate, opacity: tilePoses[index].opacity }, { translate: tilePoses[index].translate, opacity: tilePoses[index].opacity }], 370)));
        await Promise.allSettled(closing.map(animation => animation.finished));
        if (current === version && !open) scene.hidden = true;
      }
      if (restoreFocus && current === version) toggle.focus();
    };
    if (window.ReplyPreferences?.arrival?.menuOpen) setOpen(true, false, true);
    toggle.addEventListener('click', () => setOpen(!open));
    scene.addEventListener('click', event => { if (event.target.closest('a') || event.target === scene || event.target.closest('.menu-layers')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
      if (event.key === 'Tab') {
        const focusable = [...header.querySelectorAll('.brand-link,.menu-toggle,.menu-sheet a,.menu-sheet button')].filter(element => element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('pageshow', event => { if (event.persisted) { version++; open = false; scene.hidden = true; scene.inert = true; header.removeAttribute('data-open'); toggle.setAttribute('aria-expanded','false'); document.body.removeAttribute('data-menu-open'); document.querySelectorAll('main,.reply-footer').forEach(element => { element.inert = false; }); } });
    reduced.addEventListener('change', () => { scene.getAnimations({subtree:true}).forEach(animation => animation.cancel()); scene.hidden = !open; });
  }
  const revealContent = () => {
    if (reduced.matches || document.documentElement.hasAttribute('data-language-arrival')) return;
    const title = [...document.querySelectorAll('main:not(.login-shell) h1')].find(element => element.getClientRects().length);
    if (title) title.animate([{ transform: 'translateY(24px)', clipPath: 'inset(0 0 85% 0)' }, { transform: 'translateY(0)', clipPath: 'inset(0)' }], { duration: 500, easing: ease });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.animate([{ opacity: .4, transform: 'translateY(26px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 480, easing: ease });
        observer.unobserve(entry.target);
      });
    }, { threshold: .1 });
    document.querySelectorAll('[data-stock-item],.provider,.auto').forEach(element => observer.observe(element));
    reduced.addEventListener('change', () => { if (reduced.matches) { observer.disconnect(); document.getAnimations().forEach(animation => animation.cancel()); } });
  };
  const fontsReady = () => { document.documentElement.setAttribute('data-fonts-ready', ''); revealContent(); };
  if (!document.fonts) fontsReady(); else Promise.all([400,500,600,700].map(weight => document.fonts.load(weight + ' 16px Cairo', 'أبجد ABC 123'))).then(fontsReady, fontsReady);
  const stage = document.querySelector('.reply-stage');
  if (stage) {
    let ticking = false, stageTop = stage.offsetTop, previous = -1;
    const update = () => {
      ticking = false;
      if (reduced.matches) { stage.style.transform = ''; return; }
      const progress = Math.max(0, Math.min(1, (scrollY + innerHeight * .28 - stageTop) / 420));
      if (progress === previous) return;
      previous = progress;
      stage.style.transform = 'scale(' + (.84 + progress * .16) + ')';
    };
    const requestUpdate = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', requestUpdate, { passive: true });
    addEventListener('resize', () => { stageTop = stage.offsetTop; previous = -1; requestUpdate(); }, { passive: true });
    reduced.addEventListener('change', () => { previous = -1; requestUpdate(); });
    update();
  }
})();
