/* Сторінка одного товару: домальовує її мовою читача.

   Сама сторінка приходить із сервера чеською - так її бачать Telegram,
   WhatsApp і Google, які читають розмітку до будь-якого JavaScript. Але
   людина може бути українкою або іноземцем, і тоді текст має бути її
   мовою. Переклад тут НЕ повторюється: беремо той самий i18n.js, що й
   застосунок, тому словник лишається один на весь проєкт. */
'use strict';

(() => {
  const item = window.ITEM;
  if (!item || typeof I18N === 'undefined') return;

  const saved = (() => {
    try { return localStorage.getItem('lang'); } catch (e) { return null; }
  })();
  I18N.setLang(I18N.detect(saved, navigator.languages, navigator.language));

  const put = (selector, text) => {
    const node = document.querySelector(selector);
    if (node && text) node.textContent = text;
  };

  const title = I18N.title(item) || item.t || '';
  put('h1', title);
  put('.price', I18N.money(item.p));
  document.title = `${title} — ${I18N.money(item.p)}`;

  /* Опис складений зі сталих пар ("матеріал: тканина"), тому він
     перекладається; вільний текст лишається як є. */
  const said = I18N.describe(item.d || '');
  if (said) {
    const box = document.createElement('p');
    box.className = 'where';
    box.style.marginTop = '10px';
    box.textContent = said;
    document.querySelector('.price').after(box);
  }

  document.querySelectorAll('.row').forEach((row) => {
    const label = row.firstElementChild;
    const value = row.lastElementChild;
    if (!label || !value) return;
    label.textContent = I18N.dim(label.textContent);
    value.textContent = I18N.dimValue(value.textContent);
  });

  put('.go', I18N.t('item.catalog') || 'Katalog');
  const write = document.querySelector('.plain');
  if (write) {
    const handle = write.textContent.replace(/^\S+\s*/, '');
    write.textContent = `${I18N.t('item.write') || 'Napsat'} ${handle}`;
  }
})();
