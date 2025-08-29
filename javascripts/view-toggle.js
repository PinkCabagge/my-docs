(function () {
  const MODES = {
    standalone: { hideTitles: ["Работа в Битрикс24"], hidePathParts: ["/ReferenceGuide/Bitrix/"] },
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
    applyOnlyVisibility(m);

    // --- ДОБАВИЛ: если выбрали Комбинатор → перейти на страницу "Организация интерфейса"
    if (m === "standalone") {
      const link = document.querySelector('a.md-nav__link[href*="UserInterface/Interface/interface.md"]');
      if (link) {
        location.href = link.href;
        return; // сразу выходим, т.к. будет переход
      }
    }

    if (pushState) {
      const u = new URL(location.href);
      u.searchParams.set("view", m);
      history.replaceState({}, "", u.toString());
    }
  }

  function applyMode(mode) {
    const cfg = MODES[mode];
    const nav = document.querySelector(".md-nav--primary");
    if (nav && cfg) {
      nav.querySelectorAll("[data-toggle-hidden]").forEach(el => {
        el.style.display = "";
        el.removeAttribute("data-toggle-hidden");
      });

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

    document.querySelectorAll(".view-toggle button").forEach(btn => {
      const active = btn.dataset.view === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function injectButtons() {
    if (document.querySelector(".view-toggle")) return;
    const host = document.querySelector(".md-header__inner") || document.querySelector("header.md-header .md-header__title");
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.innerHTML = `
      <button type="button" class="vt-btn" data-view="standalone" aria-pressed="false">Комбинатор</button>
      <button type="button" class="vt-btn" data-view="bitrix" aria-pressed="false">Битрикс24</button>
    `;
    host.appendChild(wrap);

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      setMode(btn.dataset.view, true);
    });
  }

  // обработка блоков only ...
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

  function processOnlyBlocks(root = document) {
    const scope = root.body || root;
    processOnlyBlocksViaComments(scope);
  }

  function applyOnlyVisibility(mode) {
    document.querySelectorAll(".only-standalone, .only-bitrix").forEach(el => el.style.display = "none");
    if (mode === "standalone") document.querySelectorAll(".only-standalone").forEach(el => el.style.display = "");
    if (mode === "bitrix")     document.querySelectorAll(".only-bitrix").forEach(el => el.style.display = "");
  }

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  onReady(() => {
    injectButtons();
    processOnlyBlocks(document);
    setMode(initialMode, true);
  });

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
