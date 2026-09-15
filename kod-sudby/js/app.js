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
      history: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed, {
        answers: Object.assign({}, parsed.answers),
        history: Array.isArray(parsed.history) ? parsed.history : []
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

  /* ---------------- relationships screen ---------------- */

  const relOptions = $("#relOptions");
  const relFinishBtn = $('[data-finish="relationships"]');
  let relChoice = state.answers.relationships ? state.answers.relationships.choice : null;

  function renderRelSelection() {
    $$(".option", relOptions).forEach((btn) => {
      const on = btn.dataset.value === relChoice;
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    relFinishBtn.disabled = !relChoice;
  }

  relOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".option");
    if (!btn) return;
    relChoice = btn.dataset.value;
    renderRelSelection();
    vibrate(6);
  });
  renderRelSelection();

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

  const REL_TEXT = {
    "Любовь": "Твой код настроен на глубокую эмоциональную близость. Ищи не идеального партнёра, а честный и открытый контакт — это твой настоящий ориентир.",
    "Семья": "Ты стремишься к устойчивости и продолжению рода. Код показывает, что для тебя ценности и традиции важнее мимолётных впечатлений.",
    "Дружба": "Твой код направлен на широкий, поддерживающий круг общения. Люди рядом с тобой — источник силы и энергии не меньше, чем романтика.",
    "Партнёрство": "Ты ищешь равного союзника — в делах и в жизни. Код показывает потребность в балансе вклада и уважения, а не в романтике ради романтики."
  };

  function relResultText(choice) {
    return REL_TEXT[choice] || "Твой код отношений ещё формируется.";
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
    } else if (category === "relationships") {
      if (!relChoice) return;
      state.answers.relationships = { choice: relChoice };
      summary = relResultText(relChoice);
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

  function categoryCardHtml(cat) {
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
    else if (cat === "relationships") text = relResultText(answer.choice);
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
      relChoice = null;
      healthChoices = new Set();
      renderRelSelection();
      renderHealthSelection();
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
