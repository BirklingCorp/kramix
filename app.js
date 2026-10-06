/* Каталог у Telegram. Сервера немає: сторінка читає data.json, який бот
   перезаписує після кожної публікації. Пошук, фільтри й обране працюють на
   боці телефона.

   Чиста логіка - у lib.js, мови - в i18n.js, обидва покриті тестами. Тут
   лишається робота зі сторінкою: малювання, переходи, зв'язок з Telegram. */
'use strict';

/* Старий WebView у Telegram не знає replaceChildren (Safari 14, Chrome 86).
   Без підпірки застосунок падав би на першому ж малюванні - і людина
   бачила б чорний екран без жодного пояснення. */
if (!Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function (...nodes) {
    while (this.firstChild) this.removeChild(this.firstChild);
    for (const node of nodes) this.appendChild(node);
  };
}

/* Чорний екран - найгірша з можливих відповідей: незрозуміло, чи то
   інтернет, чи то застосунок. Показуємо причину просто на сторінці. */
function fatal(what) {
  try {
    const box = document.getElementById('bootError');
    if (!box) return;
    box.hidden = false;
    box.textContent = 'Не вдалося відкрити каталог: ' + what;
  } catch (e) {}
}
window.addEventListener('error', (e) => fatal((e && e.message) || 'помилка'));
window.addEventListener('unhandledrejection',
                        (e) => fatal((e && e.reason && e.reason.message) || 'збій'));

const L = CatalogLib;
const T = I18N;
const tg = window.Telegram && window.Telegram.WebApp;
const $ = (id) => document.getElementById(id);

const state = {
  items: [], cats: [], groups: {}, cities: [], sections: [],
  section: 'furniture', contact: '', app: '', bot: '',
  group: '', cat: '', q: '', from: null, to: null, sort: 'new',
  city: '',
  draft: null,
  fav: new Set(),
  screen: 'catalog',
  origin: 'catalog',
  item: null,
  isAdmin: false,
  picked: new Set(),
};

function supports(version) {
  try { return Boolean(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(version)); }
  catch (e) { return false; }
}
const cloud = () => (supports('6.9') && tg.CloudStorage) ? tg.CloudStorage : null;
const haptic = (style) => { try { tg.HapticFeedback.impactOccurred(style || 'light'); } catch (e) {} };
const select = () => { try { tg.HapticFeedback.selectionChanged(); } catch (e) {} };

/* ── мова ───────────────────────────────────────────────────────────── */
const LANG_KEY = 'lang';

function applyLang() {
  const code = T.getLang();
  document.documentElement.lang = code;
  $('langShort').textContent = (T.LANGS.find((l) => l.code === code) || {}).short || '';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = T.t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = T.t(el.dataset.i18nPh);
  });
  sellReady();
  paintLangList();
  paintSections();
  paintCities();
  paintGroups();
  paintFeed();
  if (state.screen === 'saved') paintSaved();
  if (state.item) openItem(state.item, state.origin);
}

function setLang(code, remember) {
  T.setLang(code);
  if (remember !== false) { try { localStorage.setItem(LANG_KEY, code); } catch (e) {} }
  applyLang();
}

function paintLangList() {
  const list = $('langList');
  if (!list) return;
  list.replaceChildren(...T.LANGS.map((entry) => {
    const row = document.createElement('button');
    row.className = 'lang-row' + (T.getLang() === entry.code ? ' is-on' : '');
    const name = document.createElement('span'); name.textContent = entry.name;
    const tag = document.createElement('i'); tag.textContent = entry.short;
    row.append(name, tag);
    row.addEventListener('click', () => {
      select(); setLang(entry.code); closeLangSheet();
    });
    return row;
  }));
  const chips = $('langChips');
  chips.replaceChildren(...T.LANGS.map((entry) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (T.getLang() === entry.code ? ' is-on' : '');
    chip.textContent = entry.name;
    chip.addEventListener('click', () => { select(); setLang(entry.code); });
    return chip;
  }));
}

/* ── обране ─────────────────────────────────────────────────────────── */
const FAV_KEY = 'fav';

function favLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch (e) { return []; }
}

function favLoad() {
  return new Promise((resolve) => {
    const store = cloud();
    if (!store || !store.getItem) return resolve(favLocal());
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    setTimeout(() => finish(favLocal()), 1200);
    try {
      store.getItem(FAV_KEY, (err, value) => {
        if (err || !value) return finish(favLocal());
        try {
          const parsed = JSON.parse(value);
          finish(Array.isArray(parsed) ? parsed.map(String) : favLocal());
        } catch (e) { finish(favLocal()); }
      });
    } catch (e) { finish(favLocal()); }
  });
}

function favSave() {
  const raw = JSON.stringify([...state.fav]);
  try { localStorage.setItem(FAV_KEY, raw); } catch (e) {}
  const store = cloud();
  if (store && store.setItem) { try { store.setItem(FAV_KEY, raw); } catch (e) {} }
}

