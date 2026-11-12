/* Чиста логіка каталогу: жодного звертання до сторінки.
   Винесена окремо, щоб її перевіряли тести, а не око. Той самий файл
   підключається і в браузері (<script>), і в Node (require). */
'use strict';

const CatalogLib = (() => {
  function isFresh(iso, now) {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return false;
    return (now || Date.now()) - then < 86400000;
  }

  /** Порожнє поле - це "без обмеження", а не нуль. */
  function toLimit(raw) {
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Переплутані місцями "від" і "до" - звичайна описка, а не порожній
      результат: міняємо їх, а не показуємо "нічого не знайдено". */
  function priceRange(from, to) {
    if (from !== null && to !== null && from > to) return [to, from];
    return [from, to];
  }

  /** Текст без діакритики й у нижньому регістрі.

      Чех пише «sedacka» так само часто, як «sedačka», а українською
      шукають «диван». Порівнювати треба зведені рядки, інакше пошук
      мовчки нічого не знаходить - і людина вирішує, що товару немає. */
  function fold(text) {
    return String(text == null ? '' : text)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Усе, за чим можна знайти товар: назва, опис, тип, НОМЕР із поста - і
      те саме мовою читача, бо шукає він те, що бачить на екрані. */
  function haystack(item, say) {
    // Готовий покажчик, складений один раз після завантаження: шукати
    // треба всіма мовами одразу, а перекладати 500 товарів на кожне
    // натискання клавіші - марна робота.
    if (item && item._hay) return item._hay;
    const parts = [item.t, item.d, item.k, item.n];
    if (typeof say === 'function') {
      try { parts.push(say(item)); } catch (e) { /* переклад не обов'язковий */ }
    }
    return fold(parts.filter(Boolean).join(' '));
  }

  function filterItems(items, state, groups, say) {
    const query = fold((state.q || '').trim());
    const [from, to] = priceRange(
      state.from === undefined ? null : state.from,
      state.to === undefined ? null : state.to);
    const found = items.filter((item) => {
      // Розділ - найперший фільтр: меблі й авто не перемішуються ніде.
      if ((item.s || 'furniture') !== (state.section || 'furniture')) return false;
      if (state.city && item.r !== state.city) return false;
      if (state.group && (groups || {})[item.c] !== state.group) return false;
      if (state.cat && item.c !== state.cat) return false;
      if (from !== null && (item.p === null || item.p < from)) return false;
      if (to !== null && (item.p === null || item.p > to)) return false;
      if (query) {
        const hay = haystack(item, say);
        if (!query.split(/\s+/).every((word) => hay.includes(word))) return false;
      }
      return true;
    });
    const order = {
      cheap: (a, b) => (a.p === null ? Infinity : a.p)
                     - (b.p === null ? Infinity : b.p),
      rich: (a, b) => (b.p === null ? -Infinity : b.p)
                    - (a.p === null ? -Infinity : a.p),
      new: (a, b) => String(b.ts).localeCompare(String(a.ts)),
    };
    return found.sort(order[state.sort] || order.new);
  }

  /** Схожі товари - тільки в тому ж місті.
      Покупцю в Остраві диван із Плзня не потрібен: це шістсот кілометрів. */
  function similarItems(items, item, limit) {
    const pool = items.filter((entry) => entry.id !== item.id
                              && (entry.s || 'furniture') === (item.s || 'furniture')
                              && (!item.r || !entry.r || entry.r === item.r));
    const near = pool.filter((entry) => entry.k && entry.k === item.k);
    const seen = new Set(near.map((entry) => entry.id));
    const rest = pool.filter((entry) => entry.c === item.c && !seen.has(entry.id));
    return near.concat(rest).slice(0, limit || 8);
  }

  const EMPTY = { group: '', cat: '', q: '', from: null, to: null, sort: 'new' };

  /** Чи звужено добірку. Сортування не рахуємо: воно нічого не ховає. */
  function hasFilters(state) {
    return Boolean(state.cat || state.group || (state.q || '').trim()
                   || state.from !== null || state.to !== null);
  }

  /** Текст заявки на публікацію. Підписи приходять мовою застосунку,
      порожні поля просто не згадуються. */
  function sellMessage(fields, words) {
    const clean = (v) => String(v == null ? '' : v).trim();
    const lines = [words.head, ''];
    const rows = [[words.item, clean(fields.what)],
                  [words.price, clean(fields.price) && `${clean(fields.price)} Kč`],
                  [words.phone, clean(fields.phone)],
                  [words.desc, clean(fields.desc)]];
    for (const [label, value] of rows) if (value) lines.push(`${label}: ${value}`);
    lines.push('', words.photo);
    return lines.join('\n');
  }

  /** Посилання на переписку з готовою чернеткою.
      Формат із документації Telegram: t.me/<нік>?text=<текст>. */
  function contactLink(contact, text) {
    const handle = String(contact || '').trim();
    if (!handle) return '';
    const base = /^https?:\/\//i.test(handle)
      ? handle.replace(/\/+$/, '')
      : `https://t.me/${handle.replace(/^@/, '')}`;
    return `${base}?text=${encodeURIComponent(text || '')}`;
  }

  /** Сторінка товару, якщо в нього є номер: саме вона показує фото й ціну
      в попередньому перегляді Telegram. Без номера лишається застосунок. */
  function itemLink(appUrl, item) {
    if (!appUrl) return '';
    const base = appUrl.split('?')[0].replace(/\/$/, '');
    const code = String((item && item.n) || '');
    if (/^[A-Z]{1,2}\d?-\d+$/.test(code)) return `${base}/t/${code}.html`;
    return `${appUrl}${appUrl.includes('?') ? '&' : '?'}item=${encodeURIComponent(item.id)}`;
  }

  function shareLink(appUrl, item, caption) {
    if (!appUrl) return '';
    const target = itemLink(appUrl, item);
    return `https://t.me/share/url?url=${encodeURIComponent(target)}`
         + `&text=${encodeURIComponent(caption || '')}`;
  }

  /** Номер оголошення приходить із чужого сайту, а потрапляє і в адресу
      фото, і в селектор. Пропускаємо лише те, що справді є номером. */
  function safeId(value) {
    const text = String(value == null ? '' : value);
    return /^[A-Za-z0-9_-]{1,40}$/.test(text) ? text : '';
  }

  return { isFresh, toLimit, priceRange, filterItems, hasFilters, similarItems,
           sellMessage, contactLink, shareLink, itemLink, safeId,
           fold, haystack, EMPTY };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CatalogLib;
