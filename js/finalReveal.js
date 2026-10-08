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
    // Initialise the bouquet popup button (injected once, hidden until message reveals)
    if (typeof BouquetPopup !== 'undefined') BouquetPopup.init();
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

    // ── Place bouquet flush below the photo frame ──────────────────
    const frameEl     = document.getElementById('photo-frame');
    const msgEl       = document.getElementById('birthday-message');
    const frameBottom = frameEl.getBoundingClientRect().bottom + 8;

    // Fixed scale — medium size, not driven by slot measurement
    const k    = 0.62;
    const bCY0 = H * 0.46;  // layout origin
    const bCY  = frameBottom + H * 0.075;  // sit close under the frame

    // Force the message up to sit tight below the bouquet using transform
    const bouquetBottom = bCY + H * 0.075;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (msgEl) {
          const msgTop = msgEl.getBoundingClientRect().top;
          const gap = msgTop - bouquetBottom;
          if (gap > 0) {
            msgEl.style.cssText += `transform:translateY(-${gap}px) !important; margin-top:0 !important;`;
          }
        }
      });
    });

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
      { x: bCX - W*0.14, y: bCY0 + H*0.02, angle: -0.55, len: H*0.06, w: H*0.015, color: '#7a9c5a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.10, y: bCY0 + H*0.03, angle:  0.45, len: H*0.055,w: H*0.014, color: '#8aac6a', type: 'leaf', bloomT: 0 },
      { x: bCX - W*0.05, y: bCY0 + H*0.03, angle: -0.15, len: H*0.065,w: H*0.013, color: '#6a8c4a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.18, y: bCY0 - H*0.01, angle:  0.65, len: H*0.050,w: H*0.012, color: '#7a9c5a', type: 'leaf', bloomT: 0 },
      { x: bCX - W*0.20, y: bCY0 - H*0.01, angle: -0.72, len: H*0.055,w: H*0.013, color: '#5a7a3a', type: 'leaf', bloomT: 0 },
      { x: bCX + W*0.03, y: bCY0 + H*0.04, angle:  0.25, len: H*0.060,w: H*0.012, color: '#8aac6a', type: 'leaf', bloomT: 0 },
    ];

    // Main flowers — varied types, sizes, positions, rotations
    const blooms = [
      // Large centrepiece roses
      { x: bCX,          y: bCY0 - H*0.01, size: W*0.082, rot: 0.08,  color: DEEP,    type: 'rose',        bloomT: 0 },
      { x: bCX - W*0.10, y: bCY0 + H*0.00, size: W*0.072, rot: -0.22, color: PINK,    type: 'peony',       bloomT: 0 },
      { x: bCX + W*0.11, y: bCY0 - H*0.01, size: W*0.068, rot:  0.18, color: BLUSH,   type: 'rose',        bloomT: 0 },

      // Secondary ring
      { x: bCX - W*0.20, y: bCY0 + H*0.01, size: W*0.058, rot: -0.35, color: PINK,    type: 'ranunculus',  bloomT: 0 },
      { x: bCX + W*0.20, y: bCY0 - H*0.01, size: W*0.055, rot:  0.30, color: BLUSH,   type: 'peony',       bloomT: 0 },
      { x: bCX - W*0.04, y: bCY0 - H*0.06, size: W*0.052, rot: -0.12, color: CREAM,   type: 'rose',        bloomT: 0 },
      { x: bCX + W*0.06, y: bCY0 + H*0.04, size: W*0.050, rot:  0.42, color: DEEP,    type: 'ranunculus',  bloomT: 0 },

      // Accent flowers
      { x: bCX - W*0.15, y: bCY0 - H*0.04, size: W*0.042, rot:  0.55, color: WHITE,   type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.16, y: bCY0 + H*0.03, size: W*0.040, rot: -0.48, color: LAVENDER,type: 'blossom',     bloomT: 0 },
      { x: bCX - W*0.26, y: bCY0 - H*0.02, size: W*0.038, rot:  0.65, color: PEACH,   type: 'tulip',       bloomT: 0 },
      { x: bCX + W*0.26, y: bCY0 + H*0.00, size: W*0.040, rot: -0.28, color: CREAM,   type: 'tulip',       bloomT: 0 },
      { x: bCX + W*0.01, y: bCY0 + H*0.05, size: W*0.034, rot:  0.15, color: WHITE,   type: 'blossom',     bloomT: 0 },

      // Small filler blossoms
      { x: bCX - W*0.08, y: bCY0 + H*0.04, size: W*0.028, rot: -0.70, color: PINK,    type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.08, y: bCY0 - H*0.06, size: W*0.026, rot:  0.80, color: BLUSH,   type: 'blossom',     bloomT: 0 },
      { x: bCX - W*0.28, y: bCY0 + H*0.02, size: W*0.024, rot: -0.20, color: WHITE,   type: 'blossom',     bloomT: 0 },
      { x: bCX + W*0.28, y: bCY0 - H*0.03, size: W*0.026, rot:  0.55, color: CREAM,   type: 'blossom',     bloomT: 0 },
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
    const nameEl = document.getElementById('msg-name');
    nameEl.textContent = CONFIG.girlfriend.name;
    nameEl.style.cssText += `
      text-decoration: underline;
      text-decoration-color: rgba(200,80,106,0.55);
      text-underline-offset: 5px;
      text-decoration-thickness: 2px;
    `;

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

      // 3. Divider line (hidden — skip animation, keep timeline intact)
      .set(divider, { opacity: 0, display: 'none' }, '-=0.1')

      // 4. Personal message lines
      .fromTo(lines, { opacity: 0, y: 6 }, {
        opacity: 1, y: 0,
        duration: 0.8,
        ease: 'power1.out',
      }, '-=0.0');
  }

  // ── Everything revealed → show replay button + start idle music ─
  function onMessageComplete() {
    const replayBtn = document.getElementById('replay-btn');
    const msgEl = document.getElementById('birthday-message');

    // Get or create the btn-row container inside #birthday-message
    let row = document.getElementById('btn-row');
    if (!row && msgEl) {
      row = document.createElement('div');
      row.id = 'btn-row';
      row.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        gap:18px; padding:20px 0 28px; pointer-events:none;
        width:100%;
      `;
      msgEl.appendChild(row);
    }

    // Restyle replay-btn to circular and move into row
    if (replayBtn && row) {
      replayBtn.style.cssText += `
        width:62px; height:62px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        padding:0; font-size:1.4rem; line-height:1;
        position:static; bottom:auto; left:auto; right:auto; transform:none;
        flex-shrink:0;
      `;
      if (replayBtn.parentElement !== row) {
        row.insertBefore(replayBtn, row.firstChild);
      }
      replayBtn.style.pointerEvents = 'auto';
      gsap.fromTo(replayBtn,
        { opacity: 0, scale: 0.72 },
        { opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(2.2)', delay: 1.2 }
      );
    }

    // Build click-me button and append to row (right of replay)
    if (row && !document.getElementById('click-me-btn')) {
      const clickBtn = document.createElement('button');
      clickBtn.id = 'click-me-btn';
      clickBtn.innerHTML = '💕<br><span style="font-size:0.6rem;letter-spacing:.04em;display:block;margin-top:2px;">Click me!</span>';
      clickBtn.style.cssText = `
        width:62px; height:62px; border-radius:50%;
        display:flex; align-items:center; justify-content:center; flex-direction:column;
        padding:0; font-size:1.4rem; line-height:1;
        font-family:inherit; font-weight:700; color:#c8506a;
        background:linear-gradient(135deg,#fff0f3 0%,#ffe4ec 50%,#fff0f3 100%);
        border:2px solid #d4af6a;
        box-shadow:0 2px 18px rgba(200,80,106,0.18), 0 0 0 1px rgba(212,175,106,0.25) inset;
        cursor:pointer; opacity:0; pointer-events:none; flex-shrink:0;
        transition:box-shadow .18s ease;
      `;
      row.appendChild(clickBtn);

      clickBtn.addEventListener('click', () => {
        if (typeof BouquetPopup !== 'undefined') BouquetPopup.open();
      });

      if (!document.getElementById('hb-style')) {
        const hbStyle = document.createElement('style');
        hbStyle.id = 'hb-style';
        hbStyle.textContent = `
          @keyframes clickme-beat {
            0%   { transform: scale(1); }
            14%  { transform: scale(1.22); }
            28%  { transform: scale(1); }
            42%  { transform: scale(1.16); }
            70%  { transform: scale(1); }
            100% { transform: scale(1); }
          }
          #click-me-btn { animation: clickme-beat 2.2s ease-in-out infinite; }
          #click-me-btn:hover { animation: none; transform: scale(1.08) !important; }
        `;
        document.head.appendChild(hbStyle);
      }

      gsap.fromTo(clickBtn,
        { opacity: 0, scale: 0.72 },
        { opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(2.2)', delay: 1.6,
          onStart: () => { clickBtn.style.pointerEvents = 'auto'; }
        }
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
      if (Ctx.state === 'suspended') {
        Ctx.resume().then(() => _scheduleIdleMusic(Ctx)).catch(() => {});
        return;
      }
      _scheduleIdleMusic(Ctx);
    } catch(e) { console.warn('playIdleMusic failed:', e); }
  }

  function _scheduleIdleMusic(Ctx) {
    try {

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
    const Ctx = window._audioContext ||
      (window.AudioContext ? new AudioContext() : new webkitAudioContext());
    if (!Ctx) return;
    if (Ctx.state === 'suspended') {
      Ctx.resume().then(() => _scheduleBouquetFanfare(Ctx)).catch(() => {});
      return;
    }
    _scheduleBouquetFanfare(Ctx);
  }

  function _scheduleBouquetFanfare(Ctx) {
    try {

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

// ═══════════════════════════════════════════════════════════════════════
// BouquetPopup — grand bouquet modal triggered by "Click me!" button
// ═══════════════════════════════════════════════════════════════════════


const BouquetPopup = (() => {

  let overlay  = null;
  let canvas   = null;
  let ctx      = null;
  let rafId    = null;
  let phase    = 0;
  let bloomT   = 0;
  let bloomStart = 0;
  const BLOOM_DUR = 1800;

  let particles = [];
  let W = 0, H = 0, dpr = 1;
  let openCount = 0;  // tracks how many times popup has been opened

  const CAPTIONS = [
    'happy birthday my fave chacha!',
    'HAHHAAHHA ANGAS NO',
    'HBDD BOSS KO :))',
    'GOOD LUCKK CHARM 😚',
  ];

  // 5 bouquet color palettes that cycle per open
  const VARIANTS = [
    { peonyMid:'#f4a0c8', peonyLight:'#fac8dd', peonyDeep:'#e87aaa', peonyPale:'#fde0ec', peonyDark:'#d45090', wrapOuter:'#f8d8e8', wrapMid:'#fce8f2', bowPink:'#f090b8' },
    { peonyMid:'#e88ab0', peonyLight:'#f5b8cf', peonyDeep:'#c8607a', peonyPale:'#fad4e4', peonyDark:'#a84060', wrapOuter:'#f0c8d8', wrapMid:'#f8dce8', bowPink:'#d87098' },
    { peonyMid:'#c890c8', peonyLight:'#e0b8e0', peonyDeep:'#a860a8', peonyPale:'#f0d8f0', peonyDark:'#885088', wrapOuter:'#e8d0ec', wrapMid:'#f4e0f4', bowPink:'#b878b8' },
    { peonyMid:'#f0a890', peonyLight:'#f8c8b8', peonyDeep:'#d87860', peonyPale:'#fde8e0', peonyDark:'#b85840', wrapOuter:'#f8ddd4', wrapMid:'#fceee8', bowPink:'#e08878' },
    { peonyMid:'#f4b8a0', peonyLight:'#fad0bc', peonyDeep:'#e89070', peonyPale:'#feeee4', peonyDark:'#c87050', wrapOuter:'#fae0d0', wrapMid:'#fdeee4', bowPink:'#e8a080' },
  ];

  const C = {
    // Peony tones
    peonyMid:   '#f4a0c8',
    peonyLight: '#fac8dd',
    peonyPale:  '#fde0ec',
    peonyDeep:  '#e87aaa',
    peonyDark:  '#d45090',
    // Greenery
    eucaDark:   '#4a6e3a',
    eucaMid:    '#6a8e55',
    eucaLight:  '#8aae70',
    // Wrap paper
    wrapOuter:  '#f8d8e8',
    wrapMid:    '#fce8f2',
    wrapInner:  '#fff4f8',
    wrapTissue: '#fffbfd',
    wrapFold:   '#f0c0d8',
    // Bow
    bowPink:    '#f090b8',
    bowLight:   '#fbbcd4',
    bowDark:    '#d06090',
    // Misc
    white:      '#fffcfe',
    babyBreath: '#fffafa',
    ribbonGold: '#d4af6a',
    ribbonHi:   '#f0d090',
    ribbonSha:  '#a87840',
  };

  function init() {
    injectDOM();
  }

  function injectDOM() {
    if (!document.getElementById('bouquet-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'bouquet-overlay';
      ov.style.cssText = `
        position:fixed; inset:0; z-index:200;
        display:flex; align-items:center; justify-content:center;
        background:rgba(30,10,18,0.72);
        backdrop-filter:blur(6px);
        opacity:0; pointer-events:none;
        transition:opacity .35s ease;
      `;

      const card = document.createElement('div');
      card.id = 'bouquet-card';
      card.style.cssText = `
        position:relative;
        width:min(92vw,420px);
        background:linear-gradient(160deg,#fff8fb 0%,#ffeef4 60%,#fff5e8 100%);
        border:2px solid rgba(212,175,106,0.55);
        border-radius:24px;
        box-shadow:0 8px 48px rgba(200,80,106,0.22), 0 2px 12px rgba(212,175,106,0.18);
        overflow:hidden;
        transform:scale(.88) translateY(24px);
        transition:transform .4s cubic-bezier(.34,1.56,.64,1), opacity .35s ease;
        opacity:0;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.id = 'bouquet-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = `
        position:absolute; top:12px; right:16px; z-index:5;
        background:none; border:none;
        font-size:1.7rem; line-height:1; color:#c8506a;
        cursor:pointer; opacity:.7; padding:4px 8px;
        transition:opacity .15s;
      `;
      closeBtn.onmouseenter = () => closeBtn.style.opacity = '1';
      closeBtn.onmouseleave = () => closeBtn.style.opacity = '.7';
      closeBtn.addEventListener('click', close);

      const cvs = document.createElement('canvas');
      cvs.id = 'bouquet-popup-canvas';
      cvs.style.cssText = 'display:block; width:100%;';

      const caption = document.createElement('p');
      caption.style.cssText = `
        text-align:center; margin:0; padding:14px 20px 20px;
        font-size:.95rem; color:#c8506a;
        font-style:italic; letter-spacing:.02em;
        opacity:.85;
      `;
      caption.textContent = '💕 for you, always 💕';

      card.appendChild(closeBtn);
      card.appendChild(cvs);
      card.appendChild(caption);
      ov.appendChild(card);
      document.body.appendChild(ov);

      ov.addEventListener('click', e => { if (e.target === ov) close(); });

      overlay = ov;
      canvas  = cvs;
    }
  }

  function showButton() {
    const btn = document.getElementById('click-me-btn');
    if (!btn) return;
    btn.style.opacity      = '1';
    btn.style.pointerEvents = 'auto';
  }

  function open() {
    overlay = document.getElementById('bouquet-overlay');
    canvas  = document.getElementById('bouquet-popup-canvas');
    if (!overlay || !canvas) return;

    const cardW = Math.min(window.innerWidth * 0.92, 420);
    const cardH = Math.round(cardW * 1.18);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W   = cardW;
    H   = cardH;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = cardH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Apply rotating color variant
    const variant = VARIANTS[openCount % VARIANTS.length];
    Object.assign(C, variant);
    openCount++;

    // Randomize caption
    const caption = document.querySelector('#bouquet-card p');
    if (caption) {
      caption.textContent = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
    }

    phase      = 1;
    bloomT     = 0;
    bloomStart = performance.now();
    particles  = spawnSparkles();

    overlay.style.opacity      = '1';
    overlay.style.pointerEvents = 'auto';
    const card = document.getElementById('bouquet-card');
    card.style.opacity   = '1';
    card.style.transform = 'scale(1) translateY(0)';

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);

    playOpenChime();
  }

  function close() {
    const card = document.getElementById('bouquet-card');
    overlay.style.opacity      = '0';
    overlay.style.pointerEvents = 'none';
    if (card) {
      card.style.opacity   = '0';
      card.style.transform = 'scale(.88) translateY(24px)';
    }
    cancelAnimationFrame(rafId);
    phase = 0;
  }

  function tick(now) {
    if (phase === 0) return;
    ctx.clearRect(0, 0, W, H);

    const elapsed = now - bloomStart;
    bloomT = Math.min(elapsed / BLOOM_DUR, 1);
    if (bloomT >= 1) phase = 2;

    drawBouquet(bloomT);
    updateParticles(elapsed);
    drawParticles();

    rafId = requestAnimationFrame(tick);
  }

  // ── Master bouquet draw ──────────────────────────────────────────
  function drawBouquet(t) {
    const cx = W * 0.50;
    const cy = H * 0.40;

    const wrapPop = easeOut(clamp((t - 0) / 0.25, 0, 1));
    if (wrapPop > 0) drawWrap(cx, cy, wrapPop);

    const greenPop = easeOut(clamp((t - 0.05) / 0.30, 0, 1));
    if (greenPop > 0) drawGreenery(cx, cy, greenPop);

    if (t > 0.10) drawFlowers(cx, cy, t);

    const bbPop = easeOut(clamp((t - 0.35) / 0.25, 0, 1));
    if (bbPop > 0) drawBabysBreath(cx, cy, bbPop);

    const bowPop = easeOut(clamp(t / 0.30, 0, 1));
    if (bowPop > 0) drawBow(cx, cy + H * 0.16, 1, bowPop);

    // Handle ribbon / accessory on the cone stem (below the bow)
    const handlePop = easeOut(clamp((t - 0.18) / 0.30, 0, 1));
    if (handlePop > 0) drawHandleRibbon(cx, cy + H * 0.20, handlePop);
  }

  // ── Wrapping paper: layered Korean cone with texture + shadow ────
  function drawWrap(cx, cy, t) {
    const eased = easeOut(Math.min(t / 0.25, 1));
    if (eased <= 0) return;

    const base    = cy + H * 0.06;
    const tip     = H  * 0.97;
    const wideH   = W  * 0.40;
    const thinH   = W  * 0.024;

    ctx.save();
    ctx.globalAlpha = eased;

    // Drop shadow behind wrap
    ctx.shadowColor   = 'rgba(180,60,100,0.18)';
    ctx.shadowBlur    = 18;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 8;

    // ── Far-left paper panel (peeking out, darker) ──
    const farLeftG = ctx.createLinearGradient(cx - wideH * 1.18, 0, cx - wideH * 0.5, 0);
    farLeftG.addColorStop(0, darken(C.wrapOuter, 0.14));
    farLeftG.addColorStop(1, C.wrapOuter);
    ctx.beginPath();
    ctx.moveTo(cx - wideH * 1.18, base);
    ctx.lineTo(cx - thinH * 1.3, tip);
    ctx.lineTo(cx - wideH * 0.5, base);
    ctx.closePath();
    ctx.fillStyle = farLeftG;
    ctx.fill();

    // ── Far-right paper panel ──
    const farRightG = ctx.createLinearGradient(cx + wideH * 0.5, 0, cx + wideH * 1.18, 0);
    farRightG.addColorStop(0, C.wrapOuter);
    farRightG.addColorStop(1, darken(C.wrapOuter, 0.14));
    ctx.beginPath();
    ctx.moveTo(cx + wideH * 0.5, base);
    ctx.lineTo(cx + thinH * 1.3, tip);
    ctx.lineTo(cx + wideH * 1.18, base);
    ctx.closePath();
    ctx.fillStyle = farRightG;
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // ── Main left panel ──
    const leftG = ctx.createLinearGradient(cx - wideH, base, cx, base);
    leftG.addColorStop(0,   darken(C.wrapOuter, 0.10));
    leftG.addColorStop(0.3, C.wrapOuter);
    leftG.addColorStop(0.8, C.wrapMid);
    leftG.addColorStop(1,   lighten(C.wrapMid, 0.08));
    ctx.beginPath();
    ctx.moveTo(cx - wideH, base);
    ctx.lineTo(cx - thinH, tip);
    ctx.lineTo(cx + thinH, tip);
    ctx.lineTo(cx, base);
    ctx.closePath();
    ctx.fillStyle = leftG;
    ctx.fill();

    // ── Main right panel ──
    const rightG = ctx.createLinearGradient(cx, base, cx + wideH, base);
    rightG.addColorStop(0,   lighten(C.wrapMid, 0.08));
    rightG.addColorStop(0.2, C.wrapMid);
    rightG.addColorStop(0.7, C.wrapOuter);
    rightG.addColorStop(1,   darken(C.wrapOuter, 0.10));
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx - thinH, tip);
    ctx.lineTo(cx + thinH, tip);
    ctx.lineTo(cx + wideH, base);
    ctx.closePath();
    ctx.fillStyle = rightG;
    ctx.fill();

    // ── White tissue inner ──
    const tissW = wideH * 0.60;
    const tissG = ctx.createLinearGradient(cx - tissW, 0, cx + tissW, 0);
    tissG.addColorStop(0,   '#f0e0ea');
    tissG.addColorStop(0.2, C.wrapTissue);
    tissG.addColorStop(0.5, '#ffffff');
    tissG.addColorStop(0.8, C.wrapTissue);
    tissG.addColorStop(1,   '#f0e0ea');
    ctx.beginPath();
    ctx.moveTo(cx - tissW, base);
    ctx.lineTo(cx - thinH * 0.6, tip);
    ctx.lineTo(cx + thinH * 0.6, tip);
    ctx.lineTo(cx + tissW, base);
    ctx.closePath();
    ctx.fillStyle = tissG;
    ctx.fill();

    // ── Fold crease lines — left panel ──
    ctx.globalAlpha = eased * 0.28;
    for (let i = 1; i <= 5; i++) {
      const fr = i / 6;
      const x1 = cx - wideH * (1 - fr * 0.55);
      const x2 = cx - tissW * (1 - fr * 0.08);
      const y  = base + (tip - base) * fr * 0.72;
      ctx.beginPath();
      ctx.moveTo(x1, base + (y - base) * 0.25);
      ctx.lineTo(x2, y);
      ctx.strokeStyle = darken(C.wrapOuter, 0.22);
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
    // right panel
    for (let i = 1; i <= 5; i++) {
      const fr = i / 6;
      const x1 = cx + wideH * (1 - fr * 0.55);
      const x2 = cx + tissW * (1 - fr * 0.08);
      const y  = base + (tip - base) * fr * 0.72;
      ctx.beginPath();
      ctx.moveTo(x1, base + (y - base) * 0.25);
      ctx.lineTo(x2, y);
      ctx.strokeStyle = darken(C.wrapOuter, 0.22);
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    // ── Scalloped tissue top edge ──
    ctx.globalAlpha = eased * 0.65;
    ctx.strokeStyle = C.wrapMid;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - tissW, base);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const x = (cx - tissW) + (tissW * 2) * (i / steps);
      const wave = Math.sin(i * 1.1) * 5.5;
      if (i === 0) ctx.moveTo(x, base + wave);
      else ctx.lineTo(x, base + wave);
    }
    ctx.stroke();

    ctx.restore();
  }

  // ── Handle ribbon / cone stem accessory ─────────────────────────
  // 3 styles cycle per open (openCount already incremented before draw):
  //   0 → diagonal satin ribbon wrap (pink + gold)
  //   1 → pearl bead string spiral
  //   2 → gold twine spiral + mini accent bow
  function drawHandleRibbon(cx, startY, alpha) {
    if (alpha <= 0) return;

    // Cone stem geometry (matches drawWrap): narrows from base to tip
    const base   = startY;                  // just below the bow
    const tip    = H * 0.97;
    const tipHW  = W * 0.024;              // half-width at tip
    const baseHW = W * 0.40 * 0.18;       // half-width at this start point (narrowed)

    // style index uses openCount-1 (already incremented in open())
    const style = (openCount - 1) % 3;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (style === 0) {
      // ── Style 0: diagonal satin ribbon wrap ──────────────────────
      // Alternating pink satin + gold satin diagonal bands spiralling down
      const bands = 8;
      for (let i = 0; i < bands; i++) {
        const t0 = i / bands;
        const t1 = (i + 0.55) / bands;
        const y0 = base + (tip - base) * t0;
        const y1 = base + (tip - base) * Math.min(t1, 1);
        const hw0 = baseHW + (tipHW - baseHW) * t0;
        const hw1 = baseHW + (tipHW - baseHW) * Math.min(t1, 1);

        // Alternate colors: odd = pink satin, even = gold
        const isGold = i % 2 === 0;
        const mainCol = isGold ? C.ribbonGold : C.bowPink;
        const hiCol   = isGold ? C.ribbonHi   : C.bowLight;
        const shaCol  = isGold ? C.ribbonSha  : C.bowDark;

        // Band shape: diagonal parallelogram
        const offset = hw0 * 0.6;  // diagonal shift
        ctx.beginPath();
        ctx.moveTo(cx - hw0 + offset, y0);
        ctx.lineTo(cx + hw0 + offset, y0);
        ctx.lineTo(cx + hw1 - offset, y1);
        ctx.lineTo(cx - hw1 - offset, y1);
        ctx.closePath();

        const g = ctx.createLinearGradient(cx - hw0, 0, cx + hw0, 0);
        g.addColorStop(0,   shaCol);
        g.addColorStop(0.3, mainCol);
        g.addColorStop(0.55, hiCol);
        g.addColorStop(0.8, mainCol);
        g.addColorStop(1,   shaCol);
        ctx.fillStyle = g;
        ctx.globalAlpha = alpha * 0.72;
        ctx.fill();

        // Satin sheen highlight line
        ctx.beginPath();
        ctx.moveTo(cx + offset * 0.3, y0 + (y1 - y0) * 0.15);
        ctx.lineTo(cx + offset * 0.3, y0 + (y1 - y0) * 0.85);
        ctx.strokeStyle = hiCol;
        ctx.lineWidth   = hw0 * 0.22;
        ctx.lineCap     = 'round';
        ctx.globalAlpha = alpha * 0.30;
        ctx.stroke();
      }

    } else if (style === 1) {
      // ── Style 1: pearl bead string ───────────────────────────────
      const beadCount = 16;
      for (let i = 0; i < beadCount; i++) {
        const fr  = i / (beadCount - 1);
        const y   = base + (tip - base) * fr;
        const hw  = baseHW + (tipHW - baseHW) * fr;
        // Slight sine oscillation across the stem
        const osc = Math.sin(fr * Math.PI * 5) * hw * 0.55;
        const x   = cx + osc;
        const r   = Math.max(2, hw * 0.28 * (1 - fr * 0.5));

        // Pearl sphere shading
        const pg = ctx.createRadialGradient(x - r*0.3, y - r*0.3, 0, x, y, r);
        pg.addColorStop(0,   '#ffffff');
        pg.addColorStop(0.4, '#f8f0f8');
        pg.addColorStop(1,   '#d8c8dc');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle   = pg;
        ctx.globalAlpha = alpha * 0.90;
        ctx.fill();

        // Connect beads with a thin cord
        if (i > 0) {
          const fr2  = (i - 1) / (beadCount - 1);
          const y2   = base + (tip - base) * fr2;
          const hw2  = baseHW + (tipHW - baseHW) * fr2;
          const osc2 = Math.sin(fr2 * Math.PI * 5) * hw2 * 0.55;
          ctx.beginPath();
          ctx.moveTo(cx + osc2, y2);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(212,175,212,0.50)';
          ctx.lineWidth   = 0.7;
          ctx.globalAlpha = alpha * 0.60;
          ctx.stroke();
        }
      }

    } else {
      // ── Style 2: gold twine spiral + mini accent bow ──────────────
      const turns = 5;
      const pts   = turns * 24;
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const fr  = i / pts;
        const y   = base + (tip - base) * fr;
        const hw  = baseHW + (tipHW - baseHW) * fr;
        const ang = fr * Math.PI * 2 * turns;
        const x   = cx + Math.cos(ang) * hw * 0.65;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.ribbonGold;
      ctx.lineWidth   = Math.max(1.5, baseHW * 0.12);
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = alpha * 0.82;
      ctx.stroke();

      // Second twine pass for sheen
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const fr  = i / pts;
        const y   = base + (tip - base) * fr;
        const hw  = baseHW + (tipHW - baseHW) * fr;
        const ang = fr * Math.PI * 2 * turns;
        const x   = cx + Math.cos(ang) * hw * 0.65;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.ribbonHi;
      ctx.lineWidth   = Math.max(0.6, baseHW * 0.045);
      ctx.globalAlpha = alpha * 0.38;
      ctx.stroke();

      // Mini accent bow at 1/3 down the stem
      const bx = cx;
      const by = base + (tip - base) * 0.28;
      const br = baseHW * 0.80;
      ctx.globalAlpha = alpha * 0.88;

      // Mini tails
      [[-0.30, 0.55], [0.30, 0.55]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(bx, by + br * 0.10);
        ctx.quadraticCurveTo(bx + br * dx * 1.5, by + br * dy, bx + br * dx * 2.2, by + br * dy * 1.5);
        ctx.strokeStyle = C.ribbonGold;
        ctx.lineWidth   = br * 0.28;
        ctx.lineCap     = 'round';
        ctx.stroke();
        ctx.strokeStyle = C.ribbonHi;
        ctx.lineWidth   = br * 0.09;
        ctx.globalAlpha = alpha * 0.35;
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.88;
      });

      // Mini loops
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(
          bx + side * br * 0.20, by - br * 0.45,
          bx + side * br * 1.45, by - br * 0.72,
          bx + side * br * 1.25, by + br * 0.08
        );
        ctx.bezierCurveTo(
          bx + side * br * 1.05, by + br * 0.48,
          bx + side * br * 0.36, by + br * 0.32,
          bx, by
        );
        const lg = ctx.createRadialGradient(
          bx + side * br * 0.65, by - br * 0.20, 0,
          bx + side * br * 0.65, by - br * 0.20, br * 1.0
        );
        lg.addColorStop(0,   C.ribbonHi);
        lg.addColorStop(0.4, C.ribbonGold);
        lg.addColorStop(1,   C.ribbonSha);
        ctx.fillStyle   = lg;
        ctx.globalAlpha = alpha * 0.88;
        ctx.fill();
        // Sheen
        ctx.beginPath();
        ctx.moveTo(bx + side * br * 0.14, by - br * 0.06);
        ctx.bezierCurveTo(
          bx + side * br * 0.50, by - br * 0.44,
          bx + side * br * 1.10, by - br * 0.56,
          bx + side * br * 1.18, by + br * 0.02
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth   = br * 0.11;
        ctx.lineCap     = 'round';
        ctx.globalAlpha = alpha * 0.40;
        ctx.stroke();
      });

      // Mini knot
      ctx.globalAlpha = alpha * 0.88;
      const kg = ctx.createRadialGradient(bx, by, 0, bx, by, br * 0.26);
      kg.addColorStop(0,   '#ffffff');
      kg.addColorStop(0.4, C.ribbonHi);
      kg.addColorStop(1,   C.ribbonGold);
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 0.24, br * 0.19, 0, 0, Math.PI * 2);
      ctx.fillStyle = kg;
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Satin bow: two loops + knot + ribbon tails ───────────────────
  function drawBow(cx, cy, r, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Ribbon tails first (behind loops)
    const tails = [[0.28, 0.85, 0.50, 1.15], [-0.28, 0.85, -0.52, 1.12]];
    tails.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.18);
      ctx.quadraticCurveTo(cx + r*x1, cy + r*y1, cx + r*x2, cy + r*y2);
      ctx.lineWidth   = r * 0.30;
      ctx.strokeStyle = C.bowPink;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.lineWidth   = r * 0.10;
      ctx.strokeStyle = C.bowLight;
      ctx.globalAlpha = alpha * 0.50;
      ctx.stroke();
      ctx.globalAlpha = alpha;
    });

    // Loop helper
    const drawLoop = (side) => {
      const s = side;  // 1 = left, -1 = right
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(
        cx + s*r*0.28, cy - r*0.55,
        cx + s*r*1.90, cy - r*0.95,
        cx + s*r*1.65, cy + r*0.08
      );
      ctx.bezierCurveTo(
        cx + s*r*1.42, cy + r*0.65,
        cx + s*r*0.48, cy + r*0.42,
        cx, cy
      );
      const g = ctx.createRadialGradient(
        cx + s*r*0.85, cy - r*0.28, 0,
        cx + s*r*0.85, cy - r*0.28, r*1.3
      );
      g.addColorStop(0,   C.bowLight);
      g.addColorStop(0.4, C.bowPink);
      g.addColorStop(1,   C.bowDark);
      ctx.fillStyle = g;
      ctx.fill();
      // Satin sheen
      ctx.beginPath();
      ctx.moveTo(cx + s*r*0.18, cy - r*0.08);
      ctx.bezierCurveTo(
        cx + s*r*0.65, cy - r*0.55,
        cx + s*r*1.45, cy - r*0.72,
        cx + s*r*1.55, cy + r*0.02
      );
      ctx.strokeStyle = 'rgba(255,255,255,0.50)';
      ctx.lineWidth   = r * 0.14;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.restore();
    };

    drawLoop(-1);  // left loop
    drawLoop(1);   // right loop

    // Center knot
    const kg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.38);
    kg.addColorStop(0,   '#ffffff');
    kg.addColorStop(0.3, C.bowLight);
    kg.addColorStop(0.7, C.bowPink);
    kg.addColorStop(1,   C.bowDark);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r*0.32, r*0.26, 0, 0, Math.PI*2);
    ctx.fillStyle = kg;
    ctx.fill();

    ctx.restore();
  }

  // ── Greenery: eucalyptus + fern fronds + ruscus ─────────────────
  function drawGreenery(cx, cy, t) {
    const s = Math.min(W, H);

    // Eucalyptus sprigs — tall arching behind flowers
    const eucas = [
      { dx:-W*0.26, dy: H*0.04, angle:-1.08, len:s*0.25, delay:0.00 },
      { dx: W*0.24, dy: H*0.02, angle: 1.12, len:s*0.23, delay:0.02 },
      { dx:-W*0.38, dy:-H*0.01, angle:-1.32, len:s*0.20, delay:0.03 },
      { dx: W*0.36, dy:-H*0.03, angle: 1.30, len:s*0.19, delay:0.03 },
      { dx:-W*0.08, dy:-H*0.10, angle:-0.68, len:s*0.18, delay:0.05 },
      { dx: W*0.10, dy:-H*0.12, angle: 0.72, len:s*0.17, delay:0.05 },
    ];
    eucas.forEach(sp => {
      const lt = clamp((t - sp.delay) / 0.50, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.95;
      drawEucalyptus(cx + sp.dx, cy + sp.dy, sp.angle, sp.len * easeOut(lt));
      ctx.restore();
    });

    // Fern fronds — feathery accent
    const ferns = [
      { dx:-W*0.32, dy: H*0.01, angle:-0.88, len:s*0.14, delay:0.06 },
      { dx: W*0.30, dy: H*0.00, angle: 0.90, len:s*0.13, delay:0.07 },
      { dx:-W*0.44, dy: H*0.06, angle:-1.18, len:s*0.12, delay:0.08 },
      { dx: W*0.42, dy: H*0.05, angle: 1.20, len:s*0.11, delay:0.08 },
    ];
    ferns.forEach(f => {
      const lt = clamp((t - f.delay) / 0.45, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.80;
      drawFern(cx + f.dx, cy + f.dy, f.angle, f.len * easeOut(lt));
      ctx.restore();
    });

    // Ruscus accent leaves peeking between flowers
    const ruscus = [
      { dx:-W*0.16, dy: H*0.03, angle:-0.48, len:s*0.10, delay:0.10 },
      { dx: W*0.17, dy: H*0.02, angle: 0.52, len:s*0.10, delay:0.10 },
      { dx:-W*0.04, dy: H*0.09, angle:-0.18, len:s*0.09, delay:0.12 },
      { dx: W*0.06, dy: H*0.08, angle: 0.28, len:s*0.09, delay:0.12 },
      { dx:-W*0.24, dy:-H*0.02, angle:-0.62, len:s*0.08, delay:0.13 },
      { dx: W*0.22, dy:-H*0.04, angle: 0.66, len:s*0.08, delay:0.13 },
    ];
    ruscus.forEach(l => {
      const lt = clamp((t - l.delay) / 0.45, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.88;
      ctx.translate(cx + l.dx, cy + l.dy);
      ctx.rotate(l.angle);
      ctx.scale(easeOut(lt), easeOut(lt));
      drawLeaf(l.len, l.len * 0.32, C.eucaMid);
      ctx.restore();
    });
  }

  // ── Eucalyptus sprig ─────────────────────────────────────────────
  function drawEucalyptus(x, y, angle, len) {
    const count = 6;
    const lW = len * 0.14, lH = len * 0.09;
    const endX = x + Math.sin(angle) * len;
    const endY = y - Math.cos(Math.abs(angle)) * len;
    const cpX  = x + Math.sin(angle)*len*0.5 + Math.cos(angle)*len*0.2;
    const cpY  = y - Math.cos(Math.abs(angle))*len*0.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.strokeStyle = C.eucaDark;
    ctx.lineWidth   = 1.4;
    ctx.lineCap     = 'round';
    ctx.stroke();

    for (let i = 1; i <= count; i++) {
      const fr = i / (count + 1);
      const bx = (1-fr)*(1-fr)*x + 2*(1-fr)*fr*cpX + fr*fr*endX;
      const by = (1-fr)*(1-fr)*y + 2*(1-fr)*fr*cpY + fr*fr*endY;
      const ta = Math.atan2(endY - y, endX - x);
      const sc = 0.65 + fr * 0.55;
      const col = fr < 0.4 ? C.eucaDark : fr < 0.75 ? C.eucaMid : C.eucaLight;

      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ta + side * (Math.PI*0.5 - 0.28));
        ctx.beginPath();
        ctx.ellipse(lW*sc*side, 0, lW*sc, lH*sc, 0, 0, Math.PI*2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, lW*sc);
        g.addColorStop(0, lighten(col, 0.18));
        g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      });
    }
  }

  // ── Fern frond: pinnate feathery leaves ──────────────────────────
  function drawFern(x, y, angle, len) {
    const endX = x + Math.sin(angle) * len;
    const endY = y - Math.cos(Math.abs(angle)) * len;
    const cpX  = x + Math.sin(angle)*len*0.45;
    const cpY  = y - Math.cos(Math.abs(angle))*len*0.45;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.strokeStyle = C.eucaDark;
    ctx.lineWidth   = 1.0;
    ctx.stroke();

    const count = 7;
    for (let i = 1; i <= count; i++) {
      const fr = i / (count + 1);
      const bx = (1-fr)*(1-fr)*x + 2*(1-fr)*fr*cpX + fr*fr*endX;
      const by = (1-fr)*(1-fr)*y + 2*(1-fr)*fr*cpY + fr*fr*endY;
      const ta = Math.atan2(endY - y, endX - x);
      const pLen = len * (0.18 + (1 - fr) * 0.14);

      [-1, 1].forEach(side => {
        const pa = ta + side * 0.72;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(pa)*pLen, by + Math.sin(pa)*pLen);
        ctx.strokeStyle = C.eucaMid;
        ctx.lineWidth   = 0.85;
        ctx.stroke();
      });
    }
  }

  // ── Single pointed leaf (ruscus) ─────────────────────────────────
  function drawLeaf(len, w, col) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len*0.32, -w*0.55, -len*0.72, 0, -len);
    ctx.bezierCurveTo( w*0.55, -len*0.72,  w, -len*0.32, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0,   lighten(col, 0.18));
    g.addColorStop(0.5, col);
    g.addColorStop(1,   darken(col, 0.15));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len * 0.85);
    ctx.strokeStyle = darken(col, 0.22);
    ctx.lineWidth   = w * 0.16;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // ── Flower arrangement ────────────────────────────────────────────
  function drawFlowers(cx, cy, t) {
    const s = Math.min(W, H);

    // Layout: 3-2-2 pyramid with mixed types
    const flowers = [
      // Back row
      { dx:-W*0.175, dy:-H*0.045, sz:s*0.148, rot:-0.20, delay:0.00, type:'peony',      col:C.peonyLight },
      { dx: W*0.160, dy:-H*0.065, sz:s*0.142, rot: 0.24, delay:0.02, type:'rose',       col:C.peonyMid   },
      { dx: W*0.005, dy:-H*0.095, sz:s*0.130, rot:-0.06, delay:0.04, type:'ranunculus', col:C.peonyPale  },
      // Mid row
      { dx:-W*0.300, dy: H*0.018, sz:s*0.118, rot:-0.38, delay:0.08, type:'rose',       col:C.peonyDeep  },
      { dx: W*0.295, dy: H*0.005, sz:s*0.112, rot: 0.42, delay:0.08, type:'peony',      col:C.peonyLight },
      // Front centre
      { dx: 0,       dy: H*0.035, sz:s*0.168, rot: 0.06, delay:0.12, type:'peony',      col:C.peonyMid   },
      // Bud accents low
      { dx:-W*0.090, dy: H*0.095, sz:s*0.082, rot:-0.14, delay:0.16, type:'bud',        col:C.peonyPale  },
      { dx: W*0.105, dy: H*0.085, sz:s*0.078, rot: 0.30, delay:0.17, type:'bud',        col:C.peonyDeep  },
      // Small spray blossoms
      { dx:-W*0.200, dy:-H*0.030, sz:s*0.058, rot: 0.18, delay:0.20, type:'blossom',    col:C.peonyLight },
      { dx: W*0.215, dy:-H*0.025, sz:s*0.054, rot:-0.22, delay:0.21, type:'blossom',    col:C.peonyMid   },
    ];

    // Baby's breath clusters
    const bb = [
      { dx:-W*0.38, dy:-H*0.075, sp:s*0.065, delay:0.22 },
      { dx: W*0.37, dy:-H*0.055, sp:s*0.065, delay:0.22 },
      { dx:-W*0.22, dy:-H*0.115, sp:s*0.055, delay:0.24 },
      { dx: W*0.23, dy:-H*0.105, sp:s*0.055, delay:0.24 },
      { dx: 0,      dy:-H*0.155, sp:s*0.048, delay:0.25 },
      { dx:-W*0.42, dy: H*0.050, sp:s*0.050, delay:0.26 },
      { dx: W*0.41, dy: H*0.035, sp:s*0.050, delay:0.26 },
      { dx:-W*0.12, dy:-H*0.135, sp:s*0.042, delay:0.27 },
      { dx: W*0.13, dy:-H*0.125, sp:s*0.042, delay:0.27 },
      { dx:-W*0.28, dy: H*0.075, sp:s*0.038, delay:0.28 },
      { dx: W*0.27, dy: H*0.080, sp:s*0.038, delay:0.28 },
    ];

    // Back + mid flowers
    [0,1,2,3,4].forEach(i => _drawFlower(flowers[i], cx, cy, t));

    // Baby's breath
    bb.forEach(b => {
      const bt = clamp((t - b.delay) / 0.38, 0, 1);
      if (bt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(bt) * 0.95;
      drawBabysBreath(cx + b.dx, cy + b.dy, b.sp);
      ctx.restore();
    });

    // Front flowers on top
    [5,6,7,8,9].forEach(i => _drawFlower(flowers[i], cx, cy, t));
  }

  function _drawFlower(f, cx, cy, t) {
    const ft = clamp((t - f.delay) / 0.50, 0, 1);
    if (ft <= 0) return;
    const pop = easeOut(ft) * (ft < 0.80 ? 1 : 1 + Math.sin((ft-0.80)/0.20*Math.PI)*0.06);
    ctx.save();
    ctx.globalAlpha = easeOut(ft);
    ctx.translate(cx + f.dx, cy + f.dy);
    ctx.rotate(f.rot);
    ctx.scale(pop, pop);
    if      (f.type === 'peony')      drawPeony(f.col, f.sz);
    else if (f.type === 'rose')       drawRose(f.col, f.sz);
    else if (f.type === 'ranunculus') drawRanunculus(f.col, f.sz);
    else if (f.type === 'bud')        drawBud(f.col, f.sz);
    else if (f.type === 'blossom')    drawBlossom(f.col, f.sz);
    ctx.restore();
  }

  // ── Peony: 4 concentric petal rings + stamen ─────────────────────
  function drawPeony(col, s) {
    // Ring 1 — 5 wide outer petals
    for (let i = 0; i < 5; i++) {
      const a = (i/5)*Math.PI*2 + 0.12;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -s*0.07);
      ctx.bezierCurveTo(-s*0.44, -s*0.24, -s*0.54, s*0.54, 0, s*0.82);
      ctx.bezierCurveTo( s*0.54,  s*0.54,  s*0.44,-s*0.24, 0,-s*0.07);
      const g = ctx.createLinearGradient(0,-s*0.12,0,s*0.82);
      g.addColorStop(0, lighten(col,0.20)); g.addColorStop(0.55, col); g.addColorStop(1, darken(col,0.22));
      ctx.fillStyle=g; ctx.fill();
      // petal vein
      ctx.beginPath(); ctx.moveTo(0,-s*0.04); ctx.quadraticCurveTo(s*0.04,s*0.35,0,s*0.78);
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=s*0.028; ctx.stroke();
      ctx.restore();
    }
    // Ring 2 — 7 petals
    for (let i = 0; i < 7; i++) {
      const a = (i/7)*Math.PI*2 - 0.24;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,-s*0.05);
      ctx.bezierCurveTo(-s*0.34,-s*0.18,-s*0.42, s*0.40, 0, s*0.62);
      ctx.bezierCurveTo( s*0.42, s*0.40,  s*0.34,-s*0.18, 0,-s*0.05);
      const g = ctx.createLinearGradient(0,-s*0.05,0,s*0.62);
      g.addColorStop(0, lighten(col,0.26)); g.addColorStop(1, lighten(col,0.06));
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    // Ring 3 — 8 inner petals
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 + 0.40;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,-s*0.03);
      ctx.bezierCurveTo(-s*0.22,-s*0.12,-s*0.27,s*0.24, 0,s*0.40);
      ctx.bezierCurveTo( s*0.27, s*0.24,  s*0.22,-s*0.12,0,-s*0.03);
      ctx.fillStyle = lighten(col,0.32); ctx.fill(); ctx.restore();
    }
    // Ring 4 — 10 tiny cupped petals
    for (let i = 0; i < 10; i++) {
      const a = (i/10)*Math.PI*2 - 0.08;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(-s*0.10,-s*0.05,-s*0.12,s*0.10, 0,s*0.20);
      ctx.bezierCurveTo( s*0.12, s*0.10,  s*0.10,-s*0.05,0, 0);
      ctx.fillStyle = lighten(col,0.48); ctx.fill(); ctx.restore();
    }
    // Stamen center
    const cg = ctx.createRadialGradient(0,0,0,0,0,s*0.16);
    cg.addColorStop(0,'#fffbe8'); cg.addColorStop(0.5,'#ffe898'); cg.addColorStop(1,lighten(col,0.35));
    ctx.beginPath(); ctx.arc(0,0,s*0.15,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a=(i/12)*Math.PI*2; const r=s*0.082;
      ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r,s*0.016,0,Math.PI*2);
      ctx.fillStyle='#d4a030'; ctx.fill();
    }
  }

  // ── Rose: tight spiral of cupped petals ──────────────────────────
  function drawRose(col, s) {
    // Outer guard petals — 5 large cupped
    for (let i = 0; i < 5; i++) {
      const a = (i/5)*Math.PI*2 + 0.20;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,-s*0.08);
      ctx.bezierCurveTo(-s*0.38,-s*0.30,-s*0.50, s*0.38, 0, s*0.68);
      ctx.bezierCurveTo( s*0.50, s*0.38,  s*0.38,-s*0.30, 0,-s*0.08);
      const g=ctx.createLinearGradient(0,-s*0.12,0,s*0.70);
      g.addColorStop(0,lighten(col,0.18)); g.addColorStop(0.6,col); g.addColorStop(1,darken(col,0.25));
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    // Mid spiral — 6 petals, slightly inward, rotated 36°
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 + 0.52;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,-s*0.06);
      ctx.bezierCurveTo(-s*0.28,-s*0.22,-s*0.36,s*0.28,0,s*0.50);
      ctx.bezierCurveTo( s*0.36, s*0.28,  s*0.28,-s*0.22,0,-s*0.06);
      const g=ctx.createLinearGradient(0,-s*0.06,0,s*0.50);
      g.addColorStop(0,lighten(col,0.28)); g.addColorStop(1,col);
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    // Inner rolled petals — 8 tight
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 - 0.15;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0,-s*0.04);
      ctx.bezierCurveTo(-s*0.18,-s*0.14,-s*0.22,s*0.18,0,s*0.32);
      ctx.bezierCurveTo( s*0.22, s*0.18,  s*0.18,-s*0.14,0,-s*0.04);
      ctx.fillStyle=lighten(col,0.42); ctx.fill(); ctx.restore();
    }
    // Tight center bud
    const cg=ctx.createRadialGradient(0,0,0,0,0,s*0.14);
    cg.addColorStop(0,'#fff8f8'); cg.addColorStop(0.6,lighten(col,0.55)); cg.addColorStop(1,lighten(col,0.30));
    ctx.beginPath(); ctx.arc(0,0,s*0.13,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  // ── Ranunculus: many flat layered petals like a paper flower ─────
  function drawRanunculus(col, s) {
    const rings = [
      { count:8, scale:0.88, offset:0.08, lightness:0.05 },
      { count:9, scale:0.70, offset:0.22, lightness:0.15 },
      { count:10,scale:0.54, offset:0.35, lightness:0.28 },
      { count:11,scale:0.38, offset:0.48, lightness:0.42 },
    ];
    rings.forEach(r => {
      for (let i=0; i<r.count; i++) {
        const a=(i/r.count)*Math.PI*2+r.offset;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0,-s*0.04);
        ctx.bezierCurveTo(-s*0.26*r.scale,-s*0.18*r.scale,-s*0.30*r.scale,s*0.30*r.scale,0,s*0.52*r.scale);
        ctx.bezierCurveTo( s*0.30*r.scale, s*0.30*r.scale,  s*0.26*r.scale,-s*0.18*r.scale,0,-s*0.04);
        ctx.fillStyle=lighten(col,r.lightness); ctx.fill(); ctx.restore();
      }
    });
    const cg=ctx.createRadialGradient(0,0,0,0,0,s*0.10);
    cg.addColorStop(0,'#fff9e8'); cg.addColorStop(1,'#ffe090');
    ctx.beginPath(); ctx.arc(0,0,s*0.09,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  // ── Peony bud: closed teardrop petals ────────────────────────────
  function drawBud(col, s) {
    // Sepals
    for (let i=0; i<5; i++) {
      const a=(i/5)*Math.PI*2+0.30;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.bezierCurveTo(-s*0.10,-s*0.20,-s*0.08,-s*0.55,0,-s*0.72);
      ctx.bezierCurveTo( s*0.08,-s*0.55,  s*0.10,-s*0.20,0,0);
      ctx.fillStyle=darken(C.eucaMid,0.08); ctx.fill(); ctx.restore();
    }
    // Outer petals — cupped tightly around center
    for (let i=0; i<6; i++) {
      const a=(i/6)*Math.PI*2+0.15;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0,-s*0.06);
      ctx.bezierCurveTo(-s*0.22,-s*0.28,-s*0.22,s*0.08,0,s*0.38);
      ctx.bezierCurveTo( s*0.22, s*0.08,  s*0.22,-s*0.28,0,-s*0.06);
      const g=ctx.createLinearGradient(0,-s*0.10,0,s*0.38);
      g.addColorStop(0,lighten(col,0.22)); g.addColorStop(1,darken(col,0.10));
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    // Tight inner petals
    for (let i=0; i<8; i++) {
      const a=(i/8)*Math.PI*2-0.22;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0,-s*0.03);
      ctx.bezierCurveTo(-s*0.12,-s*0.16,-s*0.14,s*0.04,0,s*0.20);
      ctx.bezierCurveTo( s*0.14, s*0.04,  s*0.12,-s*0.16,0,-s*0.03);
      ctx.fillStyle=lighten(col,0.40); ctx.fill(); ctx.restore();
    }
  }

  // ── Spray blossom: 5-petal simple flower ─────────────────────────
  function drawBlossom(col, s) {
    for (let i=0; i<5; i++) {
      const a=(i/5)*Math.PI*2 - Math.PI*0.5;
      const px=Math.cos(a)*s*0.35, py=Math.sin(a)*s*0.35;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI*0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.25, s*0.36, 0, 0, Math.PI*2);
      const g=ctx.createRadialGradient(0,-s*0.12,0,0,-s*0.12,s*0.36);
      g.addColorStop(0,lighten(col,0.35)); g.addColorStop(1,col);
      ctx.fillStyle=g; ctx.fill(); ctx.restore();
    }
    const cg=ctx.createRadialGradient(0,0,0,0,0,s*0.13);
    cg.addColorStop(0,'#fff8c0'); cg.addColorStop(1,'#f0c840');
    ctx.beginPath(); ctx.arc(0,0,s*0.12,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  }

  // ── Baby's breath: delicate branching clusters ───────────────────
  function drawBabysBreath(cx, cy, spread) {
    if (spread <= 0) return;
    const branches = 7;
    const lenFracs = [0.72, 0.95, 0.62, 0.88, 0.78, 0.68, 0.82];
    const dotOffsets = [
      [0, 0, 2.8], [-0.55, 0.48, 2.2], [0.52, 0.42, 2.0],
      [-0.28, 0.88, 1.7], [0.30, 0.80, 1.6],
    ];
    for (let b = 0; b < branches; b++) {
      const baseAngle = (b / branches) * Math.PI * 2 - 0.15;
      const blen = spread * lenFracs[b];
      const bx = cx + Math.cos(baseAngle) * blen;
      const by = cy + Math.sin(baseAngle) * blen;
      // Sub-branch
      const sbx = cx + Math.cos(baseAngle)*blen*0.55;
      const sby = cy + Math.sin(baseAngle)*blen*0.55;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by);
      ctx.strokeStyle='rgba(110,145,90,0.30)'; ctx.lineWidth=0.7; ctx.stroke();

      dotOffsets.forEach(([ox, oy, dr]) => {
        const da = baseAngle + ox * 0.65;
        const dl = spread * (0.10 + oy * 0.055);
        const dx = bx + Math.cos(da) * dl;
        const dy = by + Math.sin(da) * dl;
        // White flower
        ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        // Petal detail
        for (let p=0; p<5; p++) {
          const pa=(p/5)*Math.PI*2;
          ctx.beginPath();
          ctx.arc(dx+Math.cos(pa)*dr*0.52, dy+Math.sin(pa)*dr*0.52, dr*0.42, 0, Math.PI*2);
          ctx.fillStyle='rgba(255,252,250,0.85)'; ctx.fill();
        }
        // Yellow center
        ctx.beginPath(); ctx.arc(dx, dy, dr*0.38, 0, Math.PI*2);
        ctx.fillStyle='#ffe870'; ctx.fill();
      });
    }
  }

  // ── Sparkle particles ────────────────────────────────────────────
  function spawnSparkles() {
    const ps = [];
    const cx = W * 0.5, cy = H * 0.42;
    const cols = ['#fff8e1','#ffe9a8','#ffd6e5','#ffffff','#ffc2d6','#d4af6a'];
    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      ps.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        r:  1.5 + Math.random() * 3.0,
        col: cols[Math.floor(Math.random() * cols.length)],
        life: 1.0,
        decay: 0.012 + Math.random() * 0.018,
      });
    }
    return ps;
  }

  function updateParticles(elapsed) {
    if (elapsed < 100) return;
    particles.forEach(p => {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.06;
      p.life -= p.decay;
    });
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col;
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Open chime sound ─────────────────────────────────────────────
  function playOpenChime() {
    const Ctx = window._audioContext ||
      (window.AudioContext ? new AudioContext() : new webkitAudioContext());
    if (!Ctx) return;
    if (Ctx.state === 'suspended') {
      Ctx.resume().then(() => _scheduleOpenChime(Ctx)).catch(() => {});
      return;
    }
    _scheduleOpenChime(Ctx);
  }

  function _scheduleOpenChime(Ctx) {
    try {
      const master = Ctx.createGain();
      master.gain.value = 0.22;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const d = i * 0.10;
        ['sine','triangle'].forEach((type, j) => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          const vol = j===0 ? 0.55 : 0.18;
          env.gain.setValueAtTime(0, now+d);
          env.gain.linearRampToValueAtTime(vol, now+d+0.025);
          env.gain.exponentialRampToValueAtTime(0.001, now+d+2.2);
          osc.connect(env); env.connect(master);
          osc.start(now+d); osc.stop(now+d+2.3);
        });
      });

      [1318.51,1567.98,1760.00].forEach((freq, i) => {
        const d = 0.42 + i * 0.10;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now+d);
        env.gain.linearRampToValueAtTime(0.06, now+d+0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now+d+1.2);
        osc.connect(env); env.connect(master);
        osc.start(now+d); osc.stop(now+d+1.3);
      });
    } catch(e) {}
  }

  // ── Colour helpers ────────────────────────────────────────────────
  function hexToRgb(h) {
    h = h.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function toHex(r,g,b) {
    return '#' + [r,g,b].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  function lighten(hex, a) { const[r,g,b]=hexToRgb(hex); return toHex(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a); }
  function darken(hex, a)  { const[r,g,b]=hexToRgb(hex); return toHex(r*(1-a), g*(1-a), b*(1-a)); }
  function clamp(v,lo,hi)  { return Math.max(lo, Math.min(hi, v)); }
  function easeOut(t)      { return 1-(1-t)*(1-t); }

  return { init, showButton, open, close };

})();
