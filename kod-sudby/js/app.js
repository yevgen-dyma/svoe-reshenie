(() => {
  "use strict";

  const STORAGE_KEY = "kod-sudby:v1";

  const CATEGORY_META = {
    money: { label: "Деньги", cls: "money", nav: "results" },
    relationships: { label: "Отношения", cls: "rel", nav: "results" },
    health: { label: "Здоровье", cls: "health", nav: "results" },
    family: { label: "Архив рода", cls: "family", nav: "results" }
  };
  const CATEGORY_ORDER = ["money", "relationships", "health", "family"];

  const NAV_SCREENS = new Set(["directions", "history", "profile", "results"]);

  /* ---------------- state ---------------- */

  function genCaseId() {
    return "R-" + Math.floor(10000 + Math.random() * 90000);
  }

  const REL_ARRAY_FIELDS = [
    "resultBenefits", "desiredFeelings", "obstacles", "repeatingScenario",
    "role", "boundaries", "familyModel", "influence", "externalInfluence", "beliefs"
  ];

  function defaultState() {
    return {
      profile: { name: "" },
      registration: null,
      answers: {},
      history: [],
      relInvestigation: {
        caseId: genCaseId(),
        startedAt: null,
        branch: "",
        problemDescription: "",
        profile: {
          lastName: "",
          firstName: "",
          patronymic: "",
          birthDate: "",
          marital: "",
          kids: "",
          occupation: "",
          income: ""
        },
        situationCategory: "",
        situationCategoryOther: "",
        currentRating: null,
        currentRatingNote: "",
        goalDirection: "",
        goalDirectionOther: "",
        resultBenefits: [],
        resultBenefitsOther: "",
        whyNow: "",
        whyNowOther: "",
        branchExtra: "",
        branchExtraOther: "",
        desiredFeelings: [],
        desiredFeelingsOther: "",
        obstacles: [],
        obstaclesOther: "",
        mainFear: "",
        mainFearOther: "",
        fearReaction: "",
        fearReactionOther: "",
        repeatingScenario: [],
        repeatingScenarioOther: "",
        role: [],
        roleOther: "",
        boundaries: [],
        boundariesOther: "",
        importantFactors: { love: 5, financial: 5, intimacy: 5, values: 5, freedom: 5, family: 5 },
        children: "",
        childrenOther: "",
        familyModel: [],
        familyModelOther: "",
        problemOnset: "",
        problemOnsetOther: "",
        influence: [],
        influenceOther: "",
        externalInfluence: [],
        externalInfluenceOther: "",
        beliefs: [],
        beliefsOther: ""
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const parsedRel = parsed.relInvestigation || {};
      const relArrays = {};
      REL_ARRAY_FIELDS.forEach((key) => {
        relArrays[key] = Array.isArray(parsedRel[key]) ? parsedRel[key] : [];
      });
      return Object.assign(base, parsed, {
        answers: Object.assign({}, parsed.answers),
        history: Array.isArray(parsed.history) ? parsed.history : [],
        relInvestigation: Object.assign({}, base.relInvestigation, parsedRel, relArrays, {
          caseId: parsedRel.caseId || base.relInvestigation.caseId,
          profile: Object.assign({}, base.relInvestigation.profile, parsedRel.profile),
          importantFactors: Object.assign({}, base.relInvestigation.importantFactors, parsedRel.importantFactors)
        })
      });
    } catch (e) {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — app still works in-memory */
    }
  }

  /* ---------------- helpers ---------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  function formatEuro(n) {
    return "€" + n.toLocaleString("ru-RU");
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) +
      " · " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function pushHistory(category, summary) {
    state.history.unshift({
      category,
      summary,
      ts: Date.now()
    });
    state.history = state.history.slice(0, 30);
  }

  /* ---------------- relationships: config-driven investigation engine ----------------
     Screens here are NOT tied to any approved reference image or baked PNG step
     number — order, branching and progress are computed purely from this config,
     per screenId/type/options/next architecture. */

  const REL_BRANCH_GROUPS = {
    seek: ["Хочу встретить любовь и создать отношения", "Хочу выйти замуж / жениться", "Постоянно остаюсь один / одна"],
    improve: ["Хочу улучшить текущие отношения", "Хочу сохранить отношения любой ценой"],
    leave: ["Хочу развестись / уйти", "Хочу уйти, но не могу", "Уже развёлся(лась), но не могу отпустить"],
    betrayal: ["Переживаю измену / предательство"],
    toxic: ["Токсичные / зависимые отношения"]
  };

  const REL_BRANCH_EXTRA = {
    seek: {
      question: "Что сейчас самое сложное в поиске отношений?",
      options: ["Одиночество, которое тяжело переносить", "Страх снова довериться", "Не знаю, каких людей выбирать", "Прошлый опыт мешает", "Мало времени и социальных возможностей", "Другое"]
    },
    improve: {
      question: "Что вы уже пробовали, чтобы улучшить отношения?",
      options: ["Разговоры и объяснения", "Совместный отдых", "Психолог или консультация", "Ультиматумы", "Ничего ещё не пробовали", "Другое"]
    },
    leave: {
      question: "Что тебя удерживает?",
      options: ["Дети", "Деньги", "Жильё", "Страх одиночества", "Чувство вины", "Страх реакции партнёра", "Надежда, что всё изменится", "Другое"]
    },
    betrayal: {
      question: "Чего ты хочешь дальше после измены?",
      options: ["Восстановить отношения", "Понять, почему это произошло", "Решить — остаться или уйти", "Отпустить ситуацию и двигаться дальше", "Пока не знаю", "Другое"]
    },
    toxic: {
      question: "Что удерживает тебя в этих отношениях?",
      options: ["Страх остаться одному(ой)", "Финансовая зависимость", "Надежда, что человек изменится", "Дети", "Привычка и страх перемен", "Не знаю, как уйти", "Другое"]
    }
  };

  function relComputeBranch() {
    const goal = state.relInvestigation.goalDirection;
    for (const key in REL_BRANCH_GROUPS) {
      if (REL_BRANCH_GROUPS[key].indexOf(goal) >= 0) return key;
    }
    return "";
  }

  function relBranchExtraConfig() {
    const branch = state.relInvestigation.branch;
    const def = REL_BRANCH_EXTRA[branch];
    if (!def) return null;
    return {
      id: "rel-branch-extra", type: "single", question: def.question,
      hint: "Выбери то, что ближе всего", options: def.options, other: true,
      stateKey: "branchExtra", otherKey: "branchExtraOther", back: "rel-why-now"
    };
  }

  const REL_ICON_PATHS = {
    heart: '<path d="M12 21s-7.5-4.35-10-9.5C.5 7.5 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4 23.5 7.5 22 11.5 19.5 16.65 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    flame: '<path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-2-1-4 2 1 4 4 4 7a6 6 0 0 1-12 0c0-5 3-7 6-12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    warning: '<path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/>',
    link: '<path d="M9 7H7a4 4 0 0 0 0 8h2M15 7h2a4 4 0 0 1 0 8h-2M8 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    people: '<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c0-3.9 3.4-6.6 7.5-6.6s7.5 2.7 7.5 6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mask: '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M6.6 6.7C4.5 8 3 10 3 12c0 0 3.5 6 9 6 1.6 0 3-.5 4.2-1.2M9.9 4.2C10.6 4.1 11.3 4 12 4c5.5 0 9 6 9 6a13 13 0 0 1-2 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    cycle: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.2 3.8v4h-4M6.8 20.2v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    compass: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14.6 9.4L13 13l-3.6 1.6L11 11l3.6-1.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  };

  const REL_ICON_RULES = [
    [/страст|влечен/i, "flame"],
    [/люб|чувств/i, "heart"],
    [/спокойств|безопасн|довер|поддержк|честн|горд/i, "shield"],
    [/насил|унижен|контрол|ревност|критик|зависим/i, "warning"],
    [/предат|измен|ложь|манипул|использ/i, "link"],
    [/мама|папа|бабушк|дедушк|родствен|учител|наставник|подруг|друз|медиа|партн|родител/i, "people"],
    [/дет[ие]|семь|брак/i, "home"],
    [/детств|подростк|не знаю|начал|первой/i, "clock"],
    [/сценар|повторя|конфликт/i, "cycle"],
    [/дистанц|холодност|избега|замыка|отталкива|одиноч|друго/i, "mask"]
  ];

  function relIconFor(text) {
    for (var i = 0; i < REL_ICON_RULES.length; i++) {
      if (REL_ICON_RULES[i][0].test(text)) return REL_ICON_RULES[i][1];
    }
    return "compass";
  }

  function relIconSvg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (REL_ICON_PATHS[name] || REL_ICON_PATHS.compass) + '</svg>';
  }

  const REL_QUESTIONS = [
    {
      id: "rel-desired-feelings", type: "multi",
      question: "Какие чувства тебе хочется испытывать рядом с партнёром?",
      hint: "Выбери всё, что откликается",
      options: ["Любовь", "Спокойствие и безопасность", "Радость и лёгкость", "Страсть и влечение", "Поддержка и понимание", "Гордость друг за друга", "Доверие и честность", "Вдохновение", "Другое"],
      other: true, stateKey: "desiredFeelings", otherKey: "desiredFeelingsOther"
    },
    {
      id: "rel-obstacles", type: "multi",
      question: "Что сейчас мешает тебе построить желаемые отношения?",
      hint: "Выбери основные причины",
      options: ["Страх быть отвергнутым(ой)", "Низкая самооценка", "Негативный прошлый опыт", "Недоверие к людям", "Финансовые трудности", "Зависимые сценарии", "Непрожитые обиды", "Другие приоритеты", "Другое"],
      other: true, stateKey: "obstacles", otherKey: "obstaclesOther"
    },
    {
      id: "rel-main-fear", type: "single",
      question: "Чего ты боишься больше всего, если ситуация действительно изменится?",
      hint: "Выбери, что откликается сильнее всего",
      options: ["Остаться в одиночестве", "Снова быть преданным(ой)", "Не справиться с переменами", "Разочаровать близких", "Потерять стабильность", "Что станет ещё хуже", "Другое"],
      other: true, stateKey: "mainFear", otherKey: "mainFearOther"
    },
    {
      id: "rel-fear-reaction", type: "single",
      question: "Как ты обычно реагируешь на этот страх?",
      hint: "Выбери свой типичный сценарий",
      options: ["Избегаю ситуации", "Замыкаюсь в себе", "Вступаю в конфликт", "Ищу поддержку у других", "Отвлекаюсь чем-то другим", "Пытаюсь справиться сама/сам", "Другое"],
      other: true, stateKey: "fearReaction", otherKey: "fearReactionOther"
    },
    {
      id: "rel-repeating-scenario", type: "multi",
      question: "Есть ли повторяющийся сценарий?",
      hint: "Выбери то, что повторяется",
      options: ["Выбираю недоступных", "Одни и те же конфликты", "Отношения начинаются ярко, но быстро угасают", "Меня используют / манипулируют", "Я всё время спасаю партнёра", "Партнёры критикуют меня", "Измена или предательство", "Боюсь близости, отталкиваю", "Другое"],
      other: true, stateKey: "repeatingScenario", otherKey: "repeatingScenarioOther"
    },
    {
      id: "rel-role", type: "multi",
      question: "Какая роль тебе ближе в отношениях?",
      hint: "Выбери свои привычные роли",
      options: ["Заботливый(ая)", "Спасатель(ница)", "Жертва", "Контролёр(ша)", "Дистанцируюсь", "Манипулятор(ша)", "Друг(подруга)", "Партнёр(ша)", "Другое"],
      other: true, stateKey: "role", otherKey: "roleOther"
    },
    {
      id: "rel-boundaries", type: "multi",
      question: "Что для тебя неприемлемо в отношениях?",
      hint: "Выбери границы",
      options: ["Ложь и предательство", "Насилие (любое)", "Унижение и критика", "Контроль и ревность", "Зависимости", "Финансовая нечестность", "Отсутствие развития", "Другое"],
      other: true, stateKey: "boundaries", otherKey: "boundariesOther"
    },
    {
      id: "rel-important-factors", type: "sliders",
      question: "Как для тебя важны следующие факторы?",
      hint: "Оцени от 0 до 10",
      sliders: [
        { key: "love", label: "Любовь и чувства" },
        { key: "financial", label: "Финансовая стабильность" },
        { key: "intimacy", label: "Сексуальная близость" },
        { key: "values", label: "Общие ценности" },
        { key: "freedom", label: "Свобода и личное пространство" },
        { key: "family", label: "Дети и семья" }
      ],
      stateKey: "importantFactors"
    },
    {
      id: "rel-children", type: "single",
      question: "Есть ли дети в отношениях?",
      hint: "Выбери ситуацию",
      options: ["Нет детей", "Есть совместные дети", "Дети от предыдущих отношений", "Есть, но хотим ещё", "Не хотим детей", "Другое"],
      other: true, stateKey: "children", otherKey: "childrenOther"
    },
    {
      id: "rel-family-model", type: "multi",
      question: "Какие отношения были в твоей семье?",
      hint: "Выбери то, что ты видел(а)",
      options: ["Любовь и поддержка", "Конфликты и ссоры", "Холодность и дистанция", "Насилие (физ. или псих.)", "Измена, предательство", "Алкоголь / зависимости", "Родители развелись", "Один родитель", "Другое"],
      other: true, stateKey: "familyModel", otherKey: "familyModelOther"
    },
    {
      id: "rel-problem-onset", type: "single",
      question: "Когда впервые появилась подобная проблема в отношениях?",
      hint: "Выбери период",
      options: ["В детстве / семье родителей", "В подростковом возрасте", "В первой серьёзной любви", "В браке / длительных отношениях", "Не знаю", "Другое"],
      other: true, stateKey: "problemOnset", otherKey: "problemOnsetOther"
    },
    {
      id: "rel-influence", type: "multi", max: 3,
      question: "Кто влиял на твоё видение отношений больше всего?",
      hint: "Отметь 1–3 человека",
      options: ["Мама", "Папа", "Бабушка / дедушка", "Старшие родственники", "Учителя, наставники", "Подруги / друзья", "Медиа (фильмы, книги)", "Другое"],
      other: true, stateKey: "influence", otherKey: "influenceOther"
    },
    {
      id: "rel-external-influence", type: "multi",
      question: "Что извне сильнее всего влияет на твою ситуацию сейчас?",
      hint: "Выбери всё, что подходит",
      options: ["Партнёр", "Семья, родственники", "Друзья", "Работа и финансы", "Прошлые отношения", "Общественные установки", "Другое"],
      other: true, stateKey: "externalInfluence", otherKey: "externalInfluenceOther"
    },
    {
      id: "rel-beliefs", type: "multi",
      question: "Какие убеждения о любви ты усвоил(а) в детстве?",
      hint: "Выбери то, во что веришь до сих пор",
      options: ["Любовь нужно заслужить", "Любовь — это страдание", "Все мужчины / женщины одинаковые", "Меня не могут любить просто так", "Счастливые отношения — редкость", "Лучше быть одному(ой)", "Другое"],
      other: true, stateKey: "beliefs", otherKey: "beliefsOther"
    }
  ];

  function relRoute() {
    const extra = relBranchExtraConfig();
    return (extra ? [extra] : []).concat(REL_QUESTIONS);
  }

  function relRouteIndex(id) {
    return relRoute().findIndex((s) => s.id === id);
  }

  function relOptionValue(cfg) {
    const v = state.relInvestigation[cfg.stateKey];
    return Array.isArray(v) ? v : (v || "");
  }

  function relBuildScreen(cfg, idx, total) {
    const section = document.createElement("section");
    section.className = "screen screen--quiz theme-rel";
    section.dataset.screen = cfg.id;
    section.setAttribute("aria-label", "Отношения — " + cfg.question);

    const prevId = idx === 0 ? "rel-why-now" : relRoute()[idx - 1].id;
    const pct = Math.round(((idx + 1) / total) * 100);

    section.innerHTML =
      '<header class="topbar">' +
        '<button class="iconbtn" type="button" data-back="' + prevId + '" aria-label="Назад">' +
          '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<h2 class="topbar__title">Отношения</h2>' +
        '<span class="iconbtn iconbtn--ghost" aria-hidden="true"></span>' +
      '</header>' +
      '<p class="rel-step">Шаг ' + (idx + 1) + ' из ' + total + '</p>' +
      '<div class="rel-progress"><div class="rel-progress__fill" style="width:' + pct + '%"></div></div>' +
      '<div class="screen__body">' +
        '<p class="question"></p>' +
        (cfg.hint ? '<p class="question-hint"></p>' : '') +
        '<div class="rel-dyn-body"></div>' +
        (cfg.other ? '<div class="rel-dyn-other" hidden><label class="field__label"></label><textarea class="textarea" maxlength="300" placeholder="Напиши свой вариант…"></textarea></div>' : '') +
      '</div>' +
      '<div class="screen__footer"><button class="btn btn--primary btn--lg" type="button"></button></div>';

    section.querySelector(".question").textContent = cfg.question;
    if (cfg.hint) section.querySelector(".question-hint").textContent = cfg.hint;
    if (cfg.other) section.querySelector(".rel-dyn-other label").textContent = "Свой вариант";

    const body = section.querySelector(".rel-dyn-body");
    const nextBtn = section.querySelector(".screen__footer button");

    function updateNextLabel() {
      if (cfg.type === "multi" && cfg.max) {
        const count = relOptionValue(cfg).length;
        nextBtn.textContent = "Далее (" + count + "/" + cfg.max + ")";
      } else {
        nextBtn.textContent = "Далее";
      }
    }

    function syncOtherField() {
      if (!cfg.other) return;
      const wrap = section.querySelector(".rel-dyn-other");
      const val = relOptionValue(cfg);
      const otherOn = Array.isArray(val) ? val.indexOf("Другое") >= 0 : val === "Другое";
      wrap.hidden = !otherOn;
    }

    if (cfg.type === "single" || cfg.type === "multi") {
      const list = document.createElement("div");
      list.className = "options options--case";
      list.setAttribute("role", cfg.type === "single" ? "radiogroup" : "group");
      cfg.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option option--case";
        btn.dataset.value = opt;
        if (cfg.type === "single") { btn.setAttribute("role", "radio"); btn.setAttribute("aria-checked", "false"); }
        else { btn.setAttribute("aria-pressed", "false"); }
        btn.innerHTML =
          '<span class="option--case__icon">' + relIconSvg(relIconFor(opt)) + '</span>' +
          '<span class="option--case__text"></span>' +
          '<span class="option--case__check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
        btn.querySelector(".option--case__text").textContent = opt;
        list.appendChild(btn);
      });
      body.appendChild(list);

      function renderOptions() {
        const val = relOptionValue(cfg);
        Array.from(list.children).forEach((btn) => {
          const on = cfg.type === "single" ? val === btn.dataset.value : val.indexOf(btn.dataset.value) >= 0;
          btn.setAttribute(cfg.type === "single" ? "aria-checked" : "aria-pressed", on ? "true" : "false");
        });
        syncOtherField();
        updateNextLabel();
      }

      list.addEventListener("click", (e) => {
        const btn = e.target.closest(".option");
        if (!btn) return;
        if (cfg.type === "single") {
          state.relInvestigation[cfg.stateKey] = btn.dataset.value;
        } else {
          const arr = state.relInvestigation[cfg.stateKey];
          const i = arr.indexOf(btn.dataset.value);
          if (i >= 0) {
            arr.splice(i, 1);
          } else {
            if (cfg.max && arr.length >= cfg.max) { vibrate(15); return; }
            arr.push(btn.dataset.value);
          }
        }
        saveState();
        renderOptions();
        vibrate(6);
      });

      section._relRender = renderOptions;
    } else if (cfg.type === "sliders") {
      const wrap = document.createElement("div");
      wrap.className = "rel-dyn-sliders";
      cfg.sliders.forEach((s) => {
        const row = document.createElement("div");
        row.innerHTML =
          '<div class="rel-dyn-slider__label"><span class="rel-dyn-slider__label__main">' +
            '<span class="rel-dyn-slider__label__icon">' + relIconSvg(relIconFor(s.label)) + '</span>' +
            '<span>' + s.label + '</span>' +
          '</span><b></b></div>' +
          '<input class="slider" type="range" min="0" max="10" step="1">';
        wrap.appendChild(row);
        const input = row.querySelector("input");
        const out = row.querySelector("b");
        input.value = state.relInvestigation.importantFactors[s.key];
        out.textContent = input.value;
        input.style.setProperty("--fill", (Number(input.value) / 10) * 100 + "%");
        input.addEventListener("input", () => {
          out.textContent = input.value;
          input.style.setProperty("--fill", (Number(input.value) / 10) * 100 + "%");
          state.relInvestigation.importantFactors[s.key] = Number(input.value);
          saveState();
        });
      });
      body.appendChild(wrap);
      nextBtn.textContent = "Далее";
    }

    if (cfg.other) {
      const textarea = section.querySelector(".rel-dyn-other textarea");
      textarea.value = state.relInvestigation[cfg.otherKey] || "";
      textarea.addEventListener("input", () => {
        state.relInvestigation[cfg.otherKey] = textarea.value;
        saveState();
      });
    }

    const nextId = idx === total - 1 ? "rel-results" : relRoute()[idx + 1].id;
    nextBtn.addEventListener("click", () => {
      saveState();
      goTo(nextId);
    });

    section._relSyncAll = function () {
      if (section._relRender) section._relRender();
      if (cfg.other) syncOtherField();
      updateNextLabel();
    };

    return section;
  }

  function relRenderAllDynamicScreens() {
    document.querySelectorAll('[data-rel-dynamic="1"]').forEach((el) => el.remove());
    const route = relRoute();
    let anchor = $('[data-screen="rel-why-now"]');
    route.forEach((cfg, idx) => {
      const section = relBuildScreen(cfg, idx, route.length);
      section.dataset.relDynamic = "1";
      section._relSyncAll();
      anchor.after(section);
      anchor = section;
    });
  }

  /* ---------------- navigation ---------------- */

  let screens = $$(".screen");
  let tabItems = $$(".tabbar__item");

  function relRefreshRoute() {
    state.relInvestigation.branch = relComputeBranch();
    relRenderAllDynamicScreens();
    screens = $$(".screen");
    tabItems = $$(".tabbar__item");
  }
  relRefreshRoute();

  function goTo(name, opts) {
    opts = opts || {};
    screens.forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    tabItems.forEach((t) => t.classList.toggle("is-active", t.dataset.nav === name));

    if (name !== "start" && name !== "register") {
      document.body.classList.add("app-started");
    }

    if (name === "results") renderResults();
    if (name === "history") renderHistory();
    if (name === "profile") renderProfile();
    if (name === "rel-results") renderRelResults();

    const active = $('.screen[data-screen="' + name + '"]');
    if (active) active.scrollTop = 0;

    if (!opts.silent) vibrate(8);
  }

  /* ---------------- money screen ---------------- */

  const moneySlider = $("#moneySlider");
  const moneyValueEl = $("#moneyValue");

  function updateMoneyDisplay() {
    const val = Number(moneySlider.value);
    const min = Number(moneySlider.min);
    const max = Number(moneySlider.max);
    const pct = ((val - min) / (max - min)) * 100;
    moneySlider.style.setProperty("--fill", pct + "%");
    moneyValueEl.textContent = val >= max ? formatEuro(max) + "+" : formatEuro(val);
  }

  moneySlider.addEventListener("input", updateMoneyDisplay);

  if (state.answers.money && state.answers.money.income) {
    moneySlider.value = state.answers.money.income;
  }
  updateMoneyDisplay();

  /* ---------------- relationships investigation ---------------- */

  function bindSingleSelect(container, getValue, setValue) {
    if (!container) return;
    function render() {
      $$(".option", container).forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.value === getValue() ? "true" : "false");
      });
    }
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".option");
      if (!btn) return;
      const current = getValue();
      const next = current === btn.dataset.value ? "" : btn.dataset.value;
      setValue(next);
      render();
      vibrate(6);
    });
    render();
  }

  // — screen 1: "Старт" is a plain [data-open] hit-area, handled by the global click binding —

  // — screen 2: free text over the approved image, autosaved as the user types —
  const relSituationInput = $("#relSituation");
  const relSituationCounter = $("#relSituationCounter");

  function updateRelSituationCounter() {
    if (relSituationCounter) relSituationCounter.textContent = relSituationInput.value.length + "/1000";
  }

  if (relSituationInput) {
    relSituationInput.value = state.relInvestigation.problemDescription || "";
    updateRelSituationCounter();
    relSituationInput.addEventListener("input", () => {
      state.relInvestigation.problemDescription = relSituationInput.value;
      updateRelSituationCounter();
      saveState();
    });
  }

  // — get acquainted form —
  const relProfileForm = $("#relProfileForm");
  const relProfileNextBtn = $("#relProfileNext");

  function relProfileData() {
    return state.relInvestigation.profile;
  }

  function renderRelProfileForm() {
    const p = relProfileData();
    ["lastName", "firstName", "patronymic", "occupation", "birthDate"].forEach((key) => {
      if (relProfileForm.elements[key]) relProfileForm.elements[key].value = p[key] || "";
    });
  }

  function checkRelProfileValid() {
    const p = relProfileData();
    const ok = p.firstName.trim() && p.lastName.trim() && p.birthDate &&
      p.marital && p.kids && p.occupation && p.income;
    relProfileNextBtn.disabled = !ok;
  }

  if (relProfileForm) {
    renderRelProfileForm();

    ["lastName", "firstName", "patronymic"].forEach((key) => {
      const el = relProfileForm.elements[key];
      if (!el) return;
      el.addEventListener("input", () => {
        relProfileData()[key] = el.value;
        saveState();
        checkRelProfileValid();
      });
    });

    ["birthDate", "occupation"].forEach((key) => {
      const el = relProfileForm.elements[key];
      if (!el) return;
      el.addEventListener("change", () => {
        relProfileData()[key] = el.value;
        saveState();
        checkRelProfileValid();
      });
    });

    bindSingleSelect(
      $("#relMaritalOptions"),
      () => relProfileData().marital,
      (v) => { relProfileData().marital = v; saveState(); checkRelProfileValid(); }
    );
    bindSingleSelect(
      $("#relKidsOptions"),
      () => relProfileData().kids,
      (v) => { relProfileData().kids = v; saveState(); checkRelProfileValid(); }
    );
    bindSingleSelect(
      $("#relIncomeOptions"),
      () => relProfileData().income,
      (v) => { relProfileData().income = v; saveState(); checkRelProfileValid(); }
    );

    checkRelProfileValid();
  }

  if (relProfileNextBtn) {
    relProfileNextBtn.addEventListener("click", () => {
      if (relProfileNextBtn.disabled) return;
      saveState();
      goTo("rel-outcome");
    });
  }

  // — screen 4: single-select current-situation row, "Другое" reveals a real text field —
  const relRows = $$(".rel-row");
  const relOtherWrap = $("#relOtherWrap");
  const relOtherInput = $("#relOtherInput");

  function renderRelSituation() {
    const selected = state.relInvestigation.situationCategory;
    relRows.forEach((row, i) => {
      const on = row.dataset.value === selected && selected !== "";
      row.setAttribute("aria-checked", on ? "true" : "false");
      const radio = $(".rel-radio--" + i);
      if (radio) radio.classList.toggle("is-checked", on);
    });

    const otherRow = relRows.find((r) => r.dataset.other === "true");
    const otherOn = otherRow && otherRow.getAttribute("aria-checked") === "true";
    if (relOtherWrap) relOtherWrap.hidden = !otherOn;
  }

  if (relOtherInput) {
    relOtherInput.value = state.relInvestigation.situationCategoryOther || "";
    relOtherInput.addEventListener("input", () => {
      state.relInvestigation.situationCategoryOther = relOtherInput.value;
      saveState();
    });
  }

  relRows.forEach((row) => {
    row.addEventListener("click", () => {
      state.relInvestigation.situationCategory = row.dataset.value;
      saveState();
      renderRelSituation();
      vibrate(6);
    });
  });

  renderRelSituation();

  const relSituationNextBtn = $("#relSituationNext");
  if (relSituationNextBtn) {
    relSituationNextBtn.addEventListener("click", () => {
      saveState();
      goTo("rel-current-rating");
    });
  }

  // — current rating: 0-10 slider + free-text reasons —
  const ratingSlider = $("#ratingSlider");
  const ratingValueEl = $("#ratingValue");
  const ratingNote = $("#ratingNote");

  function updateRatingDisplay() {
    ratingValueEl.textContent = ratingSlider.value;
    ratingSlider.style.setProperty("--fill", (Number(ratingSlider.value) / 10) * 100 + "%");
  }

  if (ratingSlider) {
    ratingSlider.value = state.relInvestigation.currentRating != null ? state.relInvestigation.currentRating : 4;
    updateRatingDisplay();
    ratingSlider.addEventListener("input", () => {
      updateRatingDisplay();
      state.relInvestigation.currentRating = Number(ratingSlider.value);
      saveState();
    });
  }
  if (ratingNote) {
    ratingNote.value = state.relInvestigation.currentRatingNote || "";
    ratingNote.addEventListener("input", () => {
      state.relInvestigation.currentRatingNote = ratingNote.value;
      saveState();
    });
  }
  const relRatingNextBtn = $("#relRatingNext");
  if (relRatingNextBtn) {
    relRatingNextBtn.addEventListener("click", () => {
      saveState();
      goTo("rel-goal");
    });
  }

  // — screen 5: single-select goal-direction row, "Другое" reveals a real text field —
  const relRows5 = $$(".rel-row5");
  const relGoalOtherWrap = $("#relGoalOtherWrap");
  const relGoalOtherInput = $("#relGoalOtherInput");

  function renderRelGoal() {
    const selected = state.relInvestigation.goalDirection;
    relRows5.forEach((row, i) => {
      const on = row.dataset.value === selected && selected !== "";
      row.setAttribute("aria-checked", on ? "true" : "false");
      const radio = $(".rel-radio5--" + i);
      if (radio) radio.classList.toggle("is-checked", on);
    });

    const otherRow = relRows5.find((r) => r.dataset.other === "true");
    const otherOn = otherRow && otherRow.getAttribute("aria-checked") === "true";
    if (relGoalOtherWrap) relGoalOtherWrap.hidden = !otherOn;
  }

  if (relGoalOtherInput) {
    relGoalOtherInput.value = state.relInvestigation.goalDirectionOther || "";
    relGoalOtherInput.addEventListener("input", () => {
      state.relInvestigation.goalDirectionOther = relGoalOtherInput.value;
      saveState();
    });
  }

  relRows5.forEach((row) => {
    row.addEventListener("click", () => {
      state.relInvestigation.goalDirection = row.dataset.value;
      saveState();
      renderRelGoal();
      vibrate(6);
    });
  });

  renderRelGoal();

  const relGoalNextBtn = $("#relGoalNext");
  if (relGoalNextBtn) {
    relGoalNextBtn.addEventListener("click", () => {
      saveState();
      relRefreshRoute();
      goTo("rel-benefit");
    });
  }

  // — screen 6: up to 3 result-benefit cards, "Другое" reveals a real text field —
  const BENEFIT_MAX = 3;
  const relCards6 = $$(".rel-card6");
  const relBenefitNextLabel = $("#relBenefitNextLabel");
  const relBenefitOtherWrap = $("#relBenefitOtherWrap");
  const relBenefitOtherInput = $("#relBenefitOtherInput");

  function relBenefits() {
    return state.relInvestigation.resultBenefits;
  }

  function renderRelBenefits() {
    const selected = relBenefits();
    relCards6.forEach((card, i) => {
      const on = selected.includes(card.dataset.value);
      card.setAttribute("aria-pressed", on ? "true" : "false");
      const radio = $(".rel-radio6--" + i);
      if (radio) radio.classList.toggle("is-checked", on);
    });
    if (relBenefitNextLabel) relBenefitNextLabel.textContent = "ДАЛЕЕ (" + selected.length + "/" + BENEFIT_MAX + ")";

    const otherCard = relCards6.find((c) => c.dataset.other === "true");
    const otherOn = otherCard && otherCard.getAttribute("aria-pressed") === "true";
    if (relBenefitOtherWrap) relBenefitOtherWrap.hidden = !otherOn;
  }

  if (relBenefitOtherInput) {
    relBenefitOtherInput.value = state.relInvestigation.resultBenefitsOther || "";
    relBenefitOtherInput.addEventListener("input", () => {
      state.relInvestigation.resultBenefitsOther = relBenefitOtherInput.value;
      saveState();
    });
  }

  relCards6.forEach((card) => {
    card.addEventListener("click", () => {
      const selected = relBenefits();
      const value = card.dataset.value;
      const idx = selected.indexOf(value);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        if (selected.length >= BENEFIT_MAX) {
          vibrate(15);
          return;
        }
        selected.push(value);
      }
      saveState();
      renderRelBenefits();
      vibrate(6);
    });
  });

  renderRelBenefits();

  const relBenefitNextBtn = $("#relBenefitNext");
  if (relBenefitNextBtn) {
    relBenefitNextBtn.addEventListener("click", () => {
      saveState();
      goTo("rel-why-now");
    });
  }
  $$(".rel-hit--s6-skip").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveState();
      goTo("rel-why-now");
    });
  });

  // — screen 7: single-select why-now row, "Другое" reveals a real text field —
  const relRows7 = $$(".rel-row7");
  const relWhyNowOtherWrap = $("#relWhyNowOtherWrap");
  const relWhyNowOtherInput = $("#relWhyNowOtherInput");

  function renderRelWhyNow() {
    const selected = state.relInvestigation.whyNow;
    relRows7.forEach((row, i) => {
      const on = row.dataset.value === selected && selected !== "";
      row.setAttribute("aria-checked", on ? "true" : "false");
      const radio = $(".rel-radio7--" + i);
      if (radio) radio.classList.toggle("is-checked", on);
    });

    const otherRow = relRows7.find((r) => r.dataset.other === "true");
    const otherOn = otherRow && otherRow.getAttribute("aria-checked") === "true";
    if (relWhyNowOtherWrap) relWhyNowOtherWrap.hidden = !otherOn;
  }

  if (relWhyNowOtherInput) {
    relWhyNowOtherInput.value = state.relInvestigation.whyNowOther || "";
    relWhyNowOtherInput.addEventListener("input", () => {
      state.relInvestigation.whyNowOther = relWhyNowOtherInput.value;
      saveState();
    });
  }

  relRows7.forEach((row) => {
    row.addEventListener("click", () => {
      state.relInvestigation.whyNow = row.dataset.value;
      saveState();
      renderRelWhyNow();
      vibrate(6);
    });
  });

  renderRelWhyNow();

  function relFirstDynamicScreenId() {
    const route = relRoute();
    return route.length ? route[0].id : "rel-results";
  }

  const relWhyNowNextBtn = $("#relWhyNowNext");
  if (relWhyNowNextBtn) {
    relWhyNowNextBtn.addEventListener("click", () => {
      saveState();
      goTo(relFirstDynamicScreenId());
    });
  }
  $$(".rel-hit--s7-skip").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveState();
      goTo(relFirstDynamicScreenId());
    });
  });

  /* ---------------- health screen ---------------- */

  const healthOptions = $("#healthOptions");
  const healthFinishBtn = $('[data-finish="health"]');
  let healthChoices = new Set(
    state.answers.health && Array.isArray(state.answers.health.focus) ? state.answers.health.focus : []
  );

  function renderHealthSelection() {
    $$(".option", healthOptions).forEach((btn) => {
      const on = healthChoices.has(btn.dataset.value);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    healthFinishBtn.disabled = healthChoices.size === 0;
  }

  healthOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".option");
    if (!btn) return;
    const v = btn.dataset.value;
    if (healthChoices.has(v)) healthChoices.delete(v);
    else healthChoices.add(v);
    renderHealthSelection();
    vibrate(6);
  });
  renderHealthSelection();

  /* ---------------- result text generators ---------------- */

  function moneyResultText(income) {
    if (income < 3000) {
      return "Твой код денег сейчас настроен на стабильность. Начни с малых, но регулярных шагов — рост придёт через последовательность, а не рывки.";
    }
    if (income < 10000) {
      return "Ты целишься в уверенный средний уровень дохода. Твой код показывает потенциал роста — стоит присмотреться к новым источникам и навыкам.";
    }
    if (income < 25000) {
      return "Код указывает на амбициозный уровень изобилия. Важно не только зарабатывать, но и выстроить систему, которая удержит этот доход.";
    }
    return "Ты метишь в высшую лигу дохода. Такой код требует масштабного мышления: не работа за деньги, а системы и активы, которые работают на тебя.";
  }

  const HEALTH_TEXT = {
    "Энергия": "больше устойчивой энергии в течение дня",
    "Иммунитет": "крепкий иммунитет и меньше сбоев в теле",
    "Физическая форма": "сильное и подвижное тело",
    "Психоэмоциональное состояние": "спокойствие и эмоциональную устойчивость"
  };

  function healthResultText(list) {
    const parts = list.map((k) => HEALTH_TEXT[k]).filter(Boolean);
    if (parts.length === 0) return "Твой код здоровья ещё формируется.";
    let joined;
    if (parts.length === 1) joined = parts[0];
    else joined = parts.slice(0, -1).join(", ") + " и " + parts[parts.length - 1];
    return "Твой код здоровья указывает: сейчас тебе важнее всего " + joined + ". Начни с одной маленькой привычки в этом направлении уже сегодня.";
  }

  const FAMILY_TEXTS = [
    "Архив рода хранит паттерн выносливости: твои предки проходили через трудности и выживали. Эта сила — часть твоего кода.",
    "В твоём роду прослеживается тяга к переменам и новым местам. Возможно, твоя тяга к движению вперёд — не случайность, а наследие.",
    "Архив показывает сильную линию заботы о семье. Забота о близких — глубоко вписанная в твой код черта.",
    "В роду заметен код созидания — стремление строить и создавать своими руками. Это течёт и в тебе."
  ];

  function familyResultText() {
    if (state.answers.family && state.answers.family.text) {
      return state.answers.family.text;
    }
    const text = FAMILY_TEXTS[Math.floor(Math.random() * FAMILY_TEXTS.length)];
    return text;
  }

  /* ---------------- finishing a category ---------------- */

  function finishCategory(category) {
    let summary = "";

    if (category === "money") {
      const income = Number(moneySlider.value);
      state.answers.money = { income };
      summary = moneyResultText(income);
    } else if (category === "health") {
      if (healthChoices.size === 0) return;
      const list = Array.from(healthChoices);
      state.answers.health = { focus: list };
      summary = healthResultText(list);
    } else if (category === "family") {
      const text = familyResultText();
      state.answers.family = { done: true, text };
      summary = text;
    }

    pushHistory(category, summary);
    saveState();
    goTo("results");
  }

  /* ---------------- family loading ---------------- */

  const familyStartBtn = $("[data-family-start]");
  const familyLoading = $("#familyLoading");

  familyStartBtn.addEventListener("click", () => {
    familyStartBtn.hidden = true;
    familyLoading.hidden = false;
    vibrate(10);
    window.setTimeout(() => {
      familyStartBtn.hidden = false;
      familyLoading.hidden = true;
      finishCategory("family");
    }, 1100);
  });

  /* ---------------- results screen ---------------- */

  const resultsBody = $("#resultsBody");

  function relationshipsCardHtml() {
    const meta = CATEGORY_META.relationships;
    const inv = state.relInvestigation;
    const started = !!(inv && (inv.problemDescription.trim() || Object.values(inv.profile).some((v) => v && v.trim && v.trim())));
    const finished = !!(state.answers.relationships && state.answers.relationships.done);

    if (finished) {
      return (
        '<div class="result-card result-card--' + meta.cls + '">' +
          '<div class="result-card__head">' +
            '<span class="result-card__title">' + meta.label + "</span>" +
            '<span class="result-card__badge">пройдено</span>' +
          "</div>" +
          '<p class="result-card__text">' + (state.answers.relationships.summary || "Расследование завершено.") + "</p>" +
          '<button class="chip-btn" type="button" data-goto-quiz="rel-results">Смотреть карту улик</button>' +
        "</div>"
      );
    }

    if (!started) {
      return (
        '<div class="result-card result-card--' + meta.cls + '">' +
          '<div class="result-card__head">' +
            '<span class="result-card__title">' + meta.label + "</span>" +
            '<span class="result-card__badge">не пройдено</span>' +
          "</div>" +
          '<div class="result-card__locked">' +
            "<p>Дело ещё не открыто.</p>" +
            '<button class="chip-btn" type="button" data-goto-quiz="rel-case-open">Пройти</button>' +
          "</div>" +
        "</div>"
      );
    }

    return (
      '<div class="result-card result-card--' + meta.cls + '">' +
        '<div class="result-card__head">' +
          '<span class="result-card__title">' + meta.label + "</span>" +
          '<span class="result-card__badge">в процессе</span>' +
        "</div>" +
        '<p class="result-card__text">Расследование начато. Следующие материалы дела появятся здесь по мере прохождения.</p>' +
        '<button class="chip-btn" type="button" data-goto-quiz="rel-case-open">Продолжить</button>' +
      "</div>"
    );
  }

  function relListText(arr, otherKey) {
    const list = (arr || []).slice();
    const otherIdx = list.indexOf("Другое");
    if (otherIdx >= 0) {
      const otherText = otherKey && state.relInvestigation[otherKey] ? state.relInvestigation[otherKey] : "";
      list[otherIdx] = otherText ? "Другое (" + otherText + ")" : "Другое";
    }
    return list.join(", ");
  }

  function relValueText(value, otherKey) {
    if (!value) return "";
    if (value === "Другое" && otherKey && state.relInvestigation[otherKey]) {
      return "Другое (" + state.relInvestigation[otherKey] + ")";
    }
    return value;
  }

  function relMapBlock(title, text, opts) {
    opts = opts || {};
    if (!text) {
      return '<div class="rel-map-block"><p class="rel-map-block__title">' + title + '</p><p class="rel-map-block__text rel-map-empty">Пока нет данных</p></div>';
    }
    return '<div class="rel-map-block' + (opts.cls ? " " + opts.cls : "") + '"><p class="rel-map-block__title">' + title + '</p><p class="rel-map-block__text">' + text + "</p></div>";
  }

  function relBuildHypotheses() {
    const inv = state.relInvestigation;
    const items = [];

    const familyIssues = (inv.familyModel || []).filter((v) => v !== "Любовь и поддержка" && v !== "Другое");
    if (familyIssues.length) {
      items.push("В семье ты наблюдал(а): " + relListText(familyIssues) + " — возможно, часть текущего сценария связана с этой моделью отношений. Это рабочая гипотеза, которую стоит проверить, а не готовый диагноз.");
    }
    if ((inv.beliefs || []).length) {
      items.push("В детстве сформировались убеждения: " + relListText(inv.beliefs, "beliefsOther") + " — они могут неосознанно влиять на выбор партнёров и реакции в отношениях. Стоит проверить, насколько это так на самом деле.");
    }
    if ((inv.repeatingScenario || []).length) {
      items.push("Замечен повторяющийся сценарий: " + relListText(inv.repeatingScenario, "repeatingScenarioOther") + " — вероятно, за этим стоит общий паттерн. Направление для дальнейшего расследования.");
    }
    if (inv.mainFear) {
      items.push("Главный страх — «" + relValueText(inv.mainFear, "mainFearOther") + "»" + (inv.fearReaction ? ", а типичная реакция на него — «" + relValueText(inv.fearReaction, "fearReactionOther") + "»" : "") + ". Это может формировать поведение в похожих ситуациях — гипотеза для проверки.");
    }
    if ((inv.influence || []).length) {
      items.push("На видение отношений сильнее всего повлияли: " + relListText(inv.influence, "influenceOther") + " — одно из направлений, которое имеет смысл исследовать глубже.");
    }
    return items;
  }

  function relResultsSummaryText() {
    const inv = state.relInvestigation;
    const goal = relValueText(inv.goalDirection, "goalDirectionOther");
    return goal ? "Цель расследования: " + goal : "Расследование завершено.";
  }

  function finishRelInvestigation() {
    if (state.answers.relationships && state.answers.relationships.done) return;
    const summary = relResultsSummaryText();
    state.answers.relationships = { done: true, summary };
    pushHistory("relationships", summary);
    saveState();
  }

  function renderRelResults() {
    finishRelInvestigation();
    const inv = state.relInvestigation;
    const relResultsBody = $("#relResultsBody");
    if (!relResultsBody) return;

    const whereNow = [
      relValueText(inv.situationCategory, "situationCategoryOther"),
      inv.currentRating != null ? "Оценка текущих отношений: " + inv.currentRating + " из 10" + (inv.currentRatingNote ? " (" + inv.currentRatingNote + ")" : "") : ""
    ].filter(Boolean).join(". ");

    const whatIWant = [
      relValueText(inv.goalDirection, "goalDirectionOther"),
      relListText(inv.resultBenefits, "resultBenefitsOther") ? "Это даст: " + relListText(inv.resultBenefits, "resultBenefitsOther") : ""
    ].filter(Boolean).join(". ");

    const whatStopsMe = [
      relListText(inv.obstacles, "obstaclesOther"),
      relListText(inv.boundaries, "boundariesOther") ? "Неприемлемо: " + relListText(inv.boundaries, "boundariesOther") : "",
      inv.mainFear ? "Главный страх: " + relValueText(inv.mainFear, "mainFearOther") : ""
    ].filter(Boolean).join(". ");

    const repeating = relListText(inv.repeatingScenario, "repeatingScenarioOther");

    const whereFormed = [
      inv.problemOnset ? "Похоже, началось: " + relValueText(inv.problemOnset, "problemOnsetOther") : "",
      relListText(inv.familyModel, "familyModelOther") ? "Модель в семье: " + relListText(inv.familyModel, "familyModelOther") : "",
      relListText(inv.influence, "influenceOther") ? "Повлияли: " + relListText(inv.influence, "influenceOther") : ""
    ].filter(Boolean).join(". ");

    const nextToExplore = [
      relListText(inv.role, "roleOther") ? "Твои привычные роли: " + relListText(inv.role, "roleOther") : "",
      relListText(inv.externalInfluence, "externalInfluenceOther") ? "Внешнее влияние: " + relListText(inv.externalInfluence, "externalInfluenceOther") : "",
      relValueText(inv.children, "childrenOther") ? "Дети: " + relValueText(inv.children, "childrenOther") : ""
    ].filter(Boolean).join(". ");

    const hypotheses = relBuildHypotheses();
    const hypothesesHtml = hypotheses.length
      ? '<div class="rel-map-block rel-map-block--hypotheses"><p class="rel-map-block__title">Первые улики / рабочие гипотезы</p><ul class="rel-map-block__list">' +
          hypotheses.map((h) => "<li>" + h + "</li>").join("") +
        "</ul></div>"
      : relMapBlock("Первые улики / рабочие гипотезы", "");

    let html = "";
    html += relMapBlock("Где я сейчас", whereNow);
    html += relMapBlock("Чего я хочу", whatIWant);
    html += relMapBlock("Что мне мешает", whatStopsMe);
    html += relMapBlock("Что повторяется", repeating);
    html += relMapBlock("Где могла формироваться причина", whereFormed);
    html += hypothesesHtml;
    html += relMapBlock("Что исследовать дальше", nextToExplore);

    html +=
      '<div class="rel-cta">' +
        '<p class="rel-cta__title">Продолжи расследование вместе с Евгением Дымой</p>' +
        '<ul class="rel-cta__list">' +
          "<li>Разбор твоей истории</li>" +
          "<li>Проверка гипотез через гипноз</li>" +
          "<li>Поиск глубинных причин</li>" +
          "<li>Персональная стратегия и план</li>" +
        "</ul>" +
        '<button class="btn btn--primary btn--lg" type="button" data-nav="profile">Записаться на консультацию</button>' +
      "</div>";

    relResultsBody.innerHTML = html;
  }

  function categoryCardHtml(cat) {
    if (cat === "relationships") return relationshipsCardHtml();

    const meta = CATEGORY_META[cat];
    const answer = state.answers[cat];

    if (!answer) {
      return (
        '<div class="result-card result-card--' + meta.cls + '">' +
          '<div class="result-card__head">' +
            '<span class="result-card__title">' + meta.label + "</span>" +
            '<span class="result-card__badge">не пройдено</span>' +
          "</div>" +
          '<div class="result-card__locked">' +
            "<p>Код ещё не раскрыт.</p>" +
            '<button class="chip-btn" type="button" data-goto-quiz="' + cat + '">Пройти</button>' +
          "</div>" +
        "</div>"
      );
    }

    let text = "";
    if (cat === "money") text = moneyResultText(answer.income);
    else if (cat === "health") text = healthResultText(answer.focus);
    else if (cat === "family") text = answer.text;

    return (
      '<div class="result-card result-card--' + meta.cls + '">' +
        '<div class="result-card__head">' +
          '<span class="result-card__title">' + meta.label + "</span>" +
          '<span class="result-card__badge">раскрыто</span>' +
        "</div>" +
        '<p class="result-card__text">' + text + "</p>" +
        '<button class="chip-btn" type="button" data-goto-quiz="' + cat + '">Пройти заново</button>' +
      "</div>"
    );
  }

  function renderResults() {
    const done = CATEGORY_ORDER.filter((c) => state.answers[c]).length;
    let html = '<div class="results-summary"><span>Раскрыто направлений</span><strong>' + done + "/4</strong></div>";
    html += CATEGORY_ORDER.map(categoryCardHtml).join("");
    resultsBody.innerHTML = html;
  }

  resultsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-quiz]");
    if (!btn) return;
    goTo(btn.dataset.gotoQuiz);
  });

  /* ---------------- history screen ---------------- */

  const historyBody = $("#historyBody");

  function renderHistory() {
    if (state.history.length === 0) {
      historyBody.innerHTML = '<div class="empty-state">Пока пусто. Пройди своё первое направление — и оно появится здесь.</div>';
      return;
    }

    const items = state.history.map((h) => {
      const meta = CATEGORY_META[h.category] || { label: h.category, cls: "" };
      return (
        '<div class="history-item history-item--' + meta.cls + '">' +
          '<span class="history-dot"></span>' +
          "<div>" +
            '<p class="history-item__title">' + meta.label + "</p>" +
            '<p class="history-item__text">' + h.summary + "</p>" +
            '<p class="history-item__time">' + formatDate(h.ts) + "</p>" +
          "</div>" +
        "</div>"
      );
    }).join("");

    historyBody.innerHTML = items + '<button class="link-btn" type="button" id="clearHistoryBtn">Очистить историю</button>';

    const clearBtn = $("#clearHistoryBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (window.confirm("Удалить всю историю прохождений?")) {
          state.history = [];
          saveState();
          renderHistory();
        }
      });
    }
  }

  /* ---------------- profile screen ---------------- */

  const profileNameInput = $("#profileName");
  const profileAvatar = $("#profileAvatar");
  const progressCount = $("#progressCount");
  const progressFill = $("#progressFill");
  const resetAllBtn = $("#resetAllBtn");

  function renderProfile() {
    profileNameInput.value = state.profile.name || "";
    const initial = (state.profile.name || "?").trim().charAt(0).toUpperCase() || "?";
    profileAvatar.textContent = initial;

    const done = CATEGORY_ORDER.filter((c) => state.answers[c]).length;
    progressCount.textContent = done + "/4";
    progressFill.style.width = (done / 4) * 100 + "%";
  }

  profileNameInput.addEventListener("input", () => {
    state.profile.name = profileNameInput.value;
    profileAvatar.textContent = (profileNameInput.value.trim().charAt(0) || "?").toUpperCase();
    saveState();
  });

  resetAllBtn.addEventListener("click", () => {
    if (window.confirm("Сбросить все ответы, историю, профиль и данные регистрации? Это нельзя отменить.")) {
      state = defaultState();
      saveState();
      healthChoices = new Set();
      renderHealthSelection();
      if (relSituationInput) { relSituationInput.value = ""; updateRelSituationCounter(); }
      if (relProfileForm) {
        renderRelProfileForm();
        $$(".rel-p-chip").forEach((btn) => btn.setAttribute("aria-checked", "false"));
        checkRelProfileValid();
      }
      if (relOtherInput) relOtherInput.value = "";
      renderRelSituation();
      if (ratingSlider) { ratingSlider.value = 4; updateRatingDisplay(); }
      if (ratingNote) ratingNote.value = "";
      if (relGoalOtherInput) relGoalOtherInput.value = "";
      renderRelGoal();
      if (relBenefitOtherInput) relBenefitOtherInput.value = "";
      renderRelBenefits();
      if (relWhyNowOtherInput) relWhyNowOtherInput.value = "";
      renderRelWhyNow();
      relRefreshRoute();
      moneySlider.value = 15000;
      updateMoneyDisplay();
      renderProfile();
      registerForm.reset();
      clearFieldErrors();
      setRegisterNote("", false);
      goTo("register");
    }
  });

  /* ---------------- registration screen ---------------- */

  const registerForm = $("#registerForm");
  const registerSubmitBtn = $("#registerSubmit");
  const registerNote = $("#registerNote");

  function setFieldError(name, msg) {
    const el = registerForm.querySelector('[data-error-for="' + name + '"]');
    if (el) el.textContent = msg || "";
    const input = registerForm.elements[name];
    if (input) input.classList.toggle("has-error", !!msg);
  }

  function clearFieldErrors() {
    ["lastName", "firstName", "phone", "email"].forEach((n) => setFieldError(n, ""));
  }

  function setRegisterNote(msg, isError) {
    registerNote.textContent = msg || "";
    registerNote.hidden = !msg;
    registerNote.classList.toggle("is-error", !!isError);
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors();
    setRegisterNote("", false);

    const data = {
      lastName: registerForm.elements.lastName.value.trim(),
      firstName: registerForm.elements.firstName.value.trim(),
      patronymic: registerForm.elements.patronymic.value.trim(),
      phone: registerForm.elements.phone.value.trim(),
      email: registerForm.elements.email.value.trim()
    };

    let hasError = false;
    if (!data.lastName) { setFieldError("lastName", "Укажи фамилию"); hasError = true; }
    if (!data.firstName) { setFieldError("firstName", "Укажи имя"); hasError = true; }
    if (data.phone.replace(/\D/g, "").length < 7) { setFieldError("phone", "Укажи корректный телефон"); hasError = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setFieldError("email", "Укажи корректный email"); hasError = true; }
    if (hasError) return;

    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = "Сохраняем…";

    try {
      const res = await fetch("/api/register.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json || !json.ok) {
        if (json && json.errors) {
          Object.keys(json.errors).forEach((k) => setFieldError(k, json.errors[k]));
        }
        setRegisterNote((json && json.error) || "Не удалось сохранить данные. Попробуй ещё раз.", true);
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.textContent = "Продолжить";
        return;
      }

      state.registration = Object.assign({}, data, { id: json.id, registeredAt: Date.now() });
      saveState();
      vibrate(10);
      goTo("start");
    } catch (err) {
      setRegisterNote("Нет связи с сервером. Проверь подключение и попробуй ещё раз.", true);
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = "Продолжить";
    }
  });

  /* ---------------- global click bindings ---------------- */

  document.addEventListener("click", (e) => {
    const startBtn = e.target.closest('[data-action="start"]');
    if (startBtn) { goTo("directions"); return; }

    const doorBtn = e.target.closest("[data-open]");
    if (doorBtn) {
      if (doorBtn.dataset.open === "rel-question-1" && !state.relInvestigation.startedAt) {
        state.relInvestigation.startedAt = Date.now();
        saveState();
      }
      goTo(doorBtn.dataset.open);
      return;
    }

    const backBtn = e.target.closest("[data-back]");
    if (backBtn) { goTo(backBtn.dataset.back); return; }

    const finishBtn = e.target.closest("[data-finish]");
    if (finishBtn && !finishBtn.disabled) { finishCategory(finishBtn.dataset.finish); return; }

    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) { goTo(navBtn.dataset.nav); return; }
  });

  /* ---------------- init ---------------- */

  renderProfile();
  goTo(state.registration ? "start" : "register", { silent: true });

  /* ---------------- service worker (progressive enhancement) ---------------- */

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