function toggleFav(id) {
  state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id);
  haptic(state.fav.has(id) ? 'medium' : 'light');
  favSave();
  paintBadge();
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(
    (btn) => btn.classList.toggle('is-on', state.fav.has(id)));
  if (state.screen === 'saved') paintSaved();
}

const savedItems = () => state.items.filter((item) => state.fav.has(item.id));

/* ── вибір для прибирання (лише власник) ────────────────────────────────
   Сторінка нічого не видаляє: вона складає команду, а право на неї
   перевіряє бот за номером чату. */
function togglePick(id, wrap) {
  state.picked.has(id) ? state.picked.delete(id) : state.picked.add(id);
  haptic('light');
  if (wrap) {
    wrap.classList.toggle('is-picked', state.picked.has(id));
    const btn = wrap.querySelector('.pick-btn');
    if (btn) btn.classList.toggle('is-on', state.picked.has(id));
  }
  paintPickBar();
}

const PICK_LIMIT = 30;     // довжина посилання не безмежна

function paintPickBar() {
  const bar = $('pickBar');
  bar.hidden = state.picked.size === 0;
  $('pickCount').textContent = `${T.t('pick.chosen')}: ${state.picked.size}`;
}

$('pickCancel').addEventListener('click', () => {
  state.picked.clear();
  document.querySelectorAll('.card.is-picked').forEach((c) => {
    c.classList.remove('is-picked');
    const btn = c.querySelector('.pick-btn');
    if (btn) btn.classList.remove('is-on');
  });
  paintPickBar();
});

$('pickGo').addEventListener('click', () => {
  if (!state.picked.size || !state.bot) return;
  const batch = [...state.picked].slice(0, PICK_LIMIT);
  haptic('medium');
  openLink(`https://t.me/${state.bot}?text=`
           + encodeURIComponent(`/sold ${batch.join(' ')}`));
  batch.forEach((id) => state.picked.delete(id));
  paintPickBar();
});

function paintBadge() {
  const badge = $('savedBadge');
  const count = savedItems().length;
  badge.textContent = count;
  badge.hidden = count === 0;
}

/* ── картка ─────────────────────────────────────────────────────────── */
const lazy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    img.src = img.dataset.src;
    lazy.unobserve(img);
  }
}, { rootMargin: '400px 0px' });

const dropLazy = (box) =>
  box.querySelectorAll('img[data-src]').forEach((img) => lazy.unobserve(img));

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Гортання фото просто в стрічці.

    Людина гортає десятки карток і хоче побачити річ із двох-трьох боків,
    не відкриваючи кожну. Тому знімки міняються на місці: пальцем або
    половинками картки, а крапки внизу показують, скільки їх усього.

    Наступне фото підвантажується заздалегідь - інакше при гортанні
    блимала б порожнеча. */
