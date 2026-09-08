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

  // ---------- Аккордеоны (этапы и FAQ) ----------
  function setupAccordion(container) {
    if (!container) return;
    var triggers = container.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      var panel = trigger.nextElementSibling;

      trigger.addEventListener("click", function () {
        var isOpen = trigger.getAttribute("aria-expanded") === "true";

        // Закрываем остальные пункты этого же аккордеона
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

    // Открываем первый пункт по умолчанию
    var firstTrigger = container.querySelector('.accordion-trigger[aria-expanded="true"]');
    if (firstTrigger) {
      var firstPanel = firstTrigger.nextElementSibling;
      if (firstPanel) firstPanel.style.maxHeight = firstPanel.scrollHeight + "px";
    }
  }

  setupAccordion(document.getElementById("stagesAccordion"));
  setupAccordion(document.getElementById("faqAccordion"));

  // ---------- Скрываем плавающую кнопку рядом с финальным CTA ----------
  var stickyCta = document.querySelector(".sticky-cta");
  var finalCta = document.querySelector(".final-cta");

  if (stickyCta && finalCta && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          stickyCta.style.opacity = entry.isIntersecting ? "0" : "1";
          stickyCta.style.pointerEvents = entry.isIntersecting ? "none" : "auto";
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(finalCta);
  }

  // ---------- Лайтбокс сертификатов ----------
  var lightbox = document.getElementById("certLightbox");
  var lightboxImg = document.getElementById("certLightboxImg");
  var lightboxTitle = document.getElementById("certLightboxTitle");
  var lightboxIssuer = document.getElementById("certLightboxIssuer");
  var lastFocused = null;

  function openLightbox(trigger) {
    if (!lightbox) return;
    lastFocused = trigger;
    lightboxImg.src = trigger.getAttribute("data-full");
    lightboxImg.alt = trigger.getAttribute("data-name") || "";
    lightboxTitle.textContent = trigger.getAttribute("data-name") || "";
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
