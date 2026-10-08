/**
 * finalReveal.js — Phase 8
 * Lights-on transition + romantic bouquet reveal.
 *
 * Entry point: FinalRevealScene.beginReveal()
 *   Called by cat.js after the kiss flash is held white.
 *
 * Sequence:
 *   1. Flash fades from white → warm bright bg (scene-reveal fades in)
 *   2. Bouquet flowers grow in one by one via GSAP + canvas rAF
 *   3. Console log signals Phase 9 ready
 *
 * Bouquet rendering:
 *   Each flower is a plain JS object drawn each frame on #bouquet-canvas.
 *   GSAP animates flower.bloomT (0→1) per flower with staggered delays.
 *   drawFlower() reads bloomT to scale and fade each bloom into place.
 *   Five flower types: rose, peony, ranunculus, tulip, small blossom
 *   plus simple leaf/stem shapes for greenery.
 */

const FinalRevealScene = (() => {

  let canvas  = null;
  let ctx     = null;
  let dpr     = 1;
  let W       = 0;
  let H       = 0;
  let rafId   = null;
  let running = false;

  // Flower objects — built in buildBouquet(), animated by GSAP
  let flowers = [];

  // ── Public: called once on boot ───────────────────────────────
  function init() {
    SceneController.register('scene-reveal', onEnter);
  }

  // ── SceneController onEnter ────────────────────────────────────
  function onEnter() {
    // Scene is already fading in from beginReveal() — canvas setup happens there
  }

  // ── Entry point from cat.js kiss flash ────────────────────────
  function beginReveal() {
    const flashEl = document.getElementById('kiss-flash');

    // Set up canvas now (scene-reveal wasn't active before)
    canvas = document.getElementById('bouquet-canvas');
    ctx    = canvas.getContext('2d');
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // Message text is filled in now so its height is known when the
    // bouquet is laid out (bouquet is built in startBouquetBloom).
    populateMessage();

    // 0. Flash is fully white here, so tear down the candle layer unseen.
    //    These overlays live OUTSIDE #scene-container (z:25/30/35) and would
    //    otherwise sit on top of scene-reveal (z:10) after the transition.
    if (typeof CandleScene.stopFlame === 'function') CandleScene.stopFlame();
    gsap.set(['#blackout', '#candle-canvas', '#lyrics-overlay'], { opacity: 0 });

    // 1. Transition into scene-reveal while flash is still white
    SceneController.go('scene-reveal');

    // 2. Fade the white flash out only AFTER the scene swap (~1.0s: 0.5 out + 0.5 in),
    //    otherwise the black scene-candle background shows through mid-fade.
    gsap.to(flashEl, {
      opacity: 0,
      duration: 1.4,
      ease: 'power1.out',
      delay: 1.1,
    });

    // 3. Fanfare starts just before the bouquet blooms
    gsap.delayedCall(1.3, playBouquetFanfare);

    // 4. Bouquet bloom starts shortly after fanfare intro
    gsap.delayedCall(1.6, startBouquetBloom);
  }

  // ── Canvas setup ──────────────────────────────────────────────
  function setupCanvas() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W   = window.innerWidth;
    H   = window.innerHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Build bouquet flower definitions ──────────────────────────
  // All positions are relative to the bouquet center point.
  // The bouquet occupies a wide horizontal band in the middle of screen.
  function buildBouquet() {
    flowers = [];

    const bCX = W * 0.50;   // bouquet center X

    // ── Vertical slot: between the photo frame's bottom edge and the
    //    birthday message's top edge (measured from the real DOM). ──
    const frameEl = document.getElementById('photo-frame');
    const msgEl   = document.getElementById('birthday-message');
    const frameBottom = frameEl.getBoundingClientRect().bottom + 10; // + outline
    const msgTop      = msgEl.getBoundingClientRect().top;
    const slotTop     = frameBottom;
    const slotBottom  = Math.max(msgTop, slotTop + H * 0.12);
    const slotH       = slotBottom - slotTop;

    // Un-scaled bouquet spans roughly 0.26*H vertically around bCY0
    const BOUQUET_H = H * 0.26;
    const k = Math.max(0.55, Math.min(1, (slotH * 0.96) / BOUQUET_H));
    const bCY0 = H * 0.46;                         // layout origin used below
    const bCY  = slotTop + slotH / 2 + H * 0.01;   // where it is finally placed

    // Colour palette
    const PINK     = '#e8849a';
    const BLUSH    = '#f5c0ce';
    const DEEP     = '#c8506a';
    const CREAM    = '#faf0e0';
    const WHITE    = '#fff8f8';
    const LAVENDER = '#d8c0d8';
    const PEACH    = '#f5c8a8';

    // Greenery first (drawn underneath)
    const leaves = [
      { x: bCX - W*0.18, y: bCY0 + H*0.03, angle: -0.55, len: H*0.09, w: H*0.022, color: '#7a9c5a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.12, y: bCY0 + H*0.04, angle:  0.45, len: H*0.08, w: H*0.020, color: '#8aac6a', type: 'leaf', bloomT: 0 },
      { x: bCX - W*0.06, y: bCY0 + H*0.05, angle: -0.15, len: H*0.10, w: H*0.018, color: '#6a8c4a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.22, y: bCY0 - H*0.01, angle:  0.65, len: H*0.07, w: H*0.016, color: '#7a9c5a', type: 'leaf', bloomT: 0 },
      { x: bCX - W*0.25, y: bCY0 - H*0.02, angle: -0.72, len: H*0.08, w: H*0.018, color: '#5a7a3a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.04, y: bCY0 + H*0.06, angle:  0.25, len: H*0.09, w: H*0.017, color: '#8aac6a', type: 'leaf', bloomT: 0 },
    ];

    // Main flowers — varied types, sizes, positions, rotations
    const blooms = [
      // Large centrepiece roses
      { x: bCX,          y: bCY0 - H*0.01, size: W*0.115, rot: 0.08,  color: DEEP,    type: 'rose',        bloomT: 0 },
      { x: bCX - W*0.12, y: bCY0 + H*0.00, size: W*0.100, rot: -0.22, color: PINK,    type: 'peony',       bloomT: 0 },
      { x: bCX + W*0.13, y: bCY0 - H*0.02, size: W*0.095, rot:  0.18, color: BLUSH,   type: 'rose',        bloomT: 0 },

      // Secondary ring
      { x: bCX - W*0.24, y: bCY0 + H*0.01, size: W*0.082, rot: -0.35, color: PINK,    type: 'ranunculus',  bloomT: 0 },
      { x: bCX + W*0.24, y: bCY0 - H*0.01, size: W*0.078, rot:  0.30, color: BLUSH,   type: 'peony',       bloomT: 0 },
      { x: bCX - W*0.05, y: bCY0 - H*0.08, size: W*0.075, rot: -0.12, color: CREAM,   type: 'rose',        bloomT: 0 },
      { x: bCX + W*0.07, y: bCY0 + H*0.05, size: W*0.072, rot:  0.42, color: DEEP,    type: 'ranunculus',  bloomT: 0 },

      // Accent flowers
      { x: bCX - W*0.18, y: bCY0 - H*0.06, size: W*0.060, rot:  0.55, color: WHITE,   type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.19, y: bCY0 + H*0.04, size: W*0.058, rot: -0.48, color: LAVENDER,type: 'blossom',     bloomT: 0 },
      { x: bCX - W*0.30, y: bCY0 - H*0.04, size: W*0.055, rot:  0.65, color: PEACH,   type: 'tulip',       bloomT: 0 },
      { x: bCX + W*0.30, y: bCY0 + H*0.00, size: W*0.058, rot: -0.28, color: CREAM,   type: 'tulip',       bloomT: 0 },
      { x: bCX + W*0.01, y: bCY0 + H*0.07, size: W*0.050, rot:  0.15, color: WHITE,   type: 'blossom',     bloomT: 0 },

      // Small filler blossoms
      { x: bCX - W*0.09, y: bCY0 + H*0.06, size: W*0.040, rot: -0.70, color: PINK,    type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.09, y: bCY0 - H*0.09, size: W*0.038, rot:  0.80, color: BLUSH,   type: 'blossom',     bloomT: 0 },
      { x: bCX - W*0.33, y: bCY0 + H*0.03, size: W*0.036, rot: -0.20, color: WHITE,   type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.33, y: bCY0 - H*0.05, size: W*0.038, rot:  0.55, color: CREAM,   type: 'blossom',     bloomT: 0 },
    ];

    flowers = [...leaves, ...blooms];

    // Scale the whole bouquet to fit its slot and move it below the frame
    for (const f of flowers) {
      f.x = bCX + (f.x - bCX) * k;
      f.y = bCY + (f.y - bCY0) * k;
      if (f.size) f.size *= k;
      if (f.len)  { f.len *= k; f.w *= k; }
    }
  }

  // ── Start the staggered GSAP bloom sequence ────────────────────
  function startBouquetBloom() {
    // Layout is measured here: image has loaded and message text is in place.
    buildBouquet();
    startLoop();

    // Leaves come up first — quick
    flowers.forEach((f, i) => {
      if (f.type !== 'leaf') return;
      gsap.to(f, {
        bloomT: 1,
        duration: 0.55,
        delay: i * 0.07,
        ease: 'power2.out',
      });
    });

    // Blooms stagger in — large centrepieces first, then secondary, then accents
    const bloomOrder = flowers.filter(f => f.type !== 'leaf');
    bloomOrder.forEach((f, i) => {
      // Size-based priority: larger flowers earlier
      const priority = (f.size / (W * 0.12));  // 0..1
      const baseDelay = 0.3 + i * 0.11 - priority * 0.08;
      gsap.to(f, {
        bloomT: 1,
        duration: 0.70 + priority * 0.25,
        delay: Math.max(0.2, baseDelay),
        ease: 'back.out(1.4)',
      });
    });

    // Signal Phase 9 after last flower is fully open
    const totalTime = 0.3 + bloomOrder.length * 0.11 + 0.95;
    gsap.delayedCall(totalTime, onBouquetComplete);
  }

  // ── rAF loop ──────────────────────────────────────────────────
  function startLoop() {
    if (running) return;
    running = true;
    rafId   = requestAnimationFrame(tick);
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    drawBouquet();
    rafId = requestAnimationFrame(tick);
  }

  // ── Draw all flowers ──────────────────────────────────────────
  function drawBouquet() {
    for (const f of flowers) {
      if (f.bloomT <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(f.bloomT, 1);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot || 0);
      ctx.scale(f.bloomT, f.bloomT);

      if (f.type === 'leaf') {
        drawLeaf(f);
      } else {
        switch (f.type) {
          case 'rose':       drawRose(f);       break;
          case 'peony':      drawPeony(f);      break;
          case 'ranunculus': drawRanunculus(f); break;
          case 'tulip':      drawTulip(f);      break;
          case 'blossom':    drawBlossom(f);    break;
        }
      }
      ctx.restore();
    }
  }

  // ── Leaf ──────────────────────────────────────────────────────
  function drawLeaf(f) {
    const l = f.len, w = f.w;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -l * 0.35, -w * 0.6, -l * 0.75, 0, -l);
    ctx.bezierCurveTo(  w * 0.6, -l * 0.75,  w, -l * 0.35, 0, 0);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, 0, 0, -l);
    g.addColorStop(0,   lighten(f.color, 0.15));
    g.addColorStop(0.5, f.color);
    g.addColorStop(1,   darken(f.color, 0.12));
    ctx.fillStyle = g;
    ctx.fill();

    // Midrib
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -l * 0.85);
    ctx.strokeStyle = darken(f.color, 0.18);
    ctx.lineWidth   = w * 0.18;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // ── Rose ──────────────────────────────────────────────────────
  function drawRose(f) {
    const s = f.size;
    const inner = lighten(f.color, 0.20);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo( s*0.55, -s*0.10,  s*0.72,  s*0.58, 0,  s*0.92);
      ctx.bezierCurveTo(-s*0.72,  s*0.58, -s*0.55, -s*0.10, 0,  0);
      const gp = ctx.createLinearGradient(0, 0, 0, s);
      gp.addColorStop(0, lighten(f.color, 0.10));
      gp.addColorStop(1, darken(f.color, 0.08));
      ctx.fillStyle = gp;
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.38;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo( s*0.32, -s*0.06,  s*0.44, s*0.38, 0, s*0.56);
      ctx.bezierCurveTo(-s*0.44,  s*0.38, -s*0.32, -s*0.06, 0, 0);
      ctx.fillStyle = inner;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = lighten(f.color, 0.35);
    ctx.fill();
  }

  // ── Peony ─────────────────────────────────────────────────────
  function drawPeony(f) {
    const s = f.size;
    for (let layer = 0; layer < 3; layer++) {
      const ls   = 1 - layer * 0.22;
      const loff = layer * 0.15;
      const cnt  = 8 - layer;
      const col  = layer === 0 ? f.color
                 : layer === 1 ? lighten(f.color, 0.10)
                 : lighten(f.color, 0.22);
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + loff;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.44 * ls, s * 0.27 * ls, s * 0.44 * ls, 0, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha *= 0.88;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = lighten(f.color, 0.38);
    ctx.fill();
  }

  // ── Ranunculus ────────────────────────────────────────────────
  function drawRanunculus(f) {
    const s = f.size;
    const rings = [
      { cnt: 10, r: 0.84, w: 0.22, h: 0.36, col: f.color },
      { cnt:  8, r: 0.60, w: 0.20, h: 0.30, col: lighten(f.color, 0.10) },
      { cnt:  6, r: 0.38, w: 0.17, h: 0.25, col: lighten(f.color, 0.18) },
      { cnt:  4, r: 0.20, w: 0.13, h: 0.18, col: lighten(f.color, 0.28) },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.cnt; i++) {
        const a = (i / ring.cnt) * Math.PI * 2;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -s * ring.r, s * ring.w, s * ring.h, 0, 0, Math.PI * 2);
        ctx.fillStyle = ring.col;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = lighten(f.color, 0.42);
    ctx.fill();
  }

  // ── Tulip ─────────────────────────────────────────────────────
  function drawTulip(f) {
    const s = f.size;
    const hi = lighten(f.color, 0.22);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo( s*0.40, -s*0.15,  s*0.50,  s*0.55, 0,  s*0.90);
      ctx.bezierCurveTo(-s*0.50,  s*0.55, -s*0.40, -s*0.15, 0,  0);
      ctx.fillStyle = i % 2 === 0 ? f.color : hi;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, s * 0.15, s * 0.28, 0, Math.PI);
    ctx.fillStyle = darken(f.color, 0.12);
    ctx.fill();
  }

  // ── Blossom ───────────────────────────────────────────────────
  function drawBlossom(f) {
    const s = f.size;
    for (let i = 0; i < 5; i++) {
      const a  = (i / 5) * Math.PI * 2 - Math.PI * 0.5;
      const px = Math.cos(a) * s * 0.38;
      const py = Math.sin(a) * s * 0.38;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.27, s * 0.37, 0, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.11, Math.sin(a) * s * 0.11, s * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe890';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = lighten(f.color, 0.18);
    ctx.fill();
  }

  // ── Color helpers ─────────────────────────────────────────────
  function hexToRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function toHex(r, g, b) {
    return '#' + [r,g,b].map(v => Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  function lighten(hex, a) {
    const [r,g,b] = hexToRgb(hex);
    return toHex(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a);
  }
  function darken(hex, a) {
    const [r,g,b] = hexToRgb(hex);
    return toHex(r*(1-a), g*(1-a), b*(1-a));
  }

  // ── Slideshow state ───────────────────────────────────────────
  let slideIndex  = 0;
  let slideTimer  = null;
  let slideReady  = false;
  let slideBusy   = false;   // prevent overlapping transitions

  // ── Preload all photos ────────────────────────────────────────
  function preloadPhotos() {
    const paths = CONFIG.girlfriend.photos || [CONFIG.girlfriend.photo];
    paths.forEach(src => { const i = new Image(); i.src = src; });
  }

  // ── Bouquet complete → frame reveal + slideshow ───────────────
  function onBouquetComplete() {
    preloadPhotos();

    // Build the two-layer slide stack inside #photo-frame-inner
    // Layer A (back) and Layer B (front) swap roles on each transition
    const inner = document.getElementById('photo-frame-inner');
    const glow  = document.getElementById('photo-glow');
    const wrap  = document.getElementById('photo-frame-wrap');

    // ── Make the frame bigger ─────────────────────────────────────
    // Increase width/height by ~30% so the photo is more prominent.
    // We read the CSS size first so this scales relative to whatever
    // the stylesheet specifies, then clamp to sensible screen limits.
    const frameEl2   = document.getElementById('photo-frame');
    const currentW   = frameEl2.offsetWidth;
    const currentH   = frameEl2.offsetHeight;
    const SCALE      = 1.15;   // ← 15% bigger — noticeable but stays on screen
    const maxW       = Math.min(W * 0.60, currentW * SCALE);
    const maxH       = Math.min(H * 0.42, currentH * SCALE);
    const newW       = Math.min(currentW * SCALE, maxW);
    const newH       = Math.min(currentH * SCALE, maxH);
    frameEl2.style.width  = newW + 'px';
    frameEl2.style.height = newH + 'px';

    // Clip images strictly inside the photo area of the polaroid.
    // The polaroid has a white bottom strip (~22% of height) so the
    // photo slot is the top ~78%. overflow:hidden on the inner wrapper
    // ensures nothing bleeds outside the frame border.
    inner.style.overflow    = 'hidden';
    inner.style.borderRadius = '4px';   // match frame corner rounding

    // Photo slot = top 78% of inner (leaves white strip visible below)
    const PHOTO_AREA = '100%';

    // Replace the single <img> with two stacked layers
    inner.innerHTML = `
      <div id="photo-slot" style="position:absolute;top:0;left:0;width:100%;height:${PHOTO_AREA};overflow:hidden;">
        <img id="slide-a" style="position:absolute;inset:0;width:100%;height:100%;
          object-fit:cover;object-position:center top;opacity:0;transform-origin:center;"/>
        <img id="slide-b" style="position:absolute;inset:0;width:100%;height:100%;
          object-fit:cover;object-position:center top;opacity:0;transform-origin:center;"/>
      </div>
      <div id="photo-glow" style="position:absolute;inset:0;pointer-events:none;z-index:3;
        background:radial-gradient(ellipse 80% 70% at 50% 30%,
          rgba(255,235,200,0.38) 0%, rgba(255,210,170,0.18) 45%, rgba(0,0,0,0) 100%);
        opacity:0;"></div>
    `;

    const photos  = CONFIG.girlfriend.photos || [CONFIG.girlfriend.photo];
    const glowEl  = document.getElementById('photo-glow');
    const slot    = document.getElementById('photo-slot');
    const slideA  = document.getElementById('slide-a');
    const slideB  = document.getElementById('slide-b');

    // Load first photo into layer A
    slideA.src = photos[0];
    slideA.style.zIndex = '1';
    slideB.style.zIndex = '0';

    const tl = gsap.timeline({ onComplete: onPhotoComplete });

    // 1. Frame enters
    tl.fromTo(wrap, { opacity: 0, y: 28, rotation: 5.5 }, {
      opacity: 1, y: 0, rotation: 2.2, duration: 1.0, ease: 'power3.out',
    })
    .to(wrap, { rotation: 2.2, duration: 0.6, ease: 'elastic.out(1,0.5)' })

    // 2. First photo reveals at natural size
    .fromTo(slideA, { opacity: 0, scale: 1.06 }, {
      opacity: 1, scale: 1.0, duration: 1.1, ease: 'power2.out',
    }, '-=0.2')

    // 3. Glow blooms in
    .to(glowEl, { opacity: 1, duration: 0.8, ease: 'power1.out' }, '-=0.7')

    // 4. Ken Burns slow drift
    .call(() => {
      gsap.to(slideA, { scale: 1.06, duration: 4, ease: 'none' });
      slideReady = true;
      startSlideshow();
    });
  }

  // ── Slideshow timer + tap ─────────────────────────────────────
  function startSlideshow() {
    const photos   = CONFIG.girlfriend.photos || [CONFIG.girlfriend.photo];
    const interval = (CONFIG.girlfriend.photoInterval || 4) * 1000;
    if (photos.length <= 1) return;

    slideTimer = setInterval(() => advanceSlide(), interval);

    const wrap = document.getElementById('photo-frame-wrap');
    wrap.style.cursor = 'pointer';
    wrap.addEventListener('click', () => {
      if (slideBusy) return;
      clearInterval(slideTimer);
      advanceSlide();
      slideTimer = setInterval(() => advanceSlide(), interval);
    });
  }

  function advanceSlide() {
    if (!slideReady || slideBusy) return;
    const photos = CONFIG.girlfriend.photos || [CONFIG.girlfriend.photo];
    slideIndex = (slideIndex + 1) % photos.length;
    cinematicTransition(photos[slideIndex]);
  }

  // ── Cinematic transition: scale-push crossfade ────────────────
  // Outgoing: zooms in slightly + fades out (departing feel)
  // Incoming: starts small, scales to normal + fades in (arrival feel)
  // Glow pulses warm on each change
  function cinematicTransition(nextSrc) {
    slideBusy = true;

    const slideA = document.getElementById('slide-a');
    const slideB = document.getElementById('slide-b');
    const glowEl = document.getElementById('photo-glow');

    // Determine which layer is front (visible) and which is back
    const frontEl = parseFloat(slideA.style.zIndex) > parseFloat(slideB.style.zIndex)
      ? slideA : slideB;
    const backEl  = frontEl === slideA ? slideB : slideA;

    backEl.src     = nextSrc;
    backEl.style.opacity   = '0';
    backEl.style.transform = 'scale(1.10)';
    backEl.style.zIndex    = '2';
    frontEl.style.zIndex   = '1';

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(frontEl, { opacity: 0, scale: 1.0 });
        slideBusy = false;
      }
    });

    tl.to(frontEl, { opacity: 0, scale: 1.08, duration: 0.9, ease: 'power2.in' })
      .fromTo(backEl, { opacity: 0, scale: 1.10 }, {
        opacity: 1, scale: 1.0, duration: 0.85, ease: 'power2.out',
      }, '-=0.55')
      .to(glowEl, { opacity: 0.5, duration: 0.25, ease: 'power1.out' }, '-=0.85')
      .to(glowEl, { opacity: 1.0, duration: 0.65, ease: 'power1.in'  }, '-=0.60')
      .call(() => {
        gsap.killTweensOf(backEl, 'scale');
        gsap.fromTo(backEl, { scale: 1.0 }, { scale: 1.06, duration: 4, ease: 'none' });
      });
  }

  // ── Fill name + message lines from CONFIG (single source of truth) ──
  function populateMessage() {
    document.getElementById('msg-name').textContent = CONFIG.girlfriend.name;

    const linesEl = document.getElementById('msg-lines');
    linesEl.innerHTML = '';
    CONFIG.message.forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      linesEl.appendChild(p);
    });
  }

  // ── Photo fully revealed → sequential message reveal ──────────
  function onPhotoComplete() {

    const heading  = document.getElementById('msg-heading');
    const name     = document.getElementById('msg-name');
    const divider  = document.getElementById('msg-divider');
    const lines    = document.getElementById('msg-lines');

    // Sequential reveal — each element fades up in turn
    const tl = gsap.timeline({ onComplete: onMessageComplete });

    tl
      // 1. HAPPY BIRTHDAY!
      .fromTo(heading, { opacity: 0, y: 12 }, {
        opacity: 1, y: 0,
        duration: 0.9,
        ease: 'power2.out',
        delay: 0.4,
      })

      // 2. Her name
      .fromTo(name, { opacity: 0, y: 8 }, {
        opacity: 1, y: 0,
        duration: 0.7,
        ease: 'power2.out',
      }, '-=0.1')

      // 3. Divider line
      .fromTo(divider, { opacity: 0, scaleX: 0 }, {
        opacity: 1, scaleX: 1,
        duration: 0.55,
        ease: 'power1.out',
      }, '-=0.1')

      // 4. Personal message lines
      .fromTo(lines, { opacity: 0, y: 6 }, {
        opacity: 1, y: 0,
        duration: 0.8,
        ease: 'power1.out',
      }, '-=0.0');
  }

  // ── Everything revealed → show replay button + start idle music ─
  function onMessageComplete() {
    const btn = document.getElementById('replay-btn');
    if (btn) {
      btn.style.pointerEvents = 'auto';
      gsap.fromTo(btn,
        { opacity: 0, scale: 0.72, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.65, ease: 'back.out(2.2)', delay: 1.2 }
      );
    }
    playIdleMusic();
  }

  // ── Idle ambient music for the final reveal scene ─────────────
  // Soft romantic loop: gentle harp-like arpeggio + warm pad + shimmer
  // Loops every ~8s using scheduled oscillators so it never cuts out.
  let idleLoopTimer = null;

  function playIdleMusic() {
    try {
      const Ctx = window._audioContext ||
        (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      if (!Ctx) return;
      if (Ctx.state === 'suspended') Ctx.resume();

      // Master gain — very soft, won't compete with anything
      const master = Ctx.createGain();
      master.gain.value = 0.14;
      master.connect(Ctx.destination);

      const LOOP = 8.0;  // loop period in seconds

      function scheduleLoop(startAt) {
        const t = startAt;

        // ── Harp arpeggio — C maj pentatonic C4 G4 E4 A4 C5 G5 ──
        const HARP = [261.63, 392.00, 329.63, 440.00, 523.25, 783.99];
        HARP.forEach((freq, i) => {
          const d = i * 0.28;
          ['sine','triangle'].forEach((type, j) => {
            const osc = Ctx.createOscillator();
            const env = Ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            const vol = j === 0 ? 0.45 : 0.16;
            env.gain.setValueAtTime(0, t + d);
            env.gain.linearRampToValueAtTime(vol, t + d + 0.03);
            env.gain.exponentialRampToValueAtTime(0.001, t + d + 2.2);
            osc.connect(env); env.connect(master);
            osc.start(t + d); osc.stop(t + d + 2.3);
          });
        });

        // ── Second harp wave at 4s ────────────────────────────────
        const HARP2 = [392.00, 523.25, 659.25, 523.25, 440.00, 329.63];
        HARP2.forEach((freq, i) => {
          const d = 4.0 + i * 0.24;
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          env.gain.setValueAtTime(0, t + d);
          env.gain.linearRampToValueAtTime(0.30, t + d + 0.03);
          env.gain.exponentialRampToValueAtTime(0.001, t + d + 2.0);
          osc.connect(env); env.connect(master);
          osc.start(t + d); osc.stop(t + d + 2.1);
        });

        // ── Warm pad — sustained C maj chord ─────────────────────
        [130.81, 196.00, 261.63, 329.63].forEach(freq => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.12, t + 0.8);
          env.gain.setValueAtTime(0.12, t + LOOP - 1.2);
          env.gain.linearRampToValueAtTime(0, t + LOOP);
          osc.connect(env); env.connect(master);
          osc.start(t); osc.stop(t + LOOP + 0.1);
        });

        // ── Sparkle shimmer at 2s and 6s ─────────────────────────
        [2.0, 6.0].forEach(offset => {
          [1046.50, 1318.51, 1567.98].forEach((freq, i) => {
            const d = offset + i * 0.18;
            const osc = Ctx.createOscillator();
            const env = Ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            env.gain.setValueAtTime(0, t + d);
            env.gain.linearRampToValueAtTime(0.05, t + d + 0.02);
            env.gain.exponentialRampToValueAtTime(0.001, t + d + 1.0);
            osc.connect(env); env.connect(master);
            osc.start(t + d); osc.stop(t + d + 1.1);
          });
        });

        // Schedule next loop LOOP - 0.1s before this one ends (overlap for seamless join)
        idleLoopTimer = setTimeout(() => {
          scheduleLoop(Ctx.currentTime + 0.05);
        }, (LOOP - 0.15) * 1000);
      }

      // Fade in gently after a 1s pause
      setTimeout(() => scheduleLoop(Ctx.currentTime + 0.05), 1000);

    } catch(e) {
      console.warn('Idle music unavailable:', e.message);
    }
  }

  // ── Bouquet intro fanfare ─────────────────────────────────────
  // Cinematic build: soft shimmer → rising strings → bright bell chord
  // Timed to feel like flowers bursting open (lasts ~5s)
  function playBouquetFanfare() {
    try {
      const Ctx = window._audioContext ||
        (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      if (!Ctx) return;
      if (Ctx.state === 'suspended') Ctx.resume();

      const master = Ctx.createGain();
      master.gain.value = 0.30;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;

      // ── 1. Opening shimmer — airy high tones sweep in ─────────
      [1318.51, 1567.98, 1760.00, 2093.00, 2349.32].forEach((freq, i) => {
        const d = i * 0.12;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + d);
        env.gain.linearRampToValueAtTime(0.10, now + d + 0.06);
        env.gain.exponentialRampToValueAtTime(0.001, now + d + 1.4);
        osc.connect(env); env.connect(master);
        osc.start(now + d); osc.stop(now + d + 1.5);
      });

      // ── 2. Rising string swell — triangle waves bloom upward ──
      // C4 → E4 → G4 → B4 → D5 staggered every 0.22s
      [261.63, 329.63, 392.00, 493.88, 587.33].forEach((freq, i) => {
        const d = 0.5 + i * 0.22;
        ['triangle', 'sine'].forEach((type, j) => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          const vol = j === 0 ? 0.40 : 0.18;
          env.gain.setValueAtTime(0, now + d);
          env.gain.linearRampToValueAtTime(vol, now + d + 0.18);
          env.gain.setValueAtTime(vol * 0.85, now + d + 0.6);
          env.gain.exponentialRampToValueAtTime(0.001, now + d + 2.2);
          osc.connect(env); env.connect(master);
          osc.start(now + d); osc.stop(now + d + 2.3);
        });
      });

      // ── 3. Warm pad swell — C maj 7 chord blooms at 1.2s ─────
      [130.81, 164.81, 196.00, 246.94, 261.63].forEach((freq, i) => {
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + 1.2);
        env.gain.linearRampToValueAtTime(0.20, now + 2.0);
        env.gain.setValueAtTime(0.20, now + 3.5);
        env.gain.exponentialRampToValueAtTime(0.001, now + 5.2);
        osc.connect(env); env.connect(master);
        osc.start(now + 1.2); osc.stop(now + 5.3);
      });

      // ── 4. Bright bell chord at the peak (2.2s) ───────────────
      // C5 E5 G5 C6 — all at once, fast attack, long bell decay
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        ['sine', 'triangle'].forEach((type, j) => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          const vol = j === 0 ? 0.50 : 0.20;
          env.gain.setValueAtTime(0, now + 2.2);
          env.gain.linearRampToValueAtTime(vol, now + 2.25);
          env.gain.exponentialRampToValueAtTime(0.001, now + 4.8);
          osc.connect(env); env.connect(master);
          osc.start(now + 2.2); osc.stop(now + 4.9);
        });
      });

      // ── 5. Cascading sparkle fall after the bell ──────────────
      [2093.00, 1760.00, 1567.98, 1318.51, 1046.50].forEach((freq, i) => {
        const d = 2.5 + i * 0.15;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + d);
        env.gain.linearRampToValueAtTime(0.07, now + d + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + d + 1.0);
        osc.connect(env); env.connect(master);
        osc.start(now + d); osc.stop(now + d + 1.1);
      });

    } catch(e) {
      console.warn('Bouquet fanfare unavailable:', e.message);
    }
  }

  // ── Public API ────────────────────────────────────────────────
  return { init, beginReveal };

})();