function cardGallery(media, img, item) {
  let at = 0;
  const dots = el('div', 'card-dots');
  for (let i = 0; i < item.ph.length; i += 1) {
    dots.append(el('i', i === 0 ? 'is-on' : ''));
  }
  const show = (next) => {
    const total = item.ph.length;
    at = (next + total) % total;
    img.src = `p/${item.id}/${at + 1}.jpg`;
    delete img.dataset.src;
    [...dots.children].forEach((dot, i) => dot.classList.toggle('is-on', i === at));
    const ahead = new Image();
    ahead.src = `p/${item.id}/${((at + 1) % total) + 1}.jpg`;
  };

  const step = (ev, delta) => {
    ev.stopPropagation();                 // гортання - не відкриття товару
    select();
    show(at + delta);
  };
  const left = el('button', 'card-nav card-nav-left');
  const right = el('button', 'card-nav card-nav-right');
  left.setAttribute('aria-label', 'previous');
  right.setAttribute('aria-label', 'next');
  left.addEventListener('click', (ev) => step(ev, -1));
  right.addEventListener('click', (ev) => step(ev, 1));

  // Свайп по самій картці. Поріг більший за випадкове тремтіння пальця,
  // і вертикальний рух не рахується - інакше гортання стрічки збивалось би.
  let x0 = 0, y0 = 0, live = false;
  media.addEventListener('touchstart', (ev) => {
    const touch = ev.touches && ev.touches[0];
    live = Boolean(touch) && ev.touches.length === 1;
    if (live) { x0 = touch.clientX; y0 = touch.clientY; }
  }, { passive: true });
  media.addEventListener('touchend', (ev) => {
    if (!live) return;
    live = false;
    const touch = ev.changedTouches && ev.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - x0;
    const dy = Math.abs(touch.clientY - y0);
    if (Math.abs(dx) >= 45 && Math.abs(dx) > dy * 1.4) {
      select();
      show(at + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  media.append(left, right, dots);
}

function card(item) {
  const wrap = el('article', 'card');
  const media = el('div', 'card-media');
  const cover = item.ph.length ? `p/${item.id}/cover.jpg` : '';

  let photo = null;
  if (cover) {
    const img = el('img');
    photo = img;
    img.alt = ''; img.decoding = 'async'; img.dataset.src = cover;
    img.addEventListener('load', () => img.classList.add('is-ready'), { once: true });
    img.addEventListener('error', () => {
      img.remove();
      media.classList.add('is-empty');
      media.dataset.empty = T.t('card.nophoto');
    }, { once: true });
    media.append(img);
    lazy.observe(img);
  } else {
    media.classList.add('is-empty');
    media.dataset.empty = T.t('card.nophoto');
  }

  if (state.isAdmin) {
    const pick = el('button', 'pick-btn' + (state.picked.has(item.id) ? ' is-on' : ''));
    pick.setAttribute('aria-label', T.t('pick.remove'));
    pick.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    pick.addEventListener('click', (ev) => { ev.stopPropagation(); togglePick(item.id, wrap); });
    media.append(pick);
    wrap.classList.toggle('is-picked', state.picked.has(item.id));
  } else if (L.isFresh(item.ts)) {
    media.append(el('div', 'pill pill-new', T.t('card.new')));
  }
  // Крапки під фото замінюють лічильник: вони кажуть і скільки знімків,
  // і на якому ти зараз.
  if (photo && item.ph.length > 1) cardGallery(media, photo, item);
  else if (item.ph.length > 1) media.append(el('div', 'pill pill-count', `1/${item.ph.length}`));

  const fav = el('button', 'fav-btn');
  fav.dataset.id = item.id;
  fav.setAttribute('aria-label', T.t('tab.saved'));
  fav.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20.5 4.2 12.9a4.8 4.8 0 0 1 6.8-6.8l1 1 1-1a4.8 4.8 0 0 1 6.8 6.8z"/></svg>';
  fav.classList.toggle('is-on', state.fav.has(item.id));
  fav.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFav(item.id); });
  media.append(fav);

  const body = el('div', 'card-body');
  body.append(el('h3', 'card-title', T.title(item)));
  body.append(el('div', 'card-price', T.money(item.p)));
  const isAuto = (item.s || 'furniture') === 'auto';
  const specs = isAuto
    ? item.m.slice(0, 2).map((d) => d[1]).join(' · ')
    : (item.m.length ? item.m.map((d) => T.dimValue(d[1])).join(' × ') : '');
  // У авто місто - головне після ціни: покупець їде по машину сам.
  const meta = [isAuto ? item.ci : T.category(item.c, catLabel(item.c)),
                (!isAuto && state.cities.length > 1) ? cityLabel(item.r) : '',
                specs].filter(Boolean).join(' · ');
  body.append(el('div', 'card-meta', meta));

  wrap.append(media, body);
  wrap.addEventListener('click', () => openItem(item, state.screen));
  return wrap;
}

const catLabel = (key) => (state.cats.find((c) => c.k === key) || {}).l || '';

/* ── списки ─────────────────────────────────────────────────────────── */
function fillEmpty(box, titleKey, bodyKey) {
  box.replaceChildren(el('b', '', T.t(titleKey)), document.createTextNode(T.t(bodyKey)));
}

/* Скільки карток малюємо за раз. Уся стрічка одразу - це сотні великих
   фотографій у пам'яті телефона, і браузер просто закриває сторінку.
   Решта домальовується, коли людина догортала до кінця. */
const PAGE = 24;
let feedRest = [];

function growFeed() {
  if (!feedRest.length) return;
  const next = feedRest.splice(0, PAGE);
  const sentry = $('feedMore');
  for (const item of next) $('feed').insertBefore(card(item), sentry);
  sentry.hidden = feedRest.length === 0;
}

const feedWatch = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) growFeed();
}, { rootMargin: '600px 0px' });

function paintFeed() {
  dropLazy($('feed'));
  const found = L.filterItems(state.items, state, state.groups);
  feedRest = found.slice(PAGE);
  const sentry = el('div', 'feed-more');
  sentry.id = 'feedMore';
  sentry.hidden = feedRest.length === 0;
  $('feed').replaceChildren(...found.slice(0, PAGE).map(card), sentry);
  feedWatch.disconnect();
  feedWatch.observe(sentry);

  const active = L.hasFilters(state);
  $('filterBar').hidden = !active;
  if (active) {
    $('filterCount').textContent = `${T.t('filter.found')} ${T.countLabel(found.length)}`;
  }
  const empty = $('feedEmpty');
  empty.hidden = found.length > 0;
  if (!empty.hidden) {
    state.items.length ? fillEmpty(empty, 'empty.nothing.t', 'empty.nothing.b')
                       : fillEmpty(empty, 'empty.catalog.t', 'empty.catalog.b');
  }
}

function paintSaved() {
  dropLazy($('savedFeed'));
  const saved = savedItems();
  $('savedFeed').replaceChildren(...saved.map(card));
  const empty = $('savedEmpty');
  empty.hidden = saved.length > 0;
  if (!empty.hidden) fillEmpty(empty, 'empty.saved.t', 'empty.saved.b');
}

