(() => {
  const data = document.querySelector('#reply-locale');
  if (!data || document.documentElement.lang !== 'en') return;
  const catalog = JSON.parse(data.textContent);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = Object.keys(catalog).filter(key => key.length > 1).sort((a,b) => b.length-a.length);
  const pattern = new RegExp('(?<![\\p{L}\\p{N}])(?:'+keys.map(escape).join('|')+')(?![\\p{L}\\p{N}])','gu');
  const t = text => { const key = text.trim(); return Object.hasOwn(catalog,key) ? text.replace(key,catalog[key]) : text.replace(pattern,key => catalog[key]); };
  window.ReplyI18n = { t };
  const keep = 'script,style,textarea,input,code,pre,bdi,[translate="no"],.auto-keys,.chat-buttons,.field-account,.said,.sent-reply,.channel-reply,.bubble,.dm-reply-text,.stage-product,.user-message';
  const attributes = ['aria-label','placeholder','title','data-column','data-confirm','label'];
  const update = root => {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement?.closest(keep) && /[\u0600-\u06ff]/.test(root.data)) { const value=t(root.data); if(value!==root.data) root.data=value; }
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(keep)) return;
    for (const name of attributes) { const value=root.getAttribute(name); if(value && /[\u0600-\u06ff]/.test(value)){const next=name === 'aria-label' && /^(Availability|Edit) /.test(value) ? value : t(value);if(next!==value)root.setAttribute(name,next);} }
    for (const child of [...root.childNodes]) update(child);
  };
  update(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') update(record.target);
      else for (const node of record.addedNodes) update(node);
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  document.addEventListener('invalid',event=>{const input=event.target;if(input.validity.customError) input.setCustomValidity(t(input.validationMessage));},true);
})();
