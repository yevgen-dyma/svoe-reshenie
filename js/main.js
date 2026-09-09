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
