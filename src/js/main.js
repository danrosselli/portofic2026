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
      if (!groupMap[id]) {
        groupMap[id] = {
          tabs: [],
          panel: doc.querySelector("[data-" + panelAttr + '="' + id + '"]')
        };
      }
      groupMap[id].tabs.push(tab);
    });

    function activate(id) {
      Object.keys(groupMap).forEach(function (key) {
        const item = groupMap[key];
        const active = key === id;
        item.tabs.forEach(function (tab) {
          tab.classList.toggle("is-active", active);
          tab.setAttribute("aria-pressed", String(active));
        });
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

  /* sambaqui: foca a camada ativa na pilha de imagens */
  const sambaquiStack = doc.querySelector("[data-sambaqui] .sambaqui-stack");
  const sambaqui = bindPanelGroup("data-sambaqui-tab", "data-sambaqui-panel", function () {
    if (sambaquiStack) sambaquiStack.classList.add("is-focusing");
  });
  const firstSambaquiTab = doc.querySelector("[data-sambaqui-tab]");
  if (firstSambaquiTab) {
    sambaqui.activate(firstSambaquiTab.getAttribute("data-sambaqui-tab"));
  }

  /* ── sambaqui: hit-test por alfa ─────────────────────────
     As camadas se sobrepõem e as imagens têm margens
     transparentes, então o :hover nativo acendia a camada errada.
     Aqui o ponteiro é consultado contra o canal alfa de cada
     imagem, na ordem em que elas são desenhadas (de cima para
     baixo, respeitando a hierarquia da pilha). */
  let sambaquiClearHover = function () {};
  if (sambaquiStack) {
    const sLayers = selector(sambaquiStack, ".sambaqui-layer");
    const hits = sLayers.map(function (layer) {
      const item = { layer: layer, img: layer.querySelector("img"), w: 0, h: 0, alpha: null };

      function bake() {
        const img = item.img;
        if (!img || !img.naturalWidth) return;
        try {
          const W = 256;
          const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
          const cv = doc.createElement("canvas");
          cv.width = W;
          cv.height = H;
          const ctx = cv.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, W, H);
          const px = ctx.getImageData(0, 0, W, H).data;
          const alpha = new Uint8Array(W * H);
          for (let i = 0, j = 3; i < alpha.length; i += 1, j += 4) alpha[i] = px[j];
          item.w = W;
          item.h = H;
          item.alpha = alpha;
          sambaquiStack.classList.add("has-hit");
        } catch (err) {
          item.alpha = null; /* pixels ilegíveis: mantém clique/hover nativos */
        }
      }

      if (item.img && item.img.complete && item.img.naturalWidth) bake();
      else on(item.img, "load", bake);
      return item;
    });

    /* a ordem visual segue o desenho das camadas; em foco, a ativa
       ganha z-index 10 e passa a ser testada primeiro */
    function orderedLayers() {
      if (sambaquiStack.classList.contains("is-assembled")) return sLayers;
      const active = sambaquiStack.querySelector(".sambaqui-layer.is-active");
      if (!active) return sLayers;
      return [active].concat(sLayers.filter(function (l) { return l !== active; }));
    }

    function layerAt(x, y) {
      const ordered = orderedLayers();
      for (let i = 0; i < ordered.length; i += 1) {
        const item = hits[sLayers.indexOf(ordered[i])];
        if (!item || !item.alpha || !item.img) continue;
        const r = item.img.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
        const u = Math.floor(((x - r.left) / r.width) * item.w);
        const v = Math.floor(((y - r.top) / r.height) * item.h);
        const col = Math.min(item.w - 1, Math.max(0, u));
        const row = Math.min(item.h - 1, Math.max(0, v));
        if (item.alpha[row * item.w + col] > 90) return item.layer;
      }
      return null;
    }

    let hoveredLayer = null;
    function setHover(layer) {
      if (hoveredLayer === layer) return;
      if (hoveredLayer) hoveredLayer.classList.remove("is-hover");
      hoveredLayer = layer;
      if (hoveredLayer) hoveredLayer.classList.add("is-hover");
    }
    sambaquiClearHover = function () { setHover(null); };

    let hoverFrame = 0;
    on(sambaquiStack, "pointermove", function (e) {
      if (e.pointerType === "touch" || hoverFrame) return;
      const x = e.clientX;
      const y = e.clientY;
      /* sobre o botão de visão do todo (dentro do quadro), não acende nada */
      const overStack = e.target === sambaquiStack;
      hoverFrame = requestAnimationFrame(function () {
        hoverFrame = 0;
        setHover(overStack ? layerAt(x, y) : null);
      });
    });
    on(sambaquiStack, "pointerleave", function () { setHover(null); });
    on(sambaquiStack, "click", function (e) {
      /* cliques vindos do teclado chegam com o próprio botão como
         alvo e já são tratados pelo bindPanelGroup acima */
      if (e.target !== sambaquiStack) return;
      const layer = layerAt(e.clientX, e.clientY);
      if (layer) sambaqui.activate(layer.getAttribute("data-sambaqui-tab"));
    });
  }

  /* ── sambaqui: visão do todo (camadas montadas) ────────── */
  const wholeBtn = doc.querySelector("[data-sambaqui-view]");
  if (wholeBtn && sambaquiStack) {
    const wholeCaption = doc.querySelector("[data-caption-exploded]");
    const captionExploded = wholeCaption ? wholeCaption.getAttribute("data-caption-exploded") : "";
    const captionWhole = wholeCaption ? wholeCaption.getAttribute("data-caption-assembled") : "";
    const labelExploded = wholeBtn.getAttribute("data-label-exploded") || wholeBtn.textContent.trim();
    const labelWhole = wholeBtn.getAttribute("data-label-assembled") || "";

    on(wholeBtn, "click", function () {
      const whole = !sambaquiStack.classList.contains("is-assembled");
      sambaquiStack.classList.toggle("is-assembled", whole);
      wholeBtn.setAttribute("aria-pressed", String(whole));
      wholeBtn.textContent = whole ? labelWhole : labelExploded;
      if (wholeCaption) wholeCaption.textContent = whole ? captionWhole : captionExploded;
      sambaquiClearHover();
    });
  }

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

  /* ── mapa da ocupação: zoom seguindo o ponteiro ─────── */
  selector(doc, "[data-routes-zoom]").forEach(function (wrap) {
    if (reduceMotion) return;
    if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    /* o centro do zoom para antes da borda (margem de segurança para o
       ponteiro); nesse ponto o deslocamento compensa e a imagem mostra
       até a sua borda final, sem deixar área vazia. */
    const pad = 12;
    const level = 1.85;

    function zoomAt(e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;

      const rawX = ((e.clientX - r.left) / r.width) * 100;
      const rawY = ((e.clientY - r.top) / r.height) * 100;
      const x = Math.min(100 - pad, Math.max(pad, rawX));
      const y = Math.min(100 - pad, Math.max(pad, rawY));

      /* desloca a imagem para encaixar a borda correspondente na janela */
      let tx = 0;
      let ty = 0;
      if (rawX > 100 - pad) tx = ((100 - x) / 100) * r.width * (1 - level);
      else if (rawX < pad) tx = -(x / 100) * r.width * (1 - level);
      if (rawY > 100 - pad) ty = ((100 - y) / 100) * r.height * (1 - level);
      else if (rawY < pad) ty = -(y / 100) * r.height * (1 - level);

      wrap.style.setProperty("--zx", x.toFixed(2) + "%");
      wrap.style.setProperty("--zy", y.toFixed(2) + "%");
      wrap.style.setProperty("--zoom", String(level));
      wrap.style.setProperty("--tx", tx.toFixed(1) + "px");
      wrap.style.setProperty("--ty", ty.toFixed(1) + "px");
      wrap.classList.add("is-zooming");
    }

    on(wrap, "pointerenter", zoomAt);
    on(wrap, "pointermove", zoomAt);
    on(wrap, "pointerleave", function () {
      wrap.classList.remove("is-zooming");
    });
    on(wrap, "pointercancel", function () {
      wrap.classList.remove("is-zooming");
    });
  });

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
    const dialogSource = dialog.querySelector("[data-art-dialog-source]");
    const dialogSourceWrap = dialog.querySelector("[data-art-dialog-source-wrap]");
    const closeBtn = dialog.querySelector("[data-art-close]");

    function openArt(btn) {
      const img = btn.querySelector("img");
      const title = btn.getAttribute("data-art-title") || "";
      const text = btn.getAttribute("data-art-text") || "";
      const src = btn.getAttribute("data-art-src") || "";
      if (img && dialogImg) {
        dialogImg.src = img.src;
        dialogImg.alt = img.alt;
      }
      if (dialogTitle) dialogTitle.textContent = title;
      if (dialogText) dialogText.textContent = text;
      if (dialogSource && dialogSourceWrap) {
        if (src) {
          dialogSource.href = src;
          dialogSourceWrap.hidden = false;
        } else {
          dialogSource.removeAttribute("href");
          dialogSourceWrap.hidden = true;
        }
      }
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
