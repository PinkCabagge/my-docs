(function () {
  // Настройки — что скрывать в каждом режиме
  const MODES = {
    standalone: { hideTitles: ["Работа в Битрикс24"],  hidePathParts: ["/ReferenceGuide/Bitrix/"] },
    bitrix:     { hideTitles: ["Интерфейс пользователя"], hidePathParts: ["/UserInterface/"] }
  };

  const STORAGE_KEY = "docsView";
  const urlParams = new URLSearchParams(location.search);
  const initialMode = urlParams.get("view") || localStorage.getItem(STORAGE_KEY) || "standalone";

  function setMode(mode, pushState = false) {
    const m = MODES[mode] ? mode : "standalone";
    localStorage.setItem(STORAGE_KEY, m);
    document.documentElement.setAttribute("data-view", m);
    applyMode(m);
    if (pushState) {
      const u = new URL(location.href);
      u.searchParams.set("view", m);
      history.replaceState({}, "", u.toString());
    }
  }

  // Скрываем секции в левом меню и при необходимости перенаправляем
  function applyMode(mode) {
    const cfg = MODES[mode];

    // 1) Скрыть группы навигации по заголовку
    const nav = document.querySelector(".md-nav--primary");
    if (nav) {
      // показываем всё
      nav.querySelectorAll("[data-toggle-hidden]").forEach(el => {
        el.style.display = "";
        el.removeAttribute("data-toggle-hidden");
      });

      // прячем нужные
      const groupTitles = nav.querySelectorAll(".md-nav__title, .md-nav__link");
      groupTitles.forEach(el => {
        const text = (el.textContent || "").trim();
        if (cfg.hideTitles.some(t => text === t)) {
          // поднимаемся до контейнера группы
          const li = el.closest("li, nav, ul, div");
          if (li) {
            li.style.display = "none";
            li.setAttribute("data-toggle-hidden", "1");
          }
        }
      });

      // Дополнительно прятать по ссылкам (на случай, если заголовок отличается)
      nav.querySelectorAll("a.md-nav__link[href]").forEach(a => {
        const href = a.getAttribute("href");
        if (href && cfg.hidePathParts.some(p => href.includes(p))) {
          const li = a.closest("li");
          if (li) {
            li.style.display = "none";
            li.setAttribute("data-toggle-hidden", "1");
          }
        }
      });
    }

    // 2) Если текущая страница относится к скрытому разделу — перекинуть на главную
    const isHiddenPage = cfg.hidePathParts.some(p => location.pathname.includes(p));
    if (isHiddenPage) {
      // пробуем найти первую видимую ссылку слева
      const firstVisible = document.querySelector(
        ".md-nav--primary a.md-nav__link[href]:not([aria-current])"
      );
      if (firstVisible && firstVisible.offsetParent !== null) {
        location.href = firstVisible.href;
      } else {
        // запасной вариант — на корень документации
        location.href = (document.querySelector("a.md-header__button[aria-label='Back']")?.href) || "/";
      }
    }

    // 3) Обновить состояние кнопок
    document.querySelectorAll(".view-toggle button").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.view === mode);
      btn.setAttribute("aria-pressed", String(btn.dataset.view === mode));
    });
  }

  // Вставляем кнопки в шапку (Material header)
  function injectButtons() {
    // уже есть?
    if (document.querySelector(".view-toggle")) return;

    const host =
      document.querySelector(".md-header__inner") ||
      document.querySelector("header.md-header .md-header__title");

    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.innerHTML = `
      <button type="button" class="vt-btn" data-view="standalone" aria-pressed="false" title="Показать без 'Работа в Битрикс24'">Комбинатор</button>
      <button type="button" class="vt-btn" data-view="bitrix" aria-pressed="false" title="Показать только разделы для Битрикс24">Битрикс24</button>
    `;
    host.appendChild(wrap);

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      setMode(btn.dataset.view, true);
    });
  }

  // Ждём, пока Material дорисует DOM после навигации (instant/navigation)
  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  onReady(() => {
    injectButtons();
    setMode(initialMode, true);
  });

  // Поддержка client-side навигации (data-md-component="container")
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-md-component='container']").forEach(container => {
      container.addEventListener("DOMNodeInserted", () => {
        injectButtons();
        const mode = localStorage.getItem(STORAGE_KEY) || "standalone";
        document.documentElement.setAttribute("data-view", mode); // <-- добавили
        applyMode(mode);
      });
    });
  });
})();