/* ── товар ──────────────────────────────────────────────────────────── */
function openItem(item, origin) {
  state.item = item;
  state.origin = origin === 'saved' ? 'saved' : 'catalog';

  $('itemTitle').textContent = T.title(item);
  $('itemPrice').textContent = T.money(item.p);
  const auto = (item.s || 'furniture') === 'auto';
  $('itemMeta').textContent = auto
    ? item.ci
    : [T.category(item.c, catLabel(item.c)),
       state.cities.length > 1 ? cityLabel(item.r) : ''].filter(Boolean).join(' · ');
  // Доставити автомобіль неможливо, і обіцяти цього не можна.
  $('itemDelivery').hidden = auto;

  // На кнопці - сам нік: видно, куди саме потрапить повідомлення.
  const handle = state.contact
    ? (state.contact.startsWith('@') ? state.contact : '@' + state.contact)
    : T.t('item.write');
  $('itemContactName').textContent = handle;

  const specs = $('itemSpecs');
  specs.replaceChildren(...item.m.map(([name, value]) => {
    const row = el('div', 'spec');
    row.append(el('span', '', T.dim(name)), el('span', '', T.dimValue(value)));
    return row;
  }));
  specs.hidden = item.m.length === 0;

  const desc = $('itemDesc');
  const text = T.describe(item.d);
  desc.textContent = text;
  desc.hidden = !text;

  const gallery = $('gallery');
  gallery.replaceChildren(...item.ph.map((src) => {
    const img = el('img');
    img.alt = ''; img.decoding = 'async'; img.src = src;
    img.addEventListener('error', () => img.remove(), { once: true });
    return img;
  }));
  gallery.scrollLeft = 0;
  const count = $('galleryCount');
  count.hidden = item.ph.length < 2;
  count.textContent = `1/${item.ph.length}`;

  paintSimilar(item);
  $('detailFav').classList.toggle('is-on', state.fav.has(item.id));
  $('itemShare').hidden = !state.app;
  $('itemRemove').hidden = !(state.isAdmin && state.bot);
  show('item');
}

/** Схожі товари: спершу того самого типу, а якщо таких мало - з тієї самої
    категорії. Порожній блок ховаємо: один товар "схожим" не буває. */
function paintSimilar(item) {
  const near = L.similarItems(state.items, item, 8);

  const box = $('similarBox');
  box.hidden = near.length === 0;
  if (box.hidden) return;

  $('similarRow').replaceChildren(...near.map((entry) => {
    const card = el('button', 'similar-card');
    const img = el('img', 'thumb');
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    if (entry.ph.length) img.src = `p/${entry.id}/cover.jpg`;
    img.addEventListener('error', () => { img.removeAttribute('src'); }, { once: true });
    card.append(img, el('div', 'name', T.title(entry)),
                el('div', 'cost', T.money(entry.p)));
    card.addEventListener('click', () => openItem(entry, state.origin));
    return card;
  }));
}

$('gallery').addEventListener('scroll', () => {
  const gallery = $('gallery'), total = gallery.children.length;
  if (total < 2) return;
  const index = Math.round(gallery.scrollLeft / gallery.clientWidth) + 1;
  $('galleryCount').textContent = `${Math.min(Math.max(index, 1), total)}/${total}`;
}, { passive: true });

$('detailFav').addEventListener('click', () => {
  if (state.item) toggleFav(state.item.id);
  $('detailFav').classList.toggle('is-on', state.item && state.fav.has(state.item.id));
});

$('itemShare').addEventListener('click', () => {
  if (!state.item || !state.app) return;
  haptic('light');
  openLink(L.shareLink(state.app, state.item,
                       `${T.title(state.item)} — ${T.money(state.item.p)}`));
});

/* Прибирання робить бот, а не сторінка: він знає, хто адмін, і перевіряє це
   сам. Кнопка лише готує команду - підробити її на своєму телефоні можна,
   виконати без прав не можна. */
$('itemRemove').addEventListener('click', () => {
  if (!state.item || !state.bot) return;
  haptic('medium');
  openLink(`https://t.me/${state.bot}?text=`
           + encodeURIComponent(`/sold ${state.item.id}`));
});

/* ── посилання ──────────────────────────────────────────────────────── */
function openLink(url) {
  if (!url) return;
  try { if (tg && tg.openTelegramLink) return tg.openTelegramLink(url); } catch (e) {}
  window.open(url, '_blank', 'noopener');
}

function contact(text) {
  const url = L.contactLink(state.contact, text);
  if (!url) {
    try { tg.showAlert(T.t('msg.nocontact')); } catch (e) {}
    return;
  }
  haptic('medium');
  openLink(url);
}

$('itemContact').addEventListener('click', () => {
  const item = state.item;
  // Номер обов'язковий: однакових диванів за 2000 може бути кілька, і без
  // нього продавець не зрозуміє, про який саме йдеться.
  contact(item ? `${T.t('msg.interested')} ${T.title(item)} — ${T.money(item.p)}`
                 + `\n${T.t('msg.ref')}: ${item.id}`
               : T.t('msg.hello'));
});
$('infoContact').addEventListener('click', () => contact(T.t('msg.hello')));

