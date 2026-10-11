/* Три мови інтерфейсу і три мови даних.

   Назви товарів не перекладаються машиною: бот складає їх із сталого
   словника (тип речі, матеріал, колір, особливість), тому тут лежать точні
   відповідники, вивірені вручну. Машинний переклад одного разу вже назвав
   "залізо" праскою - повторювати цю помилку немає наміру.

   Марки ("Bosch", "IKEA") не перекладаються взагалі: вони приходять
   окремим полем. */
'use strict';

const I18N = (() => {
  const LANGS = [
    { code: 'uk', name: 'Українська', short: 'UA' },
    { code: 'cs', name: 'Čeština', short: 'CS' },
    { code: 'en', name: 'English', short: 'EN' },
  ];

  /* ── інтерфейс ─────────────────────────────────────────────────────── */
  const UI = {
    'tab.catalog':    ['Каталог', 'Katalog', 'Catalog'],
    'tab.saved':      ['Обране', 'Oblíbené', 'Saved'],
    'tab.sell':       ['Продати', 'Prodat', 'Sell'],
    'tab.info':       ['Інфо', 'Info', 'Info'],

    'seg.all':        ['Усі', 'Vše', 'All'],
    'city.all':       ['Усі міста', 'Všechna města', 'All cities'],
    'search.hint.auto':['octavia, passat, дизель…', 'octavia, passat, nafta…',
                       'octavia, passat, diesel…'],
    'sec.furniture':  ['Меблі й техніка', 'Nábytek a spotřebiče', 'Furniture'],
    'sec.auto':       ['Авто', 'Auta', 'Cars'],
    'group.furniture':['Меблі', 'Nábytek', 'Furniture'],
    'group.appliances':['Техніка', 'Spotřebiče', 'Appliances'],

    'card.new':       ['Нове', 'Nové', 'New'],
    'card.nophoto':   ['без фото', 'bez fotky', 'no photo'],
    'price.ask':      ['за домовленістю', 'dohodou', 'price on request'],

    'filter.found':   ['Знайдено', 'Nalezeno', 'Found'],
    'filter.clear':   ['Скинути', 'Zrušit', 'Clear'],

    'empty.nothing.t':['Нічого не знайшлося', 'Nic jsme nenašli', 'Nothing found'],
    'empty.nothing.b':['Спробуйте прибрати частину фільтрів.',
                       'Zkuste zrušit část filtrů.',
                       'Try removing some of the filters.'],
    'empty.catalog.t':['Каталог порожній', 'Katalog je prázdný', 'The catalog is empty'],
    'empty.catalog.b':['Щойно з’явиться перший товар, він буде тут.',
                       'Jakmile přibude první zboží, objeví se tady.',
                       'The first item will show up here.'],
    'empty.saved.t':  ['Тут порожньо', 'Zatím prázdné', 'Nothing saved yet'],
    'empty.saved.b':  ['Тисніть ♥ на товарі, щоб зберегти його.',
                       'Klepněte na ♥ u zboží, které si chcete uložit.',
                       'Tap ♥ on an item to keep it here.'],
    'empty.load.t':   ['Каталог не завантажився', 'Katalog se nenačetl', 'Could not load the catalog'],
    'empty.load.b':   ['Перевірте зв’язок і спробуйте ще раз.',
                       'Zkontrolujte připojení a zkuste to znovu.',
                       'Check your connection and try again.'],

    'search.title':   ['Пошук', 'Hledání', 'Search'],
    'search.name':    ['Назва', 'Název', 'Name'],
    'search.hint':    ['диван, шафа, пральна машина…',
                       'sedačka, skříň, pračka…',
                       'sofa, wardrobe, washing machine…'],
    'search.category':['Категорія', 'Kategorie', 'Category'],
    'search.price':   ['Ціна, Kč', 'Cena, Kč', 'Price, Kč'],
    'search.from':    ['від', 'od', 'from'],
    'search.to':      ['до', 'do', 'to'],
    'search.sort':    ['Спочатку показувати', 'Řadit podle', 'Sort by'],
    'sort.new':       ['Новіші', 'Nejnovější', 'Newest'],
    'sort.cheap':     ['Дешевші', 'Nejlevnější', 'Cheapest'],
    'sort.rich':      ['Дорожчі', 'Nejdražší', 'Most expensive'],
    'search.reset':   ['Скинути все', 'Zrušit vše', 'Reset all'],
    'search.show':    ['Показати', 'Zobrazit', 'Show'],
    'search.none':    ['Нічого не знайдено', 'Nic nenalezeno', 'Nothing found'],
    'sort.toast':     ['Спочатку:', 'Řazení:', 'Sorted by:'],

    'item.delivery':  ['🚚 Можлива доставка за домовленістю',
                       '🚚 Doprava po dohodě',
                       '🚚 Delivery can be arranged'],
    'item.write':     ['Написати про цей товар', 'Napsat o tomto zboží', 'Ask about this item'],
    'item.similar':   ['Схожі товари', 'Podobné zboží', 'Similar items'],
    'item.remove':    ['Прибрати з каталогу', 'Odebrat z katalogu', 'Remove from catalog'],

    'sell.title':     ['Продати', 'Prodat', 'Sell'],
    'sell.head':      ['📣 Опублікуємо ваш товар', '📣 Zveřejníme vaše zboží',
                       '📣 We will publish your item'],
    'sell.kinds':     ['Меблі, побутова техніка, автомобілі.',
                       'Nábytek, spotřebiče, auta.',
                       'Furniture, appliances, cars.'],
    'sell.body':      ['Розмістимо ваше оголошення у нашому каталозі та каналі — там його побачать люди, які вже шукають меблі, техніку чи авто. Ціну ви встановлюєте самі, покупець звертається до вас.',
                       'Zveřejníme váš inzerát v našem katalogu a kanálu, kde ho uvidí lidé, kteří právě hledají nábytek, spotřebiče nebo auto. Cenu si určujete sami, kupující se obrátí přímo na vás.',
                       'We will list your ad in our catalog and channel, where people already looking for furniture, appliances or a car will see it. You set the price and the buyer contacts you directly.'],
    'sell.what':      ['Що продаєте', 'Co prodáváte', 'What are you selling'],
    'sell.what.ph':   ['Меблі, техніка або авто', 'Nábytek, spotřebič nebo auto',
                       'Furniture, appliance or car'],
    'sell.price':     ['Ціна, Kč', 'Cena, Kč', 'Price, Kč'],
    'sell.phone':     ['Ваш телефон', 'Váš telefon', 'Your phone number'],
    'sell.desc':      ['Опис і стан', 'Popis a stav', 'Description and condition'],
    'sell.send':      ['Надіслати заявку', 'Odeslat poptávku', 'Send request'],
    'sell.needwhat':  ['Напишіть, що продаєте', 'Napište, co prodáváte', 'Tell us what you are selling'],
    'sell.photo.h':   ['📷 Про фото', '📷 K fotkám', '📷 About photos'],
    'sell.photo.b':   ['Фото додайте прямо в переписці — так вони дійдуть в оригінальній якості.',
                       'Fotky přiložte přímo v konverzaci — dorazí v původní kvalitě.',
                       'Attach photos in the chat itself so they arrive at full quality.'],

    'info.title':     ['Інформація', 'Informace', 'Information'],
    'info.what.h':    ['🏷 Що це', '🏷 Co to je', '🏷 What this is'],
    'info.what.b':    ['Вживані меблі, побутова техніка й автомобілі в доброму стані. Пишіть — підкажемо й домовимось.',
                       'Použitý nábytek, spotřebiče a auta v dobrém stavu. Napište nám — poradíme a domluvíme se.',
                       'Second-hand furniture, appliances and cars in good condition. Message us and we will sort it out.'],
    'info.what.b2':   ['Маєте що продати? Ми опублікуємо ваше оголошення — вкладка «Продати».',
                       'Máte co prodat? Zveřejníme váš inzerát — záložka «Prodat».',
                       'Got something to sell? We will list your ad — see the «Sell» tab.'],
    'info.delivery.h':['🚚 Доставка', '🚚 Doprava', '🚚 Delivery'],
    'info.delivery.b':['Меблі й техніку можемо привезти за домовленістю — вартість і час обговорюємо в переписці. Автомобіль забираєте самі: у пості вказано місто.',
                       'Nábytek a spotřebiče můžeme přivézt po dohodě — cenu a termín domluvíme v konverzaci. Auto si vyzvednete sami: město je uvedeno v příspěvku.',
                       'Furniture and appliances can be delivered by arrangement. Cars are pickup only — the city is in the post.'],
    'info.order.h':   ['💬 Як замовити', '💬 Jak objednat', '💬 How to order'],
    'info.order.b':   ['Натисніть кнопку з нашим ніком на товарі, який сподобався. Відповімо щодо наявності, стану, огляду й доставки.',
                       'U zboží, které se vám líbí, klepněte na tlačítko s naším nickem. Odpovíme ohledně dostupnosti, stavu, prohlídky a dopravy.',
                       'Tap the button with our handle on an item you like. We will reply about availability, condition, viewing and delivery.'],
    'info.write':     ['Написати нам', 'Napsat nám', 'Message us'],
    'info.lang':      ['Мова', 'Jazyk', 'Language'],

    'msg.hello':      ['Доброго дня!', 'Dobrý den!', 'Hello!'],
    'msg.interested': ['Доброго дня! Цікавить:', 'Dobrý den! Zajímá mě:', 'Hello! I am interested in:'],
    'msg.ref':        ['Номер товару', 'Číslo zboží', 'Item number'],
    'msg.sell.head':  ['Доброго дня! Хочу розмістити оголошення у вас.',
                       'Dobrý den! Mám zájem u vás zveřejnit inzerát.',
                       'Hello! I would like you to list my ad.'],
    'msg.sell.item':  ['Товар', 'Zboží', 'Item'],
    'msg.sell.price': ['Ціна', 'Cena', 'Price'],
    'msg.sell.phone': ['Телефон', 'Telefon', 'Phone'],
    'msg.sell.desc':  ['Опис', 'Popis', 'Description'],
    'msg.sell.photo': ['Фото додаю наступним повідомленням.',
                       'Fotky pošlu v další zprávě.',
                       'I will send photos in the next message.'],
    'msg.nocontact':  ['Контакт ще не налаштований.', 'Kontakt zatím není nastaven.',
                       'The contact is not configured yet.'],

    'pick.cancel':    ['Скасувати', 'Zrušit', 'Cancel'],
    'pick.remove':    ['Прибрати', 'Odebrat', 'Remove'],
    'pick.chosen':    ['Вибрано', 'Vybráno', 'Selected'],

  };

  /* Форми множини. У чеській те саме правило, що в українській:
     1 / 2-4 / 5+. В англійській - лише однина і множина. */
  const PLURALS = {
    // Чеське "zboží" не рахується поштучно, тому для лічильника - "položka".
    goods:   [['товар', 'товари', 'товарів'], ['položka', 'položky', 'položek'],
              ['item', 'items']],
  };

  /* ── дані ──────────────────────────────────────────────────────────── */
  const TYPES = {
    'витяжка': ['Digestoř', 'Cooker hood'],
    'диван': ['Sedačka', 'Sofa'],
    'кавоварка': ['Kávovar', 'Coffee machine'],
    'килим': ['Koberec', 'Rug'],
    'килимова доріжка': ['Běhoun', 'Runner rug'],
    'крісло': ['Křeslo', 'Armchair'],
    'ліжко': ['Postel', 'Bed'],
    'матрац': ['Matrace', 'Mattress'],
    'морозильна камера': ['Mrazák', 'Freezer'],
    'мікрохвильовка': ['Mikrovlnná trouba', 'Microwave'],
    'пилосос': ['Vysavač', 'Vacuum cleaner'],
    'плита': ['Sporák', 'Cooker'],
    'побутова техніка': ['Spotřebič', 'Appliance'],
    'посудомийна машина': ['Myčka nádobí', 'Dishwasher'],
    'пральна машина': ['Pračka', 'Washing machine'],
    'стіл': ['Stůl', 'Table'],
    'стілець': ['Židle', 'Chair'],
    'сушильна машина': ['Sušička', 'Tumble dryer'],
    'холодильник': ['Lednice', 'Fridge'],
    'шафа': ['Skříň', 'Wardrobe'],
    'барний стілець': ['Barová židle', 'Bar stool'],
    'офісний стілець': ['Kancelářská židle', 'Office chair'],
    'обідній стілець': ['Jídelní židle', 'Dining chair'],
    'табурет': ['Taburet', 'Stool'],
    'аерогриль': ['Horkovzdušná fritéza', 'Air fryer'],
    'фритюрниця': ['Fritéza', 'Deep fryer'],
    'мультиварка': ['Multifunkční hrnec', 'Multicooker'],
    'тостер': ['Toustovač', 'Toaster'],
    'міксер': ['Mixér', 'Mixer'],
    'електрочайник': ['Varná konvice', 'Electric kettle'],
    'індукційна плита': ['Indukční varná deska', 'Induction hob'],
    'склокерамічна плита': ['Sklokeramická varná deska', 'Ceramic hob'],
    'газова плита': ['Plynový sporák', 'Gas cooker'],
    'духова шафа': ['Trouba', 'Oven'],
    'офісне крісло': ['Kancelářské křeslo', 'Office chair'],
    'крісло-вушанка': ['Ušák', 'Wing chair'],
    'крісло-гойдалка': ['Houpací křeslo', 'Rocking chair'],
    'крісло-реклайнер': ['Relaxační křeslo', 'Recliner'],
    'приліжкова тумбочка': ['Noční stolek', 'Bedside table'],
    'туалетний столик': ['Toaletní stolek', 'Dressing table'],
    'письмовий стіл': ['Psací stůl', 'Desk'],
    'барний стіл': ['Barový stůl', 'Bar table'],
    'обідній стіл': ['Jídelní stůl', 'Dining table'],
    'журнальний столик': ['Konferenční stolek', 'Coffee table'],
    'двоярусне ліжко': ['Patrová postel', 'Bunk bed'],
    'дитяче ліжко': ['Dětská postel', "Children's bed"],
    'дитяче ліжечко': ['Dětská postýlka', 'Cot'],
    'двоспальне ліжко': ['Manželská postel', 'Double bed'],
    'тахта': ['Válenda', 'Day bed'],
    'кутова шафа': ['Rohová skříň', 'Corner wardrobe'],
    'шафа-купе': ['Skříň s posuvnými dveřmi', 'Sliding wardrobe'],
    'комод': ['Komoda', 'Chest of drawers'],
    'тумба': ['Skříňka', 'Cabinet'],
    'шафа для одягу': ['Šatní skříň', 'Wardrobe'],
    'кутовий диван': ['Rohová sedačka', 'Corner sofa'],
    'пуф': ['Taburet', 'Pouffe'],
    "м'який куток": ['Sedací souprava', 'Sofa set'],
    'холодильник з морозильною камерою': ['Kombinovaná lednice', 'Fridge freezer'],
    'вбудований холодильник': ['Vestavná lednice', 'Built-in fridge'],
    'пральна машина із сушкою': ['Pračka se sušičkou', 'Washer dryer'],
    'пральна машина з верхнім завантаженням': ['Pračka s vrchním plněním', 'Top loading washer'],
    'пружинний матрац': ['Pružinová matrace', 'Spring mattress'],
    'поролоновий матрац': ['Pěnová matrace', 'Foam mattress'],
    'надувний матрац': ['Nafukovací matrace', 'Air mattress'],
  };

  const CATEGORIES = {
    sedacky: ['Дивани', 'Sedačky', 'Sofas'],
    postele: ['Ліжка', 'Postele', 'Beds'],
    kresla: ['Крісла', 'Křesla', 'Armchairs'],
    stoly: ['Столи', 'Stoly', 'Tables'],
    zidle: ['Стільці', 'Židle', 'Chairs'],
    skrine: ['Шафи', 'Skříně', 'Wardrobes'],
    matrace: ['Матраци', 'Matrace', 'Mattresses'],
    koberce: ['Килими', 'Koberce', 'Rugs'],
    pracky: ['Пральні машини', 'Pračky', 'Washing machines'],
    lednicky: ['Холодильники', 'Lednice', 'Fridges'],
    mikrovlnky: ['Мікрохвильовки', 'Mikrovlnné trouby', 'Microwaves'],
    mrazaky: ['Морозильні камери', 'Mrazáky', 'Freezers'],
    mycky: ['Посудомийні машини', 'Myčky', 'Dishwashers'],
    sporaky: ['Плити', 'Sporáky', 'Cookers'],
    susicky: ['Сушильні машини', 'Sušičky', 'Tumble dryers'],
    vysavace: ['Пилососи', 'Vysavače', 'Vacuum cleaners'],
    kavovary: ['Кавоварки', 'Kávovary', 'Coffee machines'],
    digestore: ['Витяжки', 'Digestoře', 'Cooker hoods'],
    ostatnibila: ['Інша техніка', 'Ostatní spotřebiče', 'Other appliances'],
  };

  const DIMS = {
    'Ширина': ['Šířka', 'Width'],
    'Глибина': ['Hloubka', 'Depth'],
    'Висота': ['Výška', 'Height'],
    'Довжина': ['Délka', 'Length'],
    'Розмір': ['Rozměr', 'Size'],
  };

  const MATERIALS = {
    'метал': ['Kov', 'Metal'], 'екошкіра': ['Ekokůže', 'Faux leather'],
    'шкіра': ['Kůže', 'Leather'], 'скло': ['Sklo', 'Glass'],
    'ротанг': ['Ratan', 'Rattan'], 'ЛДСП': ['Lamino', 'Laminated board'],
    'МДФ': ['MDF', 'MDF'], 'пластик': ['Plast', 'Plastic'],
    'масив сосни': ['Masiv borovice', 'Solid pine'],
    'масив дуба': ['Masiv dubu', 'Solid oak'],
    'масив бука': ['Masiv buku', 'Solid beech'],
    'масив дерева': ['Masivní dřevo', 'Solid wood'],
    'сосна': ['Borovice', 'Pine'], 'дуб': ['Dub', 'Oak'], 'бук': ['Buk', 'Beech'],
    'ялина': ['Smrk', 'Spruce'], 'горіх': ['Ořech', 'Walnut'],
    'тканина': ['Látka', 'Fabric'], 'дерево': ['Dřevo', 'Wood'],
  };

  const COLOURS = {
    'білий': ['Bílá', 'White'], 'чорний': ['Černá', 'Black'],
    'сірий': ['Šedá', 'Grey'], 'коричневий': ['Hnědá', 'Brown'],
    'бежевий': ['Béžová', 'Beige'], 'зелений': ['Zelená', 'Green'],
    'синій': ['Modrá', 'Blue'], 'червоний': ['Červená', 'Red'],
    'жовтий': ['Žlutá', 'Yellow'], 'кремовий': ['Krémová', 'Cream'],
    'антрацитовий': ['Antracitová', 'Anthracite'],
  };

  const FEATURES = {
    'розкладний': ['Rozkládací', 'Folds out'],
    'з місцем для білизни': ['S úložným prostorem', 'With storage'],
    'регульований': ['Nastavitelný', 'Adjustable'],
    'садовий': ['Zahradní', 'Garden'],
    'дитячий': ['Dětský', "Children's"],
    'офісний': ['Kancelářský', 'Office'],
    'складаний': ['Skládací', 'Folding'],
    'з матрацом': ['Včetně matrace', 'Mattress included'],
  };

  const PREFIX = {
    'Матеріал': ['Materiál', 'Material'],
    'Колір': ['Barva', 'Colour'],
  };

  /* ── робота ────────────────────────────────────────────────────────── */
  let lang = 'uk';
  const index = () => LANGS.findIndex((l) => l.code === lang);

  function setLang(code) {
    lang = LANGS.some((l) => l.code === code) ? code : 'uk';
    return lang;
  }
  const getLang = () => lang;

  function t(key) {
    const row = UI[key];
    return row ? (row[index()] || row[0]) : key;
  }

  /** Українська й чеська: 1 / 2-4 / 5+. Англійська: однина / множина. */
  function plural(kind, n) {
    const forms = PLURALS[kind][index()];
    if (lang === 'en') return forms[n === 1 ? 0 : 1];
    const d = Math.abs(n) % 10, h = Math.abs(n) % 100;
    if (d === 1 && h !== 11) return forms[0];
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
    return forms[2];
  }

  const pick = (table, key) => {
    const row = table[key];
    if (!row) return null;
    return lang === 'uk' ? key : (lang === 'cs' ? row[0] : row[1]);
  };

  /** Тип речі. Невідоме слово лишається як є - краще українською,
      ніж вигадане. */
  const type = (word) => pick(TYPES, (word || '').trim()) || (word || '');

  const category = (key, fallback) => {
    const row = CATEGORIES[key];
    return row ? row[index()] : (fallback || key);
  };

  const group = (key) => t('group.' + key) || key;

  const dim = (label) => pick(DIMS, label) || label;

  /** Значення розміру: "200 см" -> "200 cm". */
  const dimValue = (value) => lang === 'uk' ? value
    : String(value).replace(/(^|[\s\d])см(?![а-яіїєґ])/gi, '$1cm')
                   .replace(/(^|[\s\d])м(?![а-яіїєґ])/gi, '$1m');

  /** Опис зібраний із тих самих сталих слів: "Матеріал: тканина, колір: білий",
      "Розкладний". Розбираємо на частини й перекладаємо кожну. */
  function describe(text) {
    if (!text || lang === 'uk') return text || '';
    const parts = String(text).split(/,\s*/);
    const out = parts.map((part) => {
      const pair = part.match(/^([^:]+):\s*(.+)$/);
      if (pair) {
        const head = pair[1].trim();
        const key = head[0].toUpperCase() + head.slice(1).toLowerCase();
        let label = PREFIX[key] ? PREFIX[key][lang === 'cs' ? 0 : 1] : head;
        // "Матеріал: тканина, колір: білий" - друга мітка з малої літери.
        if (head[0] === head[0].toLowerCase()) label = label.toLowerCase();
        const value = pick(MATERIALS, pair[2].trim().toLowerCase())
                   || pick(COLOURS, pair[2].trim().toLowerCase())
                   || pair[2].trim();
        return `${label}: ${String(value).toLowerCase()}`;
      }
      const plain = part.trim();
      const feature = pick(FEATURES, plain.toLowerCase());
      return feature || plain;
    }).filter(Boolean);
    if (!out.length) return '';
    const joined = out.join(', ');
    return joined[0].toUpperCase() + joined.slice(1);
  }

  /** Назва картки: перекладений тип плюс марка як є. */
  function title(item) {
    // Авто називаємо так, як написано в оголошенні: модель і мотор - це
    // не "тип речі", їх не перекладають і не переставляють місцями.
    if ((item.s || 'furniture') === 'auto') return item.t || '';
    const base = item.k ? type(item.k) : (item.t || '');
    // Англійською марка стоїть попереду: "Bosch washing machine",
    // а українською й чеською - після назви речі.
    const lower = (word) => word ? word[0].toLowerCase() + word.slice(1) : word;
    const parts = (lang === 'en' && item.b) ? [item.b, lower(base)] : [base, item.b];
    const full = parts.filter(Boolean).join(' ').trim();
    if (!full) return item.t || '';
    return full[0].toUpperCase() + full.slice(1);
  }

  /** Ціна. "Kč" однакова всіма мовами, а "за домовленістю" - ні. */
  function money(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return t('price.ask');
    }
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Kč';
  }

  function countLabel(n) {
    return `${n} ${plural('goods', n)}`;
  }


  /* Сусідні мови. Словак прочитає чеську вільно, а російськомовний
     покупець у Плзні - українську; це ближче, ніж кидати їх в англійську.
     Решта світу отримує англійську: вона зрозуміліша за випадкову
     слов'янську. */
  const NEIGHBOURS = {
    sk: 'cs', cs: 'cs',
    uk: 'uk', ru: 'uk', be: 'uk',
    en: 'en',
  };

  /** Мова з одного коду на кшталт "cs-CZ". Порожнє - мова нам незнайома. */
  function fromCode(code) {
    const raw = String(code || '').toLowerCase().split(/[-_]/)[0];
    return NEIGHBOURS[raw] || '';
  }

  /** Якою мовою відкривати застосунок цій людині.

      Порядок: що вона обрала в Telegram -> список мов браузера, по черзі ->
      українська. Список важливий: у людини може стояти словацька першою і
      чеська другою, і друга нам підходить краще за здогадку. */
  function detect(...hints) {
    const flat = [];
    for (const hint of hints) {
      if (Array.isArray(hint)) flat.push(...hint);
      else if (hint) flat.push(hint);
    }
    for (const hint of flat) {
      const found = fromCode(hint);
      if (found) return found;
    }
    // Мови є, але жодна нам не знайома - це іноземець, йому зрозуміліша
    // англійська. Якщо ж мов немає зовсім, лишається наш основний покупець.
    return flat.length ? 'en' : 'uk';
  }

  return { LANGS, UI, TYPES, CATEGORIES, DIMS, MATERIALS, COLOURS, FEATURES,
           setLang, getLang, t, plural, type, category, group, dim,
           dimValue, describe, title, detect, fromCode, money, countLabel };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = I18N;
