/* ==========================================================================
   AKIMIA ESTUDIO - app.js
   JavaScript nativo, sin dependencias. Un solo bucle de animación (rAF) lee el
   scroll y escribe estilos; las escenas solo trabajan mientras están visibles.

   Índice
     0. Configuración editable
     1. Utilidades y bucle principal
     2. Loader
     3. Header y menú
     4. Revelados, texto por palabras y contadores
     5. Escenas de scroll: manifiesto, imagen que se abre, stack, galería
     6. Marquee, parallax y footer
   ========================================================================== */
(() => {
  'use strict';

  /* ========================================================================
     0. CONFIGURACIÓN EDITABLE (datos reales del cliente)
     ======================================================================== */
  const CONFIG = {
    // Número de WhatsApp con código de país, solo dígitos. Ej. México: '5212221234567'
    whatsapp: '520000000000',
    // Cómo se muestra el número en la página
    whatsappLabel: '+52 000 000 0000',
    // Correo de contacto (déjalo vacío para ocultarlo)
    email: '',
    // Redes sociales (déjalas vacías para ocultar el ícono)
    social: { instagram: '', facebook: '', tiktok: '' }
  };

  /* ========================================================================
     1. UTILIDADES Y BUCLE PRINCIPAL
     ======================================================================== */
  const doc = document.documentElement;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));           // normaliza v de [a,b] a [0,1]
  const easeIO  = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const reduced  = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const view = { w: innerWidth, h: innerHeight, y: scrollY, vel: 0, dir: 1 };
  const tasks = [];                  // funciones que corren en cada frame
  const resizers = [];               // funciones que corren al cambiar el tamaño
  const onFrame = fn => tasks.push(fn);
  const onResize = fn => resizers.push(fn);

  // Observa si un elemento está cerca del viewport para no gastar frames de más
  function watch(el, margin = 12) {
    const s = { on: false };
    new IntersectionObserver(([e]) => { s.on = e.isIntersecting; }, { rootMargin: `${margin}% 0px ${margin}% 0px` }).observe(el);
    return s;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 64);
    last = now;
    const y = window.scrollY;
    const dy = y - view.y;
    view.vel = lerp(view.vel, dy, .18);
    if (Math.abs(dy) > .5) view.dir = dy > 0 ? 1 : -1;
    view.y = y;
    for (let i = 0; i < tasks.length; i++) tasks[i](now, dt);
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 120);
  });
  function measure() {
    view.w = innerWidth; view.h = innerHeight;
    resizers.forEach(fn => fn());
  }

  // Seguro anti-bloqueo: si algo falla, el loader nunca se queda tapando la página
  setTimeout(() => {
    const l = $('#loader');
    if (l) { l.classList.add('is-done'); doc.classList.add('is-ready'); document.body.classList.remove('is-locked'); setTimeout(() => l.remove(), 1600); }
  }, 12000);

  /* ========================================================================
     2. LOADER: el logo pasa de "plano" (gris) a "obra" (color)
     ======================================================================== */
  function initLoader() {
    const loader = $('#loader');
    if (!loader) { doc.classList.add('is-ready'); return; }
    document.body.classList.add('is-locked');

    const arc = $('#loaderArc');
    const pct = $('#loaderPct');
    const CIRC = 2 * Math.PI * 54;
    const minTime = reduced ? 350 : 2300;
    const t0 = performance.now();
    let loaded = false, shown = 0, finished = false;

    // Señales reales de carga: fuentes, imagen principal y evento load
    const heroImg = $('#heroImg');
    Promise.all([
      document.fonts && document.fonts.ready,
      new Promise(res => {
        if (!heroImg || heroImg.complete) return res();
        heroImg.addEventListener('load', res); heroImg.addEventListener('error', res);
      }),
      new Promise(res => (document.readyState === 'complete' ? res() : addEventListener('load', res)))
    ]).then(() => { loaded = true; });
    setTimeout(() => { loaded = true; }, 6500);

    function tick(now) {
      const timeP = clamp((now - t0) / minTime);
      const target = loaded ? timeP : Math.min(timeP, .86);
      shown += (target - shown) * .09;
      const v = clamp(shown);
      arc.style.strokeDashoffset = String(CIRC * (1 - v));
      loader.style.setProperty('--p', v.toFixed(4));
      pct.textContent = String(Math.round(v * 100));
      if (loaded && timeP >= 1 && v > .992 && !finished) { finished = true; finish(); return; }
      requestAnimationFrame(tick);
    }

    function finish() {
      pct.textContent = '100';
      arc.style.strokeDashoffset = '0';
      loader.style.setProperty('--p', '1');
      setTimeout(() => {
        loader.classList.add('is-done');
        setTimeout(() => { doc.classList.add('is-ready'); document.body.classList.remove('is-locked'); }, 650);
        setTimeout(() => loader.remove(), 1700);
      }, 380);
    }
    requestAnimationFrame(tick);
  }

  /* ========================================================================
     3. HEADER Y MENÚ
     ======================================================================== */
  function initHeader() {
    const header = $('#header');
    const burger = $('#burger');
    const menu = $('#menu');
    const bar = $('#progressBar');
    let menuOpen = false, lastY = 0;

    onFrame(() => {
      const y = view.y;
      header.classList.toggle('is-stuck', y > 24);
      if (!menuOpen) {
        if (y > 520 && y > lastY + 4) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 520) header.classList.remove('is-hidden');
      }
      lastY = y;
      const max = doc.scrollHeight - view.h;
      bar.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
    });

    function setMenu(open) {
      menuOpen = open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      document.body.classList.toggle('is-locked', open);
      if (open) header.classList.remove('is-hidden');
    }
    burger.addEventListener('click', () => setMenu(!menuOpen));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
    matchMedia('(min-width: 1100px)').addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false); });

    // Enlace activo según la sección visible
    const links = $$('.header__nav a');
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(l => l.classList.remove('is-current'));
        const a = map.get(en.target.id);
        if (a) a.classList.add('is-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ========================================================================
     4. REVELADOS, TEXTO POR PALABRAS Y CONTADORES
     ======================================================================== */
  // Divide un titular en palabras con máscara (cada palabra sube desde abajo)
  function splitWords(els) {
    els.forEach(el => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      el.setAttribute('aria-label', text);
      el.textContent = '';
      text.split(' ').forEach((word, i, arr) => {
        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i); wi.textContent = word;
        w.appendChild(wi); el.appendChild(w);
        if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  }

  function initReveals() {
    splitWords($$('[data-split]'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .05 });
    $$('[data-reveal], [data-split]').forEach(el => io.observe(el));
  }

  function initCounters() {
    const items = $$('[data-count]');
    if (!items.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target, end = parseFloat(el.dataset.count);
        if (reduced) { el.textContent = String(end); return; }
        const t0 = performance.now(), dur = 1700;
        (function step(now) {
          const p = clamp((now - t0) / dur);
          el.textContent = String(Math.round(end * easeOut(p)));
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: .6 });
    items.forEach(el => { if (!reduced) el.textContent = '0'; io.observe(el); });
  }

  /* ========================================================================
     5. ESCENAS DE SCROLL
     ======================================================================== */

  /* ---- 5.1 Manifiesto: cada palabra se "construye" al avanzar ---- */
  function initManifesto() {
    const el = $('#manifestoText');
    if (!el) return;
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = text.split(' ').map((word, i, arr) => {
      const s = document.createElement('span');
      s.className = 'w'; s.setAttribute('aria-hidden', 'true'); s.textContent = word;
      if (/^alkimia/i.test(word)) s.classList.add('acc');
      el.appendChild(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    if (reduced) { words.forEach(w => w.classList.add('on')); return; }

    const vis = watch(el, 5);
    let on = 0;
    onFrame(() => {
      if (!vis.on) return;
      const r = el.getBoundingClientRect();
      const p = clamp((view.h * .82 - r.top) / (view.h * .34 + r.height));
      const n = Math.round(p * words.length);
      if (n === on) return;
      for (let i = Math.min(n, on); i < Math.max(n, on); i++) words[i].classList.toggle('on', i < n);
      on = n;
    });
  }

  /* ---- 5.2 Imagen que se abre: boceto -> pantalla completa -> obra terminada ---- */
  function initReveal() {
    const section = $('#plano-obra');
    if (!section || reduced) return;
    const pin = $('#revealPin'), intro = $('#revealIntro'), frame = $('#revealFrame');
    const sketch = $('#revealSketch'), color = $('#revealColor'), scan = $('#revealScan');
    const scrim = $('#revealScrim'), copy = $('#revealCopy');
    const imgs = $$('img', frame);
    const vis = watch(section, 10);
    let geo = {}, sp = -1;

    function layout() {
      const W = pin.clientWidth, H = pin.clientHeight;
      const mobile = W < 700;
      const w0 = mobile ? W * .88 : Math.min(W * .6, 1060);
      const t0 = Math.min(intro.offsetHeight + 22, H * .46);
      const bottomGap = mobile ? 64 : 52;
      geo = { W, H, l0: (W - w0) / 2, t0, b0: H - bottomGap, mobile };
    }
    layout();
    onResize(() => { layout(); sp = -1; });

    onFrame(() => {
      if (!vis.on) return;
      const r = section.getBoundingClientRect();
      const raw = clamp(-r.top / (r.height - view.h));
      sp = sp < 0 ? raw : lerp(sp, raw, .12);
      const p = sp;

      const open = easeIO(range(p, 0, .34));              // fase 1: la imagen se abre
      const wipe = easeIO(range(p, .32, .74));            // fase 2: el boceto se vuelve obra
      const txt  = easeOut(range(p, .76, .94));           // fase 3: aparece el mensaje

      const { W, H, l0, t0, b0 } = geo;
      const k = 1 - open;
      const l = l0 * k, t = t0 * k, rr = W - l0 * k, b = H - (H - b0) * k, c = 44 * k;
      frame.style.clipPath = `polygon(${l}px ${t}px, ${rr - c}px ${t}px, ${rr}px ${t + c}px, ${rr}px ${b}px, ${l}px ${b}px)`;

      const s = 1.3 - .3 * open + .04 * wipe;
      imgs.forEach(im => im.style.setProperty('--s', s.toFixed(4)));
      color.style.clipPath = `inset(0 ${(1 - wipe) * 100}% 0 0)`;
      scan.style.transform = `translate3d(${wipe * W}px,0,0)`;
      scan.style.opacity = wipe > .01 && wipe < .995 ? '1' : '0';

      intro.style.opacity = String(1 - range(p, 0, .22));
      intro.style.transform = `translate3d(0,${-70 * range(p, 0, .3)}px,0)`;
      scrim.style.opacity = txt.toFixed(3);
      copy.style.opacity = txt.toFixed(3);
      copy.style.transform = `translate3d(0,${(1 - txt) * 34}px,0)`;
      copy.style.pointerEvents = txt > .6 ? 'auto' : 'none';
    });
  }

  /* ---- 5.3 Servicios: tarjetas apiladas con profundidad ---- */
  function initStack() {
    const cards = $$('[data-svc]');
    if (!cards.length || reduced) return;
    const mq = matchMedia('(min-width: 900px)');
    const stack = $('#stack');
    const vis = watch(stack, 15);
    const inners = cards.map(c => $('.svc__inner', c));
    let tops = [], prev = cards.map(() => -1);

    function measureTops() { tops = cards.map(c => parseFloat(getComputedStyle(c).top) || 0); }
    measureTops(); onResize(measureTops);
    mq.addEventListener('change', () => { measureTops(); inners.forEach(i => { i.style.transform = ''; i.style.removeProperty('--veil'); }); });

    onFrame(() => {
      if (!vis.on || !mq.matches) return;
      for (let i = 0; i < cards.length - 1; i++) {
        const cur = cards[i].getBoundingClientRect();
        const nxt = cards[i + 1].getBoundingClientRect();
        const p = clamp((cur.bottom - nxt.top) / (cur.bottom - tops[i + 1]));
        if (Math.abs(p - prev[i]) < .002) continue;
        prev[i] = p;
        inners[i].style.transform = `translate3d(0,${-14 * p}px,0) rotateX(${3.2 * p}deg) scale(${1 - .06 * p})`;
        inners[i].style.setProperty('--veil', (p * .42).toFixed(3));
      }
    });
  }

  /* ---- 5.4 Proyectos: el scroll vertical mueve la galería en horizontal ---- */
  function initWork() {
    const section = $('#proyectos');
    if (!section) return;
    const pin = $('#workPin'), track = $('#workTrack');
    const imgs = $$('[data-px]', track);
    const mq = matchMedia('(min-width: 900px)');
    const vis = watch(section, 10);
    let enabled = false, dist = 0, wp = -1;

    function setup() {
      enabled = mq.matches && !reduced;
      section.classList.toggle('is-h', enabled);
      track.style.transform = '';
      if (!enabled) { section.style.height = ''; return; }
      dist = Math.max(0, track.scrollWidth - view.w);
      section.style.height = `${dist + pin.offsetHeight}px`;
      wp = -1;
    }
    setup(); onResize(setup);
    mq.addEventListener('change', setup);
    if (document.fonts) document.fonts.ready.then(setup);

    onFrame(() => {
      if (!enabled || !vis.on) return;
      const r = section.getBoundingClientRect();
      const raw = clamp(-r.top / Math.max(1, r.height - view.h));
      wp = wp < 0 ? raw : lerp(wp, raw, .13);
      track.style.transform = `translate3d(${-wp * dist}px,0,0)`;
      section.style.setProperty('--wp', wp.toFixed(4));
      imgs.forEach(im => {
        const box = im.parentElement.getBoundingClientRect();
        const lim = box.width * .07;
        const d = box.left + box.width / 2 - view.w / 2;
        im.style.setProperty('--tx', `${clamp(-d * .07, -lim, lim).toFixed(1)}px`);
      });
    });
  }

  /* ========================================================================
     6. MARQUEE, PARALLAX Y FOOTER
     ======================================================================== */
  // Marquee que acelera y cambia de dirección con la velocidad del scroll
  function initMarquee() {
    const track = $('#marqueeTrack');
    if (!track) return;
    if (reduced) return;
    const vis = watch(track.parentElement, 5);
    let half = 0, pos = 0, speed = 1;
    const measureHalf = () => { half = track.scrollWidth / 2; };
    measureHalf(); onResize(measureHalf);
    if (document.fonts) document.fonts.ready.then(measureHalf);
    track.style.animation = 'none';
    onFrame((now, dt) => {
      if (!vis.on || !half) return;
      const target = view.dir * (1 + Math.min(Math.abs(view.vel) * .35, 14));
      speed = lerp(speed, target, .06);
      pos -= speed * dt * .06;
      if (pos <= -half) pos += half;
      if (pos > 0) pos -= half;
      track.style.transform = `translate3d(${pos}px,0,0)`;
    });
  }

  // Parallax suave de imágenes marcadas con data-parallax
  function initParallax() {
    if (reduced) return;
    const items = $$('[data-parallax]').map(el => ({ el, box: el.parentElement, k: parseFloat(el.dataset.parallax) || .05, vis: watch(el.parentElement, 8) }));
    onFrame(() => {
      for (const it of items) {
        if (!it.vis.on) continue;
        const r = it.box.getBoundingClientRect();
        const lim = it.el.offsetHeight * .05;
        const d = r.top + r.height / 2 - view.h / 2;
        it.el.style.setProperty('--py', `${clamp(-d * it.k, -lim, lim).toFixed(1)}px`);
      }
    });
  }

  // La palabra gigante del footer se "rellena" al llegar al final
  function initFooterWord() {
    const el = $('#footerWord');
    if (!el) return;
    if (reduced) { el.style.setProperty('--fill', '1'); return; }
    const vis = watch(el, 5);
    let f = 0;
    onFrame(() => {
      if (!vis.on) return;
      const r = el.getBoundingClientRect();
      f = lerp(f, clamp((view.h - r.top) / (r.height * 1.1)), .1);
      el.style.setProperty('--fill', f.toFixed(3));
    });
  }


  /* ========================================================================
     7. HERO: canvas de malla técnica + partículas, tilt 3D y parallax
     ======================================================================== */
  function initHero() {
    const hero = $('#inicio');
    const canvas = $('#heroCanvas');
    const stage = $('#heroStage');
    const float = $('.hero__float', hero);
    const copy = $('#heroCopy');
    const visual = $('.hero__visual', hero);
    const vis = watch(hero, 0);
    const ctx = canvas.getContext('2d');
    let W = 1, H = 1, dpr = 1, nodes = [], motes = [];
    const ptr = { x: -9999, y: -9999, nx: 0, ny: 0, active: false };

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = W * H;
      const nCount = clamp(Math.round(area / 24000), 22, 64);
      nodes = Array.from({ length: nCount }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22
      }));
      const mCount = clamp(Math.round(area / 30000), 14, 44);
      motes = Array.from({ length: mCount }, () => newMote(true));
      if (reduced) draw(0);
    }
    function newMote(anywhere) {
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : H + 20,
        r: 1.4 + Math.random() * 2.6, vy: .12 + Math.random() * .38,
        ph: Math.random() * Math.PI * 2, a: .25 + Math.random() * .5
      };
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      const LINK = Math.min(170, W * .24);

      // Malla: nodos que se conectan con líneas finas (como una estructura)
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const f = 1 - Math.sqrt(d2) / LINK;
          // cerca del cursor las líneas se vuelven naranjas
          const mx = (a.x + b.x) / 2 - ptr.x, my = (a.y + b.y) / 2 - ptr.y;
          const near = ptr.active ? clamp(1 - Math.sqrt(mx * mx + my * my) / 190) : 0;
          ctx.strokeStyle = near > .02 ? `rgba(240,86,10,${(.1 + near * .55) * f + .04})` : `rgba(75,81,91,${f * .17})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // Marcas de topógrafo (+) en cada nodo
      ctx.strokeStyle = 'rgba(75,81,91,.42)';
      ctx.beginPath();
      for (const n of nodes) { ctx.moveTo(n.x - 3, n.y); ctx.lineTo(n.x + 3, n.y); ctx.moveTo(n.x, n.y - 3); ctx.lineTo(n.x, n.y + 3); }
      ctx.stroke();

      // Partículas de luz naranja que suben lentamente
      for (const m of motes) {
        if (!reduced) { m.y -= m.vy; m.x += Math.sin(now * .0006 + m.ph) * .22; if (m.y < -24) Object.assign(m, newMote(false)); }
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 5);
        g.addColorStop(0, `rgba(254,109,29,${m.a})`);
        g.addColorStop(.4, `rgba(254,109,29,${m.a * .28})`);
        g.addColorStop(1, 'rgba(254,109,29,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    resize(); onResize(resize);

    if (reduced) return;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
      ptr.nx = (ptr.x / r.width - .5) * 2; ptr.ny = (ptr.y / r.height - .5) * 2;
      ptr.active = true;
    });
    hero.addEventListener('pointerleave', () => { ptr.active = false; ptr.nx = 0; ptr.ny = 0; });

    let rx = 0, ry = 0, ix = 0, iy = 0;
    onFrame(now => {
      if (!vis.on) return;
      draw(now);
      // Tilt 3D de la imagen siguiendo el cursor (suavizado)
      rx = lerp(rx, -ptr.ny * 7, .07); ry = lerp(ry, ptr.nx * 10, .07);
      ix = lerp(ix, -ptr.nx * 16, .07); iy = lerp(iy, -ptr.ny * 16, .07);
      float.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      float.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      float.style.setProperty('--ix', `${ix.toFixed(1)}px`);
      float.style.setProperty('--iy', `${iy.toFixed(1)}px`);
      // Parallax de salida al hacer scroll
      const y = clamp(view.y, 0, view.h);
      copy.style.translate = `0 ${(y * .14).toFixed(1)}px`;
      visual.style.translate = `0 ${(y * -.06).toFixed(1)}px`;
    });
  }

  /* ========================================================================
     8. MAQUETA 3D: una residencia que se construye con el scroll
     Motor propio sobre canvas 2D (proyección en perspectiva + painter's algorithm).
     Progreso P: 0 terreno -> proyecto (alambre) -> obra sólida -> acabados y luz.
     ======================================================================== */
  function createBuild(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 1, H = 1, dpr = 1;
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    }
    if (canvas.parentElement && canvas.parentElement.matches('.process__stage')) {
      canvas.parentElement.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width - .5) * 2; mouse.y = ((e.clientY - r.top) / r.height - .5) * 2;
      });
    }

    const V = (x, y, z) => ({ x, y, z });
    const INK = '16,18,22';

    /* ---- Volúmenes de la casa (metros aproximados) ---- */
    const BOXES = [
      { id: 'plinth', x: [-6, 6],     z: [-4, 4],      y: 0,    h: .3,  tone: [226, 229, 234], solid: [.44, .52], wire: [.20, .30] },
      { id: 'ground', x: [-4.4, 1.6], z: [-2.4, 2.2],  y: .3,   h: 3,   tone: [246, 247, 249], solid: [.50, .64], wire: [.24, .36], topX: [-4.4, -3] },
      { id: 'garage', x: [1.6, 4.8],  z: [-2.2, 1.6],  y: .3,   h: 3,   tone: [62, 67, 76],    solid: [.56, .68], wire: [.28, .40], topX: [4.6, 4.8] },
      { id: 'upper',  x: [-3, 4.6],   z: [-2.6, 2.6],  y: 3.3,  h: 2.8, tone: [238, 240, 243], solid: [.64, .78], wire: [.32, .46] },
      { id: 'wood',   x: [-.4, 2.8],  z: [2.6, 2.74],  y: 3.5,  h: 2.4, tone: [190, 138, 92],  solid: [.76, .84], wire: [.44, .52] },
      { id: 'roof',   x: [-3.5, 5.1], z: [-3.1, 3.1],  y: 6.1,  h: .3,  tone: [44, 48, 56],    solid: [.78, .88], wire: [.40, .50] }
    ];

    // Decoraciones por cara: coordenadas locales (u horizontal, v vertical) de 0 a 1
    const DECO = {
      ground: { front: [{ t: 'glass', u: [.06, .94], v: [.1, .9], mull: [.36, .64] }], left: [{ t: 'glass', u: [.2, .8], v: [.25, .75], mull: [.5] }] },
      garage: { front: [{ t: 'door', u: [.1, .9], v: [.03, .8] }] },
      upper:  { front: [{ t: 'glass', u: [.05, .6], v: [.26, .78], mull: [.5] }], left: [{ t: 'glass', u: [.2, .8], v: [.3, .76], mull: [] }], right: [{ t: 'glass', u: [.25, .75], v: [.3, .76], mull: [] }] },
      wood:   { front: [{ t: 'slats' }] }
    };

    function faces(b, g) {
      const [x0, x1] = b.x, [z0, z1] = b.z, y0 = b.y, y1 = b.y + b.h * g;
      const tx0 = b.topX ? b.topX[0] : x0, tx1 = b.topX ? b.topX[1] : x1;
      return [
        { k: 'front', n: V(0, 0, 1),  p: [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)] },
        { k: 'back',  n: V(0, 0, -1), p: [V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0)] },
        { k: 'left',  n: V(-1, 0, 0), p: [V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0)] },
        { k: 'right', n: V(1, 0, 0),  p: [V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1)] },
        { k: 'top',   n: V(0, 1, 0),  p: [V(tx0, y1, z1), V(tx1, y1, z1), V(tx1, y1, z0), V(tx0, y1, z0)] }
      ];
    }

    const L = (() => { const x = .48, y = .77, z = .43, m = Math.hypot(x, y, z); return V(x / m, y / m, z / m); })();

    function draw(P, now) {
      if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      mouse.sx = lerp(mouse.sx, mouse.x, .05); mouse.sy = lerp(mouse.sy, mouse.y, .05);

      /* ---- Cámara ---- */
      const t = now * .001;
      const yaw = lerp(Math.PI - 1.7, Math.PI + .46, easeIO(P)) + Math.sin(t * .35) * .045 + mouse.sx * .3;
      const pitch = lerp(.96, .3, easeOut(clamp(P * 1.35))) - mouse.sy * .06;
      const D = 36, ppu = Math.min(W / 14.2, H / 9.3);
      const f = ppu * D * lerp(.66, 1, easeOut(clamp(P * 1.7)));
      const cx = W / 2, cy = H * (.57 + .05 * (1 - easeOut(clamp(P * 2))));
      const target = V(0, 2.7, .2);
      const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
      const rot = (x, y, z) => { const x1 = x * cY + z * sY, z1 = -x * sY + z * cY; return V(x1, y * cP + z1 * sP, -y * sP + z1 * cP); };
      const toView = p => { const r = rot(p.x - target.x, p.y - target.y, p.z - target.z); r.z += D; return r; };
      const scr = p => { const v = toView(p); return { x: cx + f * v.x / v.z, y: cy - f * v.y / v.z, z: v.z }; };

      /* ---- Suelo: cuadrícula del terreno ---- */
      const gridA = .55 + .45 * range(P, 0, .08);
      ctx.lineWidth = 1;
      for (let i = -14; i <= 14; i += 2) {
        const a = (1 - Math.abs(i) / 15) * .16 * gridA;
        ctx.strokeStyle = `rgba(${INK},${a})`;
        let p1 = scr(V(i, 0, -14)), p2 = scr(V(i, 0, 14));
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        p1 = scr(V(-14, 0, i)); p2 = scr(V(14, 0, i));
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }

      // Línea de lote (naranja punteada) que se dibuja al inicio
      const poly = pts => pts.map(scr);
      const strokeProg = (pts, prog, closed = true) => {
        const s = poly(closed ? pts.concat([pts[0]]) : pts);
        let total = 0; const seg = [];
        for (let i = 1; i < s.length; i++) { const d = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y); seg.push(d); total += d; }
        let left = total * prog;
        ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length && left > 0; i++) {
          const d = seg[i - 1], k = Math.min(1, left / d);
          ctx.lineTo(lerp(s[i - 1].x, s[i].x, k), lerp(s[i - 1].y, s[i].y, k));
          left -= d;
        }
        ctx.stroke();
      };
      const rectPts = (x0, x1, z0, z1, y = .01) => [V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1)];

      const lotP = easeOut(range(P, 0, .14));
      const fade = 1 - .7 * range(P, .45, .7);
      ctx.save();
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 10;
      ctx.strokeStyle = `rgba(240,86,10,${.8 * fade})`; ctx.lineWidth = 1.6;
      strokeProg(rectPts(-9.5, 9.5, -6.8, 6.8), lotP);
      ctx.restore();
      ctx.strokeStyle = `rgba(240,86,10,${.95 * fade})`; ctx.lineWidth = 1.8;
      const fp = easeOut(range(P, .05, .22));
      [[-6, 6, -4, 4], [-4.4, 1.6, -2.4, 2.2], [1.6, 4.8, -2.2, 1.6], [-3, 4.6, -2.6, 2.6]].forEach(r => strokeProg(rectPts(r[0], r[1], r[2], r[3]), fp));

      /* ---- Sombra de contacto ---- */
      const shA = range(P, .48, .9);
      if (shA > 0) {
        for (let k = 0; k < 3; k++) {
          const e = 6.4 + k * 1.1;
          const pts = poly(rectPts(-e, e, -e * .72, e * .72, 0));
          ctx.fillStyle = `rgba(${INK},${.05 * shA})`;
          ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
        }
      }

      /* ---- Piscina (aparece al final) ---- */
      const poolA = easeOut(range(P, .84, .95));
      if (poolA > 0) {
        const pq = poly([V(-3.6, .31, 2.8), V(3.2, .31, 2.8), V(3.2, .31, 3.8), V(-3.6, .31, 3.8)]);
        ctx.fillStyle = `rgba(150,190,215,${.6 * poolA})`;
        ctx.beginPath(); pq.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${.7 * poolA})`; ctx.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const z = 3 + k * .22 + Math.sin(t * 1.4 + k) * .04;
          const a = scr(V(-3.5, .32, z)), b = scr(V(3.1, .32, z));
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${INK},${.6 * poolA})`; ctx.lineWidth = 1.1;
        ctx.beginPath(); pq.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke();
      }

      /* ---- Sólidos: se levantan en secuencia ---- */
      const glassA = easeOut(range(P, .8, .92));
      const glow = easeOut(range(P, .86, 1)) * (.85 + .15 * Math.sin(t * 2));
      const list = [];
      for (const b of BOXES) {
        const g = easeOut(range(P, b.solid[0], b.solid[1]));
        if (g <= .002) continue;
        for (const fc of faces(b, g)) {
          // culling: solo caras que miran a la cámara
          const nv = rot(fc.n.x, fc.n.y, fc.n.z);
          const pv = fc.p.map(toView);
          const c = V((pv[0].x + pv[2].x) / 2, (pv[0].y + pv[2].y) / 2, (pv[0].z + pv[2].z) / 2);
          if (nv.x * c.x + nv.y * c.y + nv.z * c.z >= 0) continue;
          list.push({ b, fc, g, depth: c.z, s: fc.p.map(scr) });
        }
      }
      list.sort((a, b) => b.depth - a.depth);

      const lerpPt = (s, u, v) => ({
        x: s[0].x + (s[1].x - s[0].x) * u + (s[3].x - s[0].x) * v,
        y: s[0].y + (s[1].y - s[0].y) * u + (s[3].y - s[0].y) * v
      });
      const quad = (s, u0, u1, v0, v1) => [lerpPt(s, u0, v0), lerpPt(s, u1, v0), lerpPt(s, u1, v1), lerpPt(s, u0, v1)];
      const path = pts => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };

      for (const it of list) {
        const { b, fc, s } = it;
        const ndl = Math.max(0, fc.n.x * L.x + fc.n.y * L.y + fc.n.z * L.z);
        const sh = .7 + .5 * ndl;
        const [r, g2, bl] = b.tone;
        ctx.fillStyle = `rgb(${Math.min(255, r * sh) | 0},${Math.min(255, g2 * sh) | 0},${Math.min(255, bl * sh) | 0})`;
        path(s); ctx.fill();
        ctx.strokeStyle = `rgba(${INK},.78)`; ctx.lineWidth = 1.1; ctx.stroke();

        const decos = (DECO[b.id] && DECO[b.id][fc.k]) || [];
        if (it.g > .98) for (const d of decos) {
          if (d.t === 'glass' && glassA > 0) {
            const q = quad(s, d.u[0], d.u[1], d.v[0], d.v[1]);
            ctx.fillStyle = `rgba(175,198,214,${.8 * glassA})`; path(q); ctx.fill();
            ctx.fillStyle = `rgba(254,150,70,${.55 * glow})`; path(q); ctx.fill();
            ctx.strokeStyle = `rgba(${INK},${.8 * glassA})`; ctx.lineWidth = 1; path(q); ctx.stroke();
            (d.mull || []).forEach(m => {
              const a = lerpPt(s, lerp(d.u[0], d.u[1], m), d.v[0]), c2 = lerpPt(s, lerp(d.u[0], d.u[1], m), d.v[1]);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
            });
          } else if (d.t === 'door') {
            const q = quad(s, d.u[0], d.u[1], d.v[0], d.v[1]);
            ctx.fillStyle = 'rgba(30,33,39,.9)'; path(q); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
            for (let k = 1; k < 7; k++) {
              const a = lerpPt(s, d.u[0], lerp(d.v[0], d.v[1], k / 7)), c2 = lerpPt(s, d.u[1], lerp(d.v[0], d.v[1], k / 7));
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
            }
          } else if (d.t === 'slats') {
            ctx.strokeStyle = 'rgba(90,52,28,.55)'; ctx.lineWidth = 1;
            for (let k = 1; k < 14; k++) {
              const a = lerpPt(s, k / 14, 0), c2 = lerpPt(s, k / 14, 1);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
            }
          }
        }
      }

      /* ---- Líneas de luz LED (naranja) en bordes clave ---- */
      if (glow > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(254,109,29,${glow})`; ctx.lineWidth = 2.2; ctx.shadowColor = 'rgba(254,109,29,.9)'; ctx.shadowBlur = 14;
        const led = (a, b) => { const p1 = scr(a), p2 = scr(b); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); };
        led(V(-3.5, 6.1, 3.1), V(5.1, 6.1, 3.1));
        led(V(-6, .3, 4), V(6, .3, 4));
        led(V(-4.4, 3.3, 2.2), V(-3, 3.3, 2.2));
        ctx.restore();
      }

      /* ---- Estructura de alambre (el "proyecto"): se ve a través de la obra ---- */
      ctx.lineWidth = 1;
      for (const b of BOXES) {
        const sp = easeOut(range(P, b.solid[0], b.solid[1]));
        const a = easeOut(range(P, b.wire[0], b.wire[1])) * (1 - .8 * sp);
        if (a <= .01) continue;
        const [x0, x1] = b.x, [z0, z1] = b.z, y0 = b.y, y1 = b.y + b.h;
        const c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)].map(scr);
        ctx.strokeStyle = `rgba(${INK},${.62 * a})`;
        ctx.beginPath();
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => { ctx.moveTo(c[i].x, c[i].y); ctx.lineTo(c[j].x, c[j].y); });
        ctx.stroke();
      }

      /* ---- Cotas (medidas) en naranja ---- */
      const dimA = easeOut(range(P, .26, .38)) * (1 - range(P, .6, .78));
      if (dimA > .01) {
        ctx.strokeStyle = `rgba(240,86,10,${dimA})`; ctx.lineWidth = 1.4;
        const dim = (a, b, tick) => {
          const p1 = scr(a), p2 = scr(b);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
          [a, b].forEach(q => { const k1 = scr(V(q.x - tick.x, q.y - tick.y, q.z - tick.z)), k2 = scr(V(q.x + tick.x, q.y + tick.y, q.z + tick.z)); ctx.beginPath(); ctx.moveTo(k1.x, k1.y); ctx.lineTo(k2.x, k2.y); ctx.stroke(); });
        };
        dim(V(-6, 0, 5.1), V(6, 0, 5.1), V(0, 0, .35));
        dim(V(6.7, 0, -4), V(6.7, 0, 4), V(.35, 0, 0));
        dim(V(-6.9, 0, 4.2), V(-6.9, 6.4, 4.2), V(.35, 0, 0));
      }
    }

    return { draw, resize, get ready() { return W > 1 && H > 1; } };
  }

  function initProcess() {
    const section = $('#proceso');
    const canvas = $('#buildCanvas');
    if (!section || !canvas) return;
    const build = createBuild(canvas);
    const steps = $$('.step', section);
    const cta = $('#processCta');
    const vis = watch(section, 10);
    let shown = 0, active = -1;

    const setStep = p => {
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (idx !== active) {
        active = idx;
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      }
      section.style.setProperty('--pp', p.toFixed(4));
      cta.classList.toggle('is-on', p > .88);
    };

    build.resize(); onResize(() => { build.resize(); if (reduced) build.draw(1, 0); });
    if (reduced) { build.draw(1, 0); setStep(1); steps.forEach(s => s.classList.add('is-active')); return; }

    onFrame(now => {
      if (!vis.on) return;
      const r = section.getBoundingClientRect();
      const raw = clamp(-r.top / (r.height - view.h));
      shown = lerp(shown, raw, .085);
      if (Math.abs(shown - raw) < .0004) shown = raw;
      setStep(shown);
      build.draw(shown, now);
    });
  }


  /* ========================================================================
     9. INTERACCIONES: WhatsApp, tilt, botones magnéticos, lightbox, FAQ, formulario
     ======================================================================== */

  // Enlaces de WhatsApp, teléfono, correo, redes y año (todo sale de CONFIG)
  const waLink = msg => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

  function initConfig() {
    $$('[data-wa]').forEach(a => {
      if (!a.dataset.wa) return;
      a.href = waLink(a.dataset.wa);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
    });
    $$('[data-phone]').forEach(el => { el.textContent = CONFIG.whatsappLabel; });
    if (CONFIG.email) {
      $$('[data-email-row]').forEach(r => { r.hidden = false; });
      $$('[data-email]').forEach(a => { a.href = `mailto:${CONFIG.email}`; a.textContent = CONFIG.email; });
    }
    $$('[data-social]').forEach(a => {
      const url = CONFIG.social[a.dataset.social];
      if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.hidden = false; }
    });
    $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
  }

  // Inclinación 3D + foco de luz que sigue al cursor en las tarjetas del bento
  function initTilt() {
    if (!canHover || reduced) return;
    $$('[data-tilt]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        el.style.setProperty('--ry', `${((px - .5) * 7).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-(py - .5) * 7).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  // Botones que se acercan suavemente al cursor
  function initMagnetic() {
    if (!canHover || reduced) return;
    $$('[data-magnetic]').forEach(el => {
      el.style.transition = 'color .35s var(--ease-out), transform .45s var(--ease-out), translate .5s var(--ease-out)';
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * .18).toFixed(1)}px ${(dy * .28).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
    });
  }

  // Lightbox de proyectos
  function initLightbox() {
    const box = $('#lightbox');
    if (!box) return;
    const img = $('#lbImg'), title = $('#lbTitle'), text = $('#lbText'), cta = $('#lbCta'), close = $('#lbClose');
    let opener = null;

    function open(card, trigger) {
      const src = $('img', card);
      img.src = src.currentSrc || src.src; img.alt = src.alt;
      title.textContent = $('h3', card).textContent;
      text.textContent = $('p', card).textContent;
      const msg = $('[data-wa]', card);
      cta.href = waLink(msg ? msg.dataset.wa : 'Hola Alkimia Estudio, quiero información sobre un proyecto.');
      cta.target = '_blank'; cta.rel = 'noopener noreferrer';
      opener = trigger;
      box.inert = false; box.setAttribute('aria-hidden', 'false');
      box.classList.add('is-open');
      document.body.classList.add('is-locked');
      setTimeout(() => close.focus({ preventScroll: true }), 80);   // espera a que el diálogo sea visible
    }
    function shut() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true'); box.inert = true;
      document.body.classList.remove('is-locked');
      if (opener) opener.focus({ preventScroll: true });
    }
    $$('[data-open]').forEach(btn => btn.addEventListener('click', () => open(btn.closest('[data-card]'), btn)));
    close.addEventListener('click', shut);
    box.addEventListener('click', e => { if (e.target === box) shut(); });
    addEventListener('keydown', e => {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') shut();
      if (e.key === 'Tab') {                       // el foco se queda dentro del diálogo
        const f = [close, cta];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // Preguntas frecuentes (acordeón accesible)
  function initFaq() {
    const items = $$('.qa');
    items.forEach(qa => {
      const btn = $('button', qa);
      btn.addEventListener('click', () => {
        const open = !qa.classList.contains('is-open');
        items.forEach(o => { o.classList.remove('is-open'); $('button', o).setAttribute('aria-expanded', 'false'); });
        if (open) { qa.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
      });
    });
  }

  // Formulario: valida y abre WhatsApp con el mensaje armado
  function initForm() {
    const form = $('#contactForm');
    if (!form) return;
    const status = $('#formStatus');
    const f = { name: $('#f-name'), phone: $('#f-phone'), type: $('#f-type'), loc: $('#f-loc'), msg: $('#f-msg') };
    const err = { name: $('#e-name'), phone: $('#e-phone'), type: $('#e-type') };

    const rules = {
      name:  v => (v.trim().length >= 2 ? '' : 'Escribe tu nombre para saber cómo llamarte.'),
      phone: v => (v.replace(/\D/g, '').length >= 8 ? '' : 'Escribe un número válido para poder responderte.'),
      type:  v => (v ? '' : 'Elige qué quieres desarrollar.')
    };
    function check(key) {
      const msg = rules[key](f[key].value);
      err[key].textContent = msg;
      f[key].closest('.field').classList.toggle('has-error', !!msg);
      f[key].setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }
    Object.keys(rules).forEach(k => {
      f[k].addEventListener('blur', () => check(k));
      f[k].addEventListener('input', () => { if (f[k].closest('.field').classList.contains('has-error')) check(k); });
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = Object.keys(rules).map(check).every(Boolean);
      if (!ok) { const bad = Object.keys(rules).find(k => !check(k)); f[bad].focus(); return; }
      const parts = [`Hola Alkimia Estudio, soy ${f.name.value.trim()}.`, `Quiero desarrollar: ${f.type.value}.`];
      if (f.loc.value.trim()) parts.push(`Ubicación: ${f.loc.value.trim()}.`);
      if (f.msg.value.trim()) parts.push(`Mi idea: ${f.msg.value.trim()}`);
      parts.push(`Mi contacto: ${f.phone.value.trim()}.`);
      const url = waLink(parts.join(' '));
      const w = window.open(url, '_blank', 'noopener');
      form.classList.add('is-sent');
      status.innerHTML = '';
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Abrir WhatsApp';
      a.style.textDecoration = 'underline';
      status.append(w ? 'Listo, abrimos WhatsApp con tu mensaje. ¿No se abrió? ' : 'Tu mensaje está listo. ', a);
    });
  }

  // Aviso del botón flotante de WhatsApp
  function initWhatsApp() {
    const wa = $('#wa');
    const close = $('#waTipClose');
    if (!wa) return;
    let seen = false;
    try { seen = sessionStorage.getItem('akimia-wa-tip') === '1'; } catch (e) { /* almacenamiento no disponible */ }
    const hide = () => { wa.classList.remove('is-tip'); try { sessionStorage.setItem('akimia-wa-tip', '1'); } catch (e) { /* noop */ } };
    close.addEventListener('click', hide);
    // En la sección de contacto el formulario ya es el camino a WhatsApp: ocultamos el flotante para no tapar el botón
    const contact = $('#contacto');
    if (contact) new IntersectionObserver(([e]) => wa.classList.toggle('is-away', e.isIntersecting), { rootMargin: '0px 0px -12% 0px' }).observe($('#contactForm') || contact);
    if (seen) return;
    setTimeout(() => wa.classList.add('is-tip'), 7500);
    setTimeout(hide, 17000);
  }

  /* ========================================================================
     10. ARRANQUE
     ======================================================================== */
  function boot() {
    initConfig();
    initLoader();
    initHeader();
    initReveals();
    initCounters();
    initManifesto();
    initHero();
    initReveal();
    initStack();
    initProcess();
    initWork();
    initMarquee();
    initParallax();
    initFooterWord();
    initTilt();
    initMagnetic();
    initLightbox();
    initFaq();
    initForm();
    initWhatsApp();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