/* ── екрани ─────────────────────────────────────────────────────────── */
const SCREENS = { catalog: 'screen-catalog', saved: 'screen-saved',
                  sell: 'screen-sell', info: 'screen-info', item: 'screen-item' };

function show(name) {
  state.screen = name;
  for (const [key, id] of Object.entries(SCREENS)) $(id).hidden = key !== name;
  if (name === 'saved') paintSaved();
  document.querySelectorAll('.tab').forEach(
    (tab) => tab.classList.toggle('is-active', tab.dataset.screen === name));
  $('tabbar').hidden = name === 'item';
  $('searchFab').classList.toggle('is-hidden', name !== 'catalog');
  window.scrollTo(0, 0);
  syncBackButton();
}

function sheetOpen() {
  return !$('filterSheet').hidden || !$('langSheet').hidden;
}

function syncBackButton() {
  const needed = state.screen === 'item' || sheetOpen();
  let native = false;
  try {
    if (tg && tg.BackButton && tg.BackButton.show) {
      needed ? tg.BackButton.show() : tg.BackButton.hide();
      native = Boolean(tg.platform && tg.platform !== 'unknown');
    }
  } catch (e) {}
  $('backBtn').hidden = native || state.screen !== 'item';
}

function goBack() {
  if (!$('langSheet').hidden) return closeLangSheet();
  if (!$('filterSheet').hidden) return closeSheet();
  if (state.screen === 'item') return show(state.origin);
  show('catalog');
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => { select(); show(tab.dataset.screen); });
});
$('backBtn').addEventListener('click', () => { select(); goBack(); });

/* Логотип - це "додому": так поводиться будь-який сайт, і людина тицяє
   туди не думаючи. Повертаємо до каталогу й до початку стрічки. */
$('brandBtn').addEventListener('click', () => {
  select();
  show('catalog');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* Свайп від лівого краю - назад, як у застосунках айфона. Кнопка назад
   лишається: жест її не замінює, а доповнює.

   Починатись жест має саме від краю: усередині екрана горизонтально
   гортаються рядки міст, категорій і фотографії товару, і там свайп
   означає зовсім інше. */
(function backSwipe() {
  const EDGE = 32;         // звідки жест вважається "від краю"
  const ENOUGH = 70;       // скільки пройти пальцем, щоб це був намір
  let x0 = 0, y0 = 0, live = false;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches && e.touches[0];
    live = Boolean(touch) && touch.clientX <= EDGE && e.touches.length === 1;
    if (live) { x0 = touch.clientX; y0 = touch.clientY; }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!live) return;
    live = false;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - x0;
    const dy = Math.abs(touch.clientY - y0);
    // Горизонталь має переважати: інакше це звичайне гортання стрічки.
    if (dx >= ENOUGH && dx > dy * 1.5) { select(); goBack(); }
  }, { passive: true });
})();

/* ── аркуші ─────────────────────────────────────────────────────────── */
const SORTS = ['new', 'cheap', 'rich'];

function openSheet() {
  // Підказка в пошуку має бути про те, що людина зараз шукає: у розділі
  // авто "диван, шафа, пральна машина" виглядає як чужа сторінка.
  $('qInput').placeholder = T.t(state.section === 'auto'
                                ? 'search.hint.auto' : 'search.hint');
  state.draft = { group: state.group, cat: state.cat, q: state.q,
                  from: state.from, to: state.to, sort: state.sort,
                  city: state.city };
  $('qInput').value = state.q;
  $('priceFrom').value = state.from === null ? '' : state.from;
  $('priceTo').value = state.to === null ? '' : state.to;
  paintChips();
  countDraft();
  $('filterSheet').hidden = false;
  haptic('light');
  syncBackButton();
}

function closeSheet() {
  $('filterSheet').hidden = true;
  state.draft = null;
  syncBackButton();
}

function openLangSheet() {
  paintLangList();
  $('langSheet').hidden = false;
  haptic('light');
  syncBackButton();
}
function closeLangSheet() { $('langSheet').hidden = true; syncBackButton(); }

function paintChips() {
  if (!state.draft) return;
  const cats = [{ k: '', l: T.t('seg.all') }, ...state.cats];
  $('catChips').replaceChildren(...cats.map(({ k, l }) => {
    const chip = el('button', 'chip' + (state.draft.cat === k ? ' is-on' : ''),
                    k ? T.category(k, l) : l);
    chip.addEventListener('click', () => {
      state.draft.cat = k;
      if (k) state.draft.group = '';
      select(); paintChips(); countDraft();
    });
    return chip;
  }));
  $('sortChips').replaceChildren(...SORTS.map((key) => {
    const chip = el('button', 'chip' + (state.draft.sort === key ? ' is-on' : ''),
                    T.t('sort.' + key));
    chip.addEventListener('click', () => { state.draft.sort = key; select(); paintChips(); });
    return chip;
  }));
}

