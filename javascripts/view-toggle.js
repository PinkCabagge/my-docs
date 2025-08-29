(function () {
  // ----- РЕЖИМЫ -----
  const MODES = {
    standalone: { hideTitles: ["Работа в Битрикс24"], hidePathParts: ["/ReferenceGuide/Bitrix/"] },
    bitrix:     { hideTitles: ["Интерфейс пользователя"], hidePathParts: ["/UserInterface/"] }
  };

  const STORAGE_KEY = "docsView";
  const urlParams = new URLSearchParams(location.search);
  const initialMode = urlParams.get("view") || localStorage.getItem(STORAGE_KEY) || "standalone";

  // ----- УСТАНОВКА РЕЖИМА -----
  function setMode(mode, pushState = false) {
    const m = MODES[mode] ? mode : "standalone";
    localStorage.setItem(STORAGE_KEY, m);
    document.documentElement.setAttribute("data-view", m);
    applyMode(m);
    applyOnlyVisibility(m);
    if (pushState) {
      const u = new URL(location.href);
      u.searchParams.set("view", m);
      history.replaceState({}, "", u.toString());
    }
  }

  // ----- ПРИМЕНЕНИЕ РЕЖИМА (меню/редирект/состояние кнопок) -----
  function applyMode(mode) {
    const cfg = MODES[mode];
    const nav = document.querySelector(".md-nav--primary");
    if (nav && cfg) {
      // показать всё, что ранее прятали
      nav.querySelectorAll("[data-toggle-hidden]").forEach(el => {
        el.style.display = "";
        el.removeAttribute("data-toggle-hidden");
      });

      // спрятать разделы по названию
      nav.querySelectorAll(".md-nav__title, .md-nav__link").forEach(el => {
        const text = (el.textContent || "").trim();
        if (cfg.hideTitles.some(t => text === t)) {
          const li = el.closest("li, nav, ul, div");
          if (li) {
            li.style.display = "none";
            li.setAttribute("data-toggle-hidden", "1");
          }
        }
      });

      // спрятать элементы по части пути
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

    // если открыта скрытая страница — перекинуть на первую видимую
    if (cfg && cfg.hidePathParts.some(p => location.pathname.includes(p))) {
      const firstVisible = document.querySelector(".md-nav--primary a.md-nav__link[href]:not([aria-current])");
      if (firstVisible && firstVisible.offsetParent !== null) {
        location.href = firstVisible.href;
      }
    }

    // состояние кнопок
    document.querySelectorAll(".view-toggle button").forEach(btn => {
      const active = btn.dataset.view === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  // ----- КНОПКИ В ШАПКЕ -----
  function injectButtons() {
    if (document.querySelector(".view-toggle")) return;
    const host = document.querySelector(".md-header__inner") || document.querySelector("header.md-header .md-header__title");
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.innerHTML = `
      <button type="button" class="vt-btn" data-view="standalone" aria-pressed="false" title="Показать без 'Работа в Битрикс24'">Комбинатор</button>
      <button type="button" class="vt-btn" data-view="bitrix" aria-pressed="false" title="Показать разделы для Битрикс24">Битрикс24</button>
    `;
    host.appendChild(wrap);

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      setMode(btn.dataset.view, true);
    });
  }

  // ----- ПОДДЕРЖКА БЛОКОВ ONLY -----
  // Вариант 1: HTML-комментарии: <!-- only: standalone --> ... <!-- /only -->
  function processOnlyBlocksViaComments(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_COMMENT, null, false);
    const starts = [];
    while (walker.nextNode()) {
      const c = walker.currentNode;
      const m = (c.nodeValue || "").trim().match(/^only:\s*(standalone|bitrix)$/i);
      if (m) starts.push(c);
    }
    starts.forEach(c => {
      const mode = (c.nodeValue || "").trim().split(":")[1].trim().toLowerCase();
      const wrapper = document.createElement("div");
      wrapper.className = mode === "standalone" ? "only-standalone" : "only-bitrix";
      let n = c.nextSibling, done = false;
      while (n) {
        if (n.nodeType === Node.COMMENT_NODE && (n.nodeValue || "").trim().toLowerCase() === "/only") {
          const end = n; n = n.nextSibling; end.parentNode.removeChild(end); done = true; break;
        }
        const next = n.nextSibling;
        wrapper.appendChild(n);
        n = next;
      }
      if (done && c.parentNode) { c.parentNode.insertBefore(wrapper, c); c.parentNode.removeChild(c); }
    });
  }

  // Вариант 2: Текстовые маркеры: [[only: standalone]] ... [[/only]]
  function processOnlyBlocksViaText(scope) {
    const START_RE = /^\s*\[\[\s*only:\s*(standalone|bitrix)\s*\]\]\s*$/i;
    const END_RE   = /^\s*\[\[\s*\/only\s*\]\]\s*$/i;

    // Берём все прямые дети основных контейнеров
    const containers = scope.querySelectorAll("main, .md-content__inner, .md-typeset, article, section, body");
    containers.forEach(parent => {
      // Собираем срез childNodes, т.к. будем двигать DOM
      const nodes = Array.from(parent.childNodes);
      let i = 0;
      while (i < nodes.length) {
        const node = nodes[i];
        if (node && node.nodeType === Node.TEXT_NODE && START_RE.test(node.textContent || "")) {
          const mode = (node.textContent.match(START_RE)[1] || "").toLowerCase();
          const wrapper = document.createElement("div");
          wrapper.className = mode === "standalone" ? "only-standalone" : "only-bitrix";
          parent.removeChild(node); // убрать стартовый маркер

          // переносим узлы до END_RE
          while (i < nodes.length) {
            const cur = nodes[i];
            if (!cur || !cur.parentNode) { i++; continue; }
            if (cur.nodeType === Node.TEXT_NODE && END_RE.test(cur.textContent || "")) {
              parent.removeChild(cur); // убрать закрывающий маркер
              break;
            }
            const next = cur.nextSibling;
            wrapper.appendChild(cur);
            if (!next) i++; // корректировка индекса при переносе
          }
          // Вставить обёртку на позицию i (или в конец)
          const ref = parent.childNodes[i] || null;
          parent.insertBefore(wrapper, ref);
          // Обновить срез (DOM изменился)
          return processOnlyBlocksViaText(scope);
        } else {
          i++;
        }
      }
    });
  }

  function processOnlyBlocks(root = document) {
    const scope = root.body || root;
    processOnlyBlocksViaComments(scope);
    processOnlyBlocksViaText(scope);
  }

  function applyOnlyVisibility(mode) {
    document.querySelectorAll(".only-standalone, .only-bitrix").forEach(el => el.style.display = "none");
    if (mode === "standalone") document.querySelectorAll(".only-standalone").forEach(el => el.style.display = "");
    if (mode === "bitrix")     document.querySelectorAll(".only-bitrix").forEach(el => el.style.display = "");
  }

  // ----- ХЕЛПЕР ГОТОВНОСТИ -----
  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // ----- ИНИЦИАЛИЗАЦИЯ -----
  onReady(() => {
    injectButtons();
    processOnlyBlocks(document);
    setMode(initialMode, true);
  });

  // Поддержка client-side навигации (Material instant navigation)
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-md-component='container']").forEach(container => {
      container.addEventListener("DOMNodeInserted", () => {
        injectButtons();
        processOnlyBlocks(document);
        const mode = localStorage.getItem(STORAGE_KEY) || "standalone";
        document.documentElement.setAttribute("data-view", mode);
        applyMode(mode);
        applyOnlyVisibility(mode);
      });
    });
  });
})();
