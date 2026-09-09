(function () {
  "use strict";

  // ---------- Мобильное меню ----------
  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  // ---------- Аккордеоны (остальные страхи + FAQ) ----------
  function setupAccordion(container) {
    if (!container) return;
    var triggers = container.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      var panel = trigger.nextElementSibling;

      trigger.addEventListener("click", function () {
        var isOpen = trigger.getAttribute("aria-expanded") === "true";

        triggers.forEach(function (otherTrigger) {
          if (otherTrigger !== trigger) {
            otherTrigger.setAttribute("aria-expanded", "false");
            var otherPanel = otherTrigger.nextElementSibling;
            if (otherPanel) otherPanel.style.maxHeight = "";
          }
        });

        if (isOpen) {
          trigger.setAttribute("aria-expanded", "false");
          panel.style.maxHeight = "";
        } else {
          trigger.setAttribute("aria-expanded", "true");
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });
    });
  }

  document.querySelectorAll(".accordion").forEach(setupAccordion);

  // ---------- Переключатели «Посмотреть …» / «Скрыть …» ----------
  document.querySelectorAll("[data-toggle]").forEach(function (btn) {
    var targetId = btn.getAttribute("data-toggle");
    var target = document.getElementById(targetId);
    if (!target) return;
    var label = btn.querySelector("[data-toggle-label]");
    var showText = label ? label.textContent : "";
    var hideText = "Скрыть";

    btn.addEventListener("click", function () {
      var isHidden = target.hidden;
      target.hidden = !isHidden;
      btn.setAttribute("aria-expanded", isHidden ? "true" : "false");
      if (label) label.textContent = isHidden ? hideText : showText;
      if (isHidden) target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });

  // ---------- Плавающая кнопка: скрыта на первом экране, рядом с финальным CTA
  //            и в любой момент, когда она геометрически перекрыла бы другой блок с такой же кнопкой ----------
  var stickyCta = document.querySelector(".sticky-cta");
  var hero = document.querySelector(".hero");
  var finalCta = document.querySelector(".final-cta");
  var centerCtas = Array.prototype.slice.call(document.querySelectorAll(".center-cta"));

  if (stickyCta) {
    var rectsOverlap = function (a, b) {
      return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    };

    var ticking = false;

    function computeStickyVisibility() {
      ticking = false;
      var viewH = window.innerHeight;

      var heroVisible = false;
      if (hero) {
        var hr = hero.getBoundingClientRect();
        heroVisible = hr.bottom > 0 && hr.top < viewH;
      }

      var finalCtaVisible = false;
      if (finalCta) {
        var fr = finalCta.getBoundingClientRect();
        var visibleHeight = Math.min(fr.bottom, viewH) - Math.max(fr.top, 0);
        finalCtaVisible = visibleHeight > fr.height * 0.2;
      }

      // Показываем кнопку, чтобы можно было измерить её реальное положение,
      // затем проверяем перекрытие с другими блоками с такой же кнопкой.
      stickyCta.style.opacity = "1";
      var stickyRect = stickyCta.getBoundingClientRect();
      var overlapsCenterCta = centerCtas.some(function (el) {
        return rectsOverlap(el.getBoundingClientRect(), stickyRect);
      });

      var shouldShow = !heroVisible && !finalCtaVisible && !overlapsCenterCta;
      stickyCta.style.opacity = shouldShow ? "1" : "0";
      stickyCta.style.pointerEvents = shouldShow ? "auto" : "none";
    }

    function onScrollOrResize() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(computeStickyVisibility);
      }
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    computeStickyVisibility();
  }

  // ---------- Лайтбокс сертификатов ----------
  var lightbox = document.getElementById("certLightbox");
  var lightboxImg = document.getElementById("certLightboxImg");
  var lightboxTitle = document.getElementById("certLightboxTitle");
  var lightboxTitleEn = document.getElementById("certLightboxTitleEn");
  var lightboxIssuer = document.getElementById("certLightboxIssuer");
  var lastFocused = null;

  function openLightbox(trigger) {
    if (!lightbox) return;
    lastFocused = trigger;
    lightboxImg.src = trigger.getAttribute("data-full");
    lightboxImg.alt = trigger.getAttribute("data-name") || "";
    lightboxTitle.textContent = trigger.getAttribute("data-name") || "";
    if (lightboxTitleEn) lightboxTitleEn.textContent = trigger.getAttribute("data-name-en") || "";
    lightboxIssuer.textContent = trigger.getAttribute("data-issuer") || "";
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightbox.querySelector(".cert-lightbox-close").focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll("[data-cert-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openLightbox(btn);
    });
  });

  document.querySelectorAll("[data-cert-close]").forEach(function (el) {
    el.addEventListener("click", closeLightbox);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox && !lightbox.hidden) closeLightbox();
  });
})();