function readDraft() {
  if (!state.draft) return;
  state.draft.q = $('qInput').value;
  state.draft.from = L.toLimit($('priceFrom').value);
  state.draft.to = L.toLimit($('priceTo').value);
}

function countDraft() {
  if (!state.draft) return;
  readDraft();
  const n = L.filterItems(state.items, state.draft, state.groups).length;
  const btn = $('applyBtn');
  btn.disabled = n === 0;
  btn.textContent = n ? `${T.t('search.show')} ${T.countLabel(n)}` : T.t('search.none');
}

['qInput', 'priceFrom', 'priceTo'].forEach((id) => {
  $(id).addEventListener('input', countDraft);
});
$('searchFab').addEventListener('click', openSheet);
$('sheetBackdrop').addEventListener('click', closeSheet);
$('langBtn').addEventListener('click', openLangSheet);
$('langBackdrop').addEventListener('click', closeLangSheet);
$('applyBtn').addEventListener('click', () => {
  readDraft();
  const [from, to] = L.priceRange(state.draft.from, state.draft.to);
  Object.assign(state, state.draft, { from, to });
  haptic('medium');
  closeSheet();
  paintGroups();
  paintFeed();
});
$('resetBtn').addEventListener('click', () => {
  state.draft = { ...L.EMPTY, city: state.city };
  $('qInput').value = ''; $('priceFrom').value = ''; $('priceTo').value = '';
  select(); paintChips(); countDraft();
});
$('filterClear').addEventListener('click', () => {
  Object.assign(state, L.EMPTY, { city: state.city });
  select(); paintGroups(); paintFeed();
});
$('sortBtn').addEventListener('click', () => {
  state.sort = SORTS[(SORTS.indexOf(state.sort) + 1) % SORTS.length];
  select();
  paintFeed();
  toast(`${T.t('sort.toast')} ${T.t('sort.' + state.sort).toLowerCase()}`);
});

let toastTimer = null;
function toast(text) {
  const box = $('toast');
  box.textContent = text;
  box.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-on'), 1700);
}

/* ── розділ: меблі чи авто ──────────────────────────────────────────── */
const SECTION_KEY = 'section';

/** Розділи, у яких справді є товар. Один розділ - рядка немає. */
function paintSections() {
  const counts = {};
  for (const item of state.items) {
    const key = item.s || 'furniture';
    counts[key] = (counts[key] || 0) + 1;
  }
  // Порядок сталий, а не в якому трапились у даних: меблі першими,
  // бо з них усе почалось і їх більше.
  const ORDER = ['furniture', 'auto'];
  state.sections = Object.keys(counts).sort(
    (a, b) => (ORDER.indexOf(a) + 1 || 9) - (ORDER.indexOf(b) + 1 || 9));
  const box = $('sectionTabs');
  box.hidden = state.sections.length < 2;
  if (box.hidden) {
    state.section = state.sections[0] || 'furniture';
    return;
  }
  if (!counts[state.section]) state.section = state.sections[0];
  box.replaceChildren(...state.sections.map((key) => {
    const btn = el('button', 'sec' + (state.section === key ? ' is-active' : ''),
                   `${T.t('sec.' + key)} ${counts[key]}`);
    btn.addEventListener('click', () => setSection(key));
    return btn;
  }));
}

