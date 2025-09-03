(function () {
  const STORAGE_KEY = "docsView";

  // ===== короткие утилиты =====
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const getMode = () => localStorage.getItem(STORAGE_KEY) || "standalone";
  const setModeAttr = (m) => document.documentElement.setAttribute("data-view", m);

  // Текстовые метки, по которым матчим пункты меню
  const UI_ALLOWED_IN_TEMPLATES = new Set([
    "Панель инструментов",
    "Область редактирования",
    "Горячие клавиши"
  ]);
  const UI_HIDE_GROUPS_GLOBAL = new Set([
    "Документы",
    "Справочники",
    "Панель администратора",
    "Интеграция"
  ]);
  const FIELDS_HIDE_ITEMS = new Set([
    "Свойства полей",
    "Работа с полями"
  ]);

  // ===== кнопки в шапке =====
  function injectButtons() {
    if (qs(".view-toggle")) return;
    const host = qs(".md-header__inner") || qs("header.md-header .md-header__title");
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.innerHTML = `
      <button type="button" class="vt-btn" data-view="standalone" aria-pressed="false">Комбинатор</button>
      <button type="button" class="vt-btn" data-view="bitrix" aria-pressed="false">Битрикс24</button>
    `;
    host.appendChild(wrap);

    // ВАЖНО: передаём флаг {fromToggle:true}, чтобы редирект сработал только по клику
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      setMode(btn.dataset.view, { fromToggle: true });
    });
  }

  function updateButtonsUI(mode) {
    qsa(".view-toggle .vt-btn").forEach(b => {
      const active = b.dataset.view === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  // ===== помощники для работы с меню =====
  const labelEl  = (li) => li.querySelector(":scope > a.md-nav__link, :scope > label.md-nav__link, :scope > .md-nav__title");
  const labelTxt = (li) => {
    const el = labelEl(li);
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  };
  const hideEl = (el) => { el.style.display = "none"; el.setAttribute("data-toggle-hidden", "1"); };
  const showEl = (el) => { el.style.display = "";   el.removeAttribute("data-toggle-hidden"); };

  // ===== применение режима к левому меню =====
  function applyMode(mode) {
    const nav = qs(".md-nav--primary");
    if (!nav) return;

    // Сброс ранее скрытого
    qsa("[data-toggle-hidden]", nav).forEach(showEl);

    // --- Режим Комбинатор: спрятать целиком «Работа в Битрикс24»
    if (mode === "standalone") {
      qsa("li", nav).forEach(li => {
        if (labelTxt(li) === "Работа в Битрикс24") hideEl(li);
      });
    }

    // --- Режим Битрикс24
    if (mode === "bitrix") {
      // A) Внутри «Интерфейс пользователя» оставить только Шаблоны -> нужные 3 страницы
      const uiGroup = qsa("li", nav).find(li => labelTxt(li) === "Интерфейс пользователя");
      if (uiGroup) {
        // скрыть всё внутри UI, затем показать только нужное
        qsa("li", uiGroup).forEach(hideEl);
        showEl(uiGroup);

        const templates = qsa("li", uiGroup).find(li => labelTxt(li) === "Шаблоны");
        if (templates) {
          showEl(templates);
          qsa("li", templates).forEach(li => {
            if (UI_ALLOWED_IN_TEMPLATES.has(labelTxt(li))) showEl(li);
          });
        }
      }

      // B) Глобально скрыть ветки «Документы», «Справочники», «Панель администратора»
      qsa("li", nav).forEach(li => {
        if (UI_HIDE_GROUPS_GLOBAL.has(labelTxt(li))) hideEl(li);
      });

      // C) В группе «Поля» скрыть «Свойства полей» и «Работа с полями»
      const fieldsGroup = qsa("li", nav).find(li => labelTxt(li) === "Поля");
      if (fieldsGroup) {
        qsa("li", fieldsGroup).forEach(li => {
          if (FIELDS_HIDE_ITEMS.has(labelTxt(li))) hideEl(li);
        });
      }

      // D) подчистить пустые контейнеры без видимых потомков
      qsa("li, nav, ul, div", nav).forEach(el => {
        const visibleLink   = el.querySelector('a.md-nav__link[href]:not([style*="display: none"])');
        const visibleNested = el.querySelector('li:not([style*="display: none"])');
        if (!visibleLink && !visibleNested && el !== nav) hideEl(el);
      });
    }

    updateButtonsUI(mode);
  }

  // ===== контентные блоки only =====
  // Превращаем <!-- only: standalone|bitrix --> ... <!-- /only --> в <div class="only-...">...</div>
  function processOnlyBlocks(root = document) {
    const scope = root.body || root;
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
      wrapper.className = (mode === "standalone" ? "only-standalone" : "only-bitrix");

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

  function applyOnlyVisibility(mode) {
    qsa(".only-standalone, .only-bitrix").forEach(el => el.style.display = "none");
    if (mode === "standalone") qsa(".only-standalone").forEach(el => el.style.display = "");
    if (mode === "bitrix")     qsa(".only-bitrix").forEach(el => el.style.display = "");
  }

  // ===== установка режима =====
  // opts: { fromToggle?: boolean }
  function setMode(mode, opts = {}) {
    const m = (mode === "bitrix") ? "bitrix" : "standalone";
    localStorage.setItem(STORAGE_KEY, m);
    setModeAttr(m);

    applyMode(m);
    applyOnlyVisibility(m);

    // РЕДИРЕКТ ТОЛЬКО ПО КЛИКУ НА КНОПКУ
    if (opts.fromToggle && m === "standalone") {
      const link = qsa(".md-nav--primary a.md-nav__link")
        .find(a => (a.textContent || "").trim() === "Организация интерфейса");
      if (link && link.href !== location.href) {
        location.href = link.href;
        return;
      }
    }
    if (opts.fromToggle && m === "bitrix") {
      const link = qsa(".md-nav--primary a.md-nav__link")
        .find(a => (a.textContent || "").trim() === "Установка приложения");
      if (link && link.href !== location.href) {
        location.href = link.href;
        return;
      }
    }
  }

  // ===== инициализация =====
  function onReady(fn) { document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }

  onReady(() => {
    injectButtons();
    processOnlyBlocks(document);

    // Инициализация БЕЗ редиректа:
    const urlMode = new URLSearchParams(location.search).get("view");
    setMode(urlMode || getMode(), { fromToggle: false });
  });

  // поддержка instant-navigation (перерисовка контента)
  const container = qs("[data-md-component='container']") || qs("main") || document.body;
  const mo = new MutationObserver(() => {
    injectButtons();
    processOnlyBlocks(document);
    const m = getMode();
    setModeAttr(m);
    applyMode(m);
    applyOnlyVisibility(m);
  });
  mo.observe(container, { childList: true, subtree: true });
})();
