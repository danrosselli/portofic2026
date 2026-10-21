/* Arqueologia no Brasil — Porto FIC 2026
   Interações: menu, progresso, revelações, linha do tempo, rotas,
   sambaqui, escavação, galeria, comparadores (LiDAR / escaneamento) e mapa. */
(function () {
  "use strict";

  const doc = document;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── utilitários ─────────────────────────────────────── */
  function on(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn);
  }

  function selector(scope, sel) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(sel));
  }

  /* ── barra de progresso + estado do cabeçalho ────────── */
  const header = doc.querySelector("[data-header]");
  const bar = doc.querySelector("[data-progress-bar]");

  function onScroll() {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (bar) {
      const total = doc.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (total > 0 ? Math.min(100, (y / total) * 100) : 0) + "%";
    }
  }
  on(window, "scroll", onScroll, { passive: true });
  onScroll();

  /* ── índice (menu overlay) ───────────────────────────── */
  const menuToggle = doc.querySelector("[data-menu-toggle]");
  const menu = doc.querySelector("[data-menu]");
  const menuLinks = selector(doc, "[data-menu-link]");

  function setMenu(open) {
    if (!menu || !menuToggle) return;
    menu.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      const first = menu.querySelector("a");
      if (first) first.focus();
    }
  }
  on(menuToggle, "click", function () {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  on(doc, "keydown", function (e) {
    if (e.key === "Escape" && menu && menu.classList.contains("is-open")) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  menuLinks.forEach(function (link) {
    on(link, "click", function () {
      setMenu(false);
    });
  });

  /* ── revelações na rolagem ───────────────────────────── */
  const reveals = selector(doc, ".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ── destaque da seção ativa no índice ───────────────── */
  const sectionIds = menuLinks.map(function (a) {
    return a.getAttribute("data-menu-link");
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          menuLinks.forEach(function (a) {
            a.classList.toggle("is-current", a.getAttribute("data-menu-link") === id);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    sectionIds.forEach(function (id) {
      const el = doc.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ── controles com painéis (timeline, sambaqui, sítios) ── */
  function bindPanelGroup(tabSel, panelSel, markerSel) {
    const q = function (sel) {
      return sel.charAt(0) === "[" ? sel : "[" + sel + "]";
    };
    const tabs = selector(doc, q(tabSel));
    const groupMap = {};
    const tabAttr = tabSel.replace(/^.*?data-/, "");
    const panelAttr = panelSel.replace(/^.*?data-/, "");
    tabs.forEach(function (tab) {
      const id = tab.getAttribute("data-" + tabAttr);
      groupMap[id] = {
        tab: tab,
        panel: doc.querySelector("[data-" + panelAttr + '="' + id + '"]')
      };
    });

    function activate(id) {
      Object.keys(groupMap).forEach(function (key) {
        const item = groupMap[key];
        const active = key === id;
        if (item.tab) {
          item.tab.classList.toggle("is-active", active);
          item.tab.setAttribute("aria-pressed", String(active));
        }
        if (item.panel) item.panel.classList.toggle("is-active", active);
      });
      if (markerSel && typeof markerSel === "function") markerSel(id);
    }

    tabs.forEach(function (tab) {
      on(tab, "click", function () {
        activate(tab.getAttribute("data-" + tabAttr));
      });
    });
    return { activate: activate, groupMap: groupMap };
  }

  /* linha do tempo */
  bindPanelGroup("data-timeline-tab", "data-timeline-panel");

  /* sambaqui: também realça as camadas no corte */
  const sambaquiSvg = doc.querySelector("[data-sambaqui] .sambaqui-svg");
  const svgLayerMap = {
    topo: "sg-topo",
    "conchas-superiores": "sg-conchas",
    sepultamentos: "sg-sep",
    restos: "sg-restos",
    base: "sg-base"
  };
  bindPanelGroup("data-sambaqui-tab", "data-sambaqui-panel", function (id) {
    if (!sambaquiSvg) return;
    const activeEl = svgLayerMap[id];
    selector(sambaquiSvg, ".sg-layer").forEach(function (g) {
      g.classList.toggle("is-on", g.id === activeEl);
    });
    sambaquiSvg.classList.add("is-focusing");
  });

  /* sítios: lista + marcadores do mapa */
  const sites = bindPanelGroup("data-site-tab", "data-site-panel", function (id) {
    const marker = doc.querySelector('[data-site-marker="' + id + '"]');
    if (marker) {
      selector(doc, ".map-marker").forEach(function (m) {
        m.classList.remove("is-on");
      });
      marker.classList.add("is-on");
    }
  });
  const firstSiteTab = doc.querySelector("[data-site-tab]");
  if (firstSiteTab) {
    sites.activate(firstSiteTab.getAttribute("data-site-tab"));
  }

  const map = doc.querySelector("[data-sites-map]");
  if (map) {
    selector(map, ".map-marker").forEach(function (marker) {
      on(marker, "click", function () {
        sites.activate(marker.getAttribute("data-site-marker"));
        const panel = doc.querySelector('[data-site-panel="' + marker.getAttribute("data-site-marker") + '"]');
        if (panel) panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
      });
    });
  }

  /* ── rotas de povoamento: realce do traçado ──────────── */
  const routesMap = doc.querySelector(".routes-map");
  const rotas = selector(doc, ".rota");
  if (routesMap && rotas.length) {
    function routeFocus(id, onFlag) {
      rotas.forEach(function (r) {
        const active = r.getAttribute("data-rota") === id;
        r.classList.toggle("is-on", onFlag && active);
      });
      routesMap.classList.toggle("is-focusing", onFlag);
      const path = routesMap.querySelector('[data-route="' + id + '"]');
      if (path) {
        selector(routesMap, ".route").forEach(function (p) {
          p.classList.remove("is-on");
        });
        if (onFlag) path.classList.add("is-on");
      }
    }
    rotas.forEach(function (r) {
      const id = r.getAttribute("data-rota");
      on(r, "mouseenter", function () { routeFocus(id, true); });
      on(r, "mouseleave", function () { routeFocus(id, false); });
      on(r, "focusin", function () { routeFocus(id, true); });
      on(r, "focusout", function () { routeFocus(id, false); });
    });
  }

  /* ── escavação interativa ────────────────────────────── */
  const excav = doc.querySelector("[data-excavation]");
  if (excav) {
    const digBtn = excav.querySelector("[data-dig]");
    const resetBtn = excav.querySelector("[data-reset]");
    const layers = selector(excav, ".pit-layer");
    const entries = excav.querySelector("[data-exc-entries]");
    const empty = excav.querySelector("[data-exc-empty]");
    const hint = excav.querySelector("[data-exc-hint]");
    let dug = 0;

    function renderEntries() {
      entries.innerHTML = "";
      layers.forEach(function (layer, i) {
        if (i >= dug) return;
        const d = {
          depth: layer.querySelector(".pit-depth").textContent,
          find: layer.dataset.find,
          note: layer.dataset.note
        };
        const li = doc.createElement("li");
        const meta = doc.createElement("span");
        meta.className = "mono";
        meta.textContent = d.depth;
        const p = doc.createElement("p");
        p.textContent = d.find + ". " + d.note;
        li.appendChild(meta);
        li.appendChild(p);
        entries.appendChild(li);
      });
      if (empty) empty.hidden = dug > 0;
      if (hint) {
        hint.textContent =
          dug === 0
            ? "Aperte “Escavar” e observe como cada camada é retirada e registrada."
            : dug < layers.length
              ? "Camada retirada e registrada. Continue a escavação."
              : "Escavação concluída — todas as camadas foram registradas e catalogadas.";
      }
    }

    function dig() {
      if (dug >= layers.length) return;
      const layer = layers[dug];
      layer.classList.remove("is-hidden");
      dug += 1;
      renderEntries();
      if (digBtn) digBtn.disabled = dug >= layers.length;
    }

    function reset() {
      dug = 0;
      layers.forEach(function (l) { l.classList.add("is-hidden"); });
      renderEntries();
      if (digBtn) digBtn.disabled = false;
    }

    layers.forEach(function (l) { l.classList.add("is-hidden"); });
    on(digBtn, "click", dig);
    on(resetBtn, "click", reset);
    renderEntries();
  }

  /* ── galeria de arte rupestre ────────────────────────── */
  const dialog = doc.querySelector("[data-art-dialog]");
  const openers = selector(doc, "[data-art-open]");
  if (dialog && openers.length) {
    const dialogImg = dialog.querySelector("[data-art-dialog-img]");
    const dialogTitle = dialog.querySelector("[data-art-dialog-title]");
    const dialogText = dialog.querySelector("[data-art-dialog-text]");
    const closeBtn = dialog.querySelector("[data-art-close]");

    function openArt(btn) {
      const img = btn.querySelector("img");
      const title = btn.getAttribute("data-art-title") || "";
      const text = btn.getAttribute("data-art-text") || "";
      if (img && dialogImg) {
        dialogImg.src = img.src;
        dialogImg.alt = img.alt;
      }
      if (dialogTitle) dialogTitle.textContent = title;
      if (dialogText) dialogText.textContent = text;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        if (closeBtn) closeBtn.focus();
      } else {
        dialog.setAttribute("open", "");
      }
    }
    openers.forEach(function (btn) {
      on(btn, "click", function () { openArt(btn); });
    });
    on(closeBtn, "click", function () { dialog.close(); });
    on(dialog, "click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ── comparadores com slider (LiDAR e escaneamento) ──── */
  selector(doc, "[data-reveal-slider]").forEach(function (wrap) {
    const input = wrap.querySelector(".reveal-range");
    const min = parseFloat(wrap.getAttribute("data-slider-min") || "0");
    const max = parseFloat(wrap.getAttribute("data-slider-max") || "100");
    if (!input) return;
    const update = function () {
      const raw = parseFloat(input.value);
      const pct = ((raw - min) / (max - min)) * 100;
      wrap.style.setProperty("--clip", pct.toFixed(1));
    };
    on(input, "input", update);
    update();
  });

  /* ── dados de escavação registrados nos layers ───────── */
  // (dados de achados definidos nos atributos dos layers no template)
})();