function setSection(key) {
  if (state.section === key) return;
  state.section = key;
  // Категорії меблів у авто безглузді, і навпаки.
  state.cat = ''; state.group = '';
  try { localStorage.setItem(SECTION_KEY, key); } catch (e) {}
  select();
  paintSections();
  paintCities();
  paintGroups();
  paintFeed();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── місто ──────────────────────────────────────────────────────────── */
const CITY_KEY = 'city';

/** Товари обраного міста. Лічильники груп і категорій рахуємо саме по них,
    інакше цифри обіцяли б те, чого в місті немає. */
const sectionItems = () =>
  state.items.filter((item) => (item.s || 'furniture') === state.section);

const cityItems = () => {
  const here = sectionItems();
  return state.city ? here.filter((item) => item.r === state.city) : here;
};

const cityLabel = (key) => (state.cities.find((c) => c.k === key) || {}).l || '';

/** Один рядок вибору міста. Одне місто - рядка немає: вибирати нічого. */
function paintCities() {
  const box = $('cityTabs');
  box.hidden = state.cities.length < 2;
  if (box.hidden) return;
  const counts = {};
  for (const item of sectionItems()) {
    if (item.r) counts[item.r] = (counts[item.r] || 0) + 1;
  }
  // Місто, якого в цьому розділі немає, ховало б геть усе: авто йдуть по
  // всій країні, а обране "Прага" лишалось від меблів.
  if (state.city && !counts[state.city]) state.city = '';
  const tabs = [{ k: '', l: T.t('city.all') },
                ...state.cities.filter((c) => counts[c.k])];
  box.replaceChildren(...tabs.map(({ k, l }) => {
    const total = k ? counts[k] : sectionItems().length;
    const btn = el('button', 'seg' + (state.city === k ? ' is-active' : ''),
                   `${k ? l : T.t('city.all')} ${total}`);
    btn.addEventListener('click', () => { setCity(k); });
    return btn;
  }));
}

function setCity(key) {
  if (state.city === key) return;
  state.city = key;
  // Категорія попереднього міста в новому може бути порожньою - не тримаємо.
  state.cat = '';
  try { localStorage.setItem(CITY_KEY, key); } catch (e) {}
  select();
  paintCities();
  paintGroups();
  paintFeed();
}

/* ── групи ──────────────────────────────────────────────────────────── */
function paintGroups() {
  // Групи рахуємо лише по тому, що є в цьому розділі: "Техніка" серед авто
  // так само безглузда, як "Дизель" серед меблів.
  const here = new Set(sectionItems().map((item) => item.c));
  const names = [...new Set(state.cats.filter((c) => here.has(c.k))
                                      .map((c) => c.g).filter(Boolean))];
  if (names.length < 2) {
    $('groupTabs').hidden = true;
    state.group = '';
    paintCategories();
    return;
  }
  $('groupTabs').hidden = false;
  const tabs = [['', T.t('seg.all')], ...names.map((n) => [n, T.group(n)])];
  // Число поруч із назвою одразу каже, чи є на що дивитись у розділі.
  const counts = {};
  for (const item of cityItems()) {
    const group = state.groups[item.c];
    if (group) counts[group] = (counts[group] || 0) + 1;
  }
  $('groupTabs').replaceChildren(...tabs.map(([key, label]) => {
    const total = key ? counts[key] : cityItems().length;
    const btn = el('button', 'seg' + (state.group === key ? ' is-active' : ''),
                   `${label}${total ? ' ' + total : ''}`);
    btn.addEventListener('click', () => {
      state.group = key; state.cat = '';
      select(); paintGroups(); paintFeed();
    });
    return btn;
  }));
  paintCategories();
}

/** Другий рядок: категорії, які справді є в обраній групі. Порожні не
    показуємо - вибір, який нічого не дає, тільки заважає. */
function paintCategories() {
  const counts = {};
  for (const item of cityItems()) {
    if (state.group && state.groups[item.c] !== state.group) continue;
    counts[item.c] = (counts[item.c] || 0) + 1;
  }
  const present = state.cats.filter((c) => counts[c.k]);
  const box = $('catTabs');
  box.hidden = present.length < 2;
  if (box.hidden) return;
  const all = el('button', 'seg' + (state.cat ? '' : ' is-active'), T.t('seg.all'));
  all.addEventListener('click', () => {
    state.cat = ''; select(); paintGroups(); paintFeed();
  });
  box.replaceChildren(all, ...present.map((entry) => {
    const chip = el('button', 'seg' + (state.cat === entry.k ? ' is-active' : ''),
                    `${T.category(entry.k, entry.l)} ${counts[entry.k]}`);
    chip.addEventListener('click', () => {
      state.cat = state.cat === entry.k ? '' : entry.k;
      select(); paintGroups(); paintFeed();
    });
    return chip;
  }));
}

/* ── заявка ─────────────────────────────────────────────────────────── */
const sellFields = () => ({
  what: $('sellWhat').value, price: $('sellPrice').value,
  phone: $('sellPhone').value, desc: $('sellDesc').value,
});

const sellWords = () => ({
  head: T.t('msg.sell.head'), item: T.t('msg.sell.item'),
  price: T.t('msg.sell.price'), phone: T.t('msg.sell.phone'),
  desc: T.t('msg.sell.desc'), photo: T.t('msg.sell.photo'),
});

function sellReady() {
  const filled = Boolean($('sellWhat').value.trim());
  $('sellSend').disabled = !filled;
  $('sellSend').textContent = filled ? T.t('sell.send') : T.t('sell.needwhat');
}

['sellWhat', 'sellPrice', 'sellPhone', 'sellDesc'].forEach((id) => {
  $(id).addEventListener('input', sellReady);
});
$('sellSend').addEventListener('click',
  () => contact(L.sellMessage(sellFields(), sellWords())));

/* ── старт ──────────────────────────────────────────────────────────── */
function skeletons(n) {
  $('feed').replaceChildren(...Array.from({ length: n }, () => {
    const box = el('div');
    box.append(el('div', 'sk sk-media'));
    const one = el('div', 'sk sk-line'); one.style.width = '72%';
    const two = el('div', 'sk sk-line'); two.style.width = '38%'; two.style.height = '19px';
    box.append(one, two);
    return box;
  }));
}

function wantedItemId() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('item');
    if (fromUrl) return L.safeId(fromUrl);
  } catch (e) {}
  try {
    const param = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
    if (param) return L.safeId(param);
  } catch (e) {}
  return '';
}

/** Якою мовою відкрити застосунок.

    Власний вибір людини важить найбільше: якщо вона один раз перемкнула
    мову, ми більше не вгадуємо. Далі - мова її Telegram, далі - мови
    браузера по черзі. */
