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

  function defaultState() {
    return {
      profile: { name: "" },
      registration: null,
      answers: {},
      history: [],
      relInvestigation: {
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
        situationCategoryOther: ""
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return Object.assign(base, parsed, {
        answers: Object.assign({}, parsed.answers),
        history: Array.isArray(parsed.history) ? parsed.history : [],
        relInvestigation: Object.assign({}, base.relInvestigation, parsed.relInvestigation, {
          profile: Object.assign({}, base.relInvestigation.profile, parsed.relInvestigation && parsed.relInvestigation.profile)
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

  /* ---------------- navigation ---------------- */

  const screens = $$(".screen");
  const tabItems = $$(".tabbar__item");

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
      goTo("directions");
    });
  }

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

    if (!started) {
      return (
        '<div class="result-card result-card--' + meta.cls + '">' +
          '<div class="result-card__head">' +
            '<span class="result-card__title">' + meta.label + "</span>" +
            '<span class="result-card__badge">не пройдено</span>' +
          "</div>" +
          '<div class="result-card__locked">' +
            "<p>Дело ещё не открыто.</p>" +
            '<button class="chip-btn" type="button" data-goto-quiz="rel-case-intro">Пройти</button>' +
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
        '<button class="chip-btn" type="button" data-goto-quiz="rel-case-intro">Продолжить</button>' +
      "</div>"
    );
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
      const res = await fetch("/api/register", {
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
    if (doorBtn) { goTo(doorBtn.dataset.open); return; }

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