/** Режим власника: кнопки прибирання товару.

    Номер власника у публічних даних не зберігаємо - це його особистий
    ідентифікатор у Telegram, і покупцям його бачити нічого. Вмикається
    один раз посиланням з ?admin=1 і запам'ятовується на цьому пристрої.

    Це не захист, а зручність: саме прибирання виконує бот, і право на
    нього він перевіряє за номером чату. Стороннє натискання нічого не дасть.
*/
function adminMode() {
  try {
    if (new URLSearchParams(location.search).get('admin') === '1') {
      localStorage.setItem('admin', '1');
    }
  } catch (e) {}
  try {
    return localStorage.getItem('admin') === '1';
  } catch (e) { return false; }
}

function startingLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && T.LANGS.some((l) => l.code === saved)) return saved;
  } catch (e) {}
  const hints = [];
  try {
    const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user && user.language_code) hints.push(user.language_code);
  } catch (e) {}
  try {
    if (Array.isArray(navigator.languages)) hints.push(...navigator.languages);
    if (navigator.language) hints.push(navigator.language);
  } catch (e) {}
  return T.detect(hints);
}

/** Дані з мережі. Усе, що лишається, приходить від нашого ж бота, але
    формат перевіряємо: зіпсований файл не має валити сторінку. */
function clean(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((raw) => ({
    id: L.safeId(raw && raw.id),
    c: String((raw && raw.c) || ''),
    k: String((raw && raw.k) || ''),
    b: String((raw && raw.b) || ''),
    t: String((raw && raw.t) || ''),
    d: String((raw && raw.d) || ''),
    m: Array.isArray(raw && raw.m)
      ? raw.m.filter((pair) => Array.isArray(pair) && pair.length === 2)
             .map(([a, b]) => [String(a), String(b)])
      : [],
    p: Number.isFinite(Number(raw && raw.p)) && raw.p !== null ? Number(raw.p) : null,
    ph: Array.isArray(raw && raw.ph)
      ? raw.ph.filter((src) => typeof src === 'string' && /^p\/[\w-]+\/[\w.-]+$/.test(src))
      : [],
    ts: String((raw && raw.ts) || ''),
    r: String((raw && raw.r) || '').replace(/[^\w-]/g, ''),
    s: String((raw && raw.s) || 'furniture').replace(/[^\w-]/g, ''),
    ci: String((raw && raw.ci) || '').slice(0, 40),
  })).filter((item) => item.id);
}

/** Розділ, обраний минулого разу. Немає такого - беремо перший наявний. */
function savedSection() {
  let saved = '';
  try { saved = localStorage.getItem(SECTION_KEY) || ''; } catch (e) {}
  const have = new Set(state.items.map((i) => i.s || 'furniture'));
  return have.has(saved) ? saved : (have.has('furniture') ? 'furniture'
                                    : [...have][0] || 'furniture');
}

/** Місто, обране минулого разу. Зникло з каталогу - показуємо всі. */
function savedCity() {
  let saved = '';
  try { saved = localStorage.getItem(CITY_KEY) || ''; } catch (e) {}
  const here = new Set(state.items
    .filter((i) => (i.s || 'furniture') === state.section)
    .map((i) => i.r));
  return here.has(saved) ? saved : '';
}

async function boot() {
  if (tg) {
    try {
      tg.ready(); tg.expand();
      if (supports('6.1')) {
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
      }
      tg.BackButton.onClick(goBack);
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) {}
  }
  T.setLang(startingLang());
  applyLang();
  skeletons(3);
  state.fav = new Set(await favLoad());

  let data;
  try {
    const resp = await fetch('data.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(String(resp.status));
    data = await resp.json();
  } catch (e) {
    $('feed').replaceChildren();
    $('feedEmpty').hidden = false;
    fillEmpty($('feedEmpty'), 'empty.load.t', 'empty.load.b');
    return;
  }

  state.items = clean(data);
  state.cats = Array.isArray(data.cats) ? data.cats : [];
  state.cities = (Array.isArray(data.cities) ? data.cities : [])
    .filter((c) => c && typeof c.k === 'string' && typeof c.l === 'string')
    .map((c) => ({ k: c.k.replace(/[^\w-]/g, ''), l: c.l }));
  state.city = savedCity();
  state.section = savedSection();
  state.groups = data.groups || {};
  state.contact = data.contact || '';
  state.app = data.app || '';
  state.bot = String(data.bot || '').replace(/[^\w]/g, '');
  if (data.brand) {
    $('brandName').textContent = data.brand;
    document.title = data.brand;
  }
  state.isAdmin = adminMode();

  paintSections();
  paintCities();
  paintBadge();
  paintPickBar();
  applyLang();

  const wanted = wantedItemId();
  if (wanted) {
    const item = state.items.find((entry) => entry.id === wanted);
    if (item) openItem(item, 'catalog');
  }
}

boot();
