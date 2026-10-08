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
    const cy = H * 0.42;

    // Draw order: wrap (back) → greenery → flowers (front)
    drawHandle(cx, cy, t);
    drawLeaves(cx, cy, t);
    drawFlowers(cx, cy, t);
  }

  // ── Korean bouquet wrap: cone/fan of pink paper + white tissue + bow ──
  function drawHandle(cx, cy, t) {
    const eased = easeOut(t);
    if (eased <= 0) return;

    // Geometry: cone wide at flowerBase, narrows to stemPoint
    const flowerBase = cy + H * 0.05;   // top of wrap (just below flowers)
    const stemPoint  = H * 0.96;         // bottom tip of cone
    const coneHalfW  = W * 0.38;         // half-width at flowerBase
    const stemHalfW  = W * 0.028;        // half-width at stem tip

    ctx.save();
    ctx.globalAlpha = eased;

    // ── Outer pink paper — left panel ──
    const leftGrad = ctx.createLinearGradient(cx - coneHalfW, 0, cx, 0);
    leftGrad.addColorStop(0,   C.wrapFold);
    leftGrad.addColorStop(0.4, C.wrapOuter);
    leftGrad.addColorStop(1,   C.wrapMid);
    ctx.beginPath();
    ctx.moveTo(cx - coneHalfW, flowerBase);
    ctx.lineTo(cx - stemHalfW, stemPoint);
    ctx.lineTo(cx + stemHalfW, stemPoint);
    ctx.lineTo(cx, flowerBase);
    ctx.closePath();
    ctx.fillStyle = leftGrad;
    ctx.fill();

    // ── Outer pink paper — right panel ──
    const rightGrad = ctx.createLinearGradient(cx, 0, cx + coneHalfW, 0);
    rightGrad.addColorStop(0,   C.wrapMid);
    rightGrad.addColorStop(0.6, C.wrapOuter);
    rightGrad.addColorStop(1,   C.wrapFold);
    ctx.beginPath();
    ctx.moveTo(cx, flowerBase);
    ctx.lineTo(cx + stemHalfW, stemPoint);
    ctx.lineTo(cx - stemHalfW, stemPoint);   // same tip
    ctx.lineTo(cx + coneHalfW, flowerBase);
    ctx.closePath();
    ctx.fillStyle = rightGrad;
    ctx.fill();

    // ── White tissue inner — narrower cone inside ──
    const tissueHalfW = coneHalfW * 0.62;
    const tissueGrad = ctx.createLinearGradient(cx - tissueHalfW, 0, cx + tissueHalfW, 0);
    tissueGrad.addColorStop(0,   '#f8e8f0');
    tissueGrad.addColorStop(0.5, C.wrapTissue);
    tissueGrad.addColorStop(1,   '#f8e8f0');
    ctx.beginPath();
    ctx.moveTo(cx - tissueHalfW, flowerBase);
    ctx.lineTo(cx - stemHalfW * 0.7, stemPoint);
    ctx.lineTo(cx + stemHalfW * 0.7, stemPoint);
    ctx.lineTo(cx + tissueHalfW, flowerBase);
    ctx.closePath();
    ctx.fillStyle = tissueGrad;
    ctx.fill();

    // ── Visible fold lines on the outer paper (left side) ──
    ctx.strokeStyle = C.wrapFold;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = eased * 0.55;
    for (let i = 1; i <= 4; i++) {
      const frac = i / 5;
      const fx1 = cx - coneHalfW * (1 - frac * 0.4);
      const fx2 = cx - tissueHalfW * (1 - frac * 0.1);
      const fy  = flowerBase + (stemPoint - flowerBase) * frac * 0.7;
      ctx.beginPath();
      ctx.moveTo(fx1, flowerBase + (fy - flowerBase) * 0.3);
      ctx.lineTo(fx2, fy);
      ctx.stroke();
    }
    // Right side folds
    for (let i = 1; i <= 4; i++) {
      const frac = i / 5;
      const fx1 = cx + coneHalfW * (1 - frac * 0.4);
      const fx2 = cx + tissueHalfW * (1 - frac * 0.1);
      const fy  = flowerBase + (stemPoint - flowerBase) * frac * 0.7;
      ctx.beginPath();
      ctx.moveTo(fx1, flowerBase + (fy - flowerBase) * 0.3);
      ctx.lineTo(fx2, fy);
      ctx.stroke();
    }

    // ── Tissue top edge — wavy folded edge visible above flowers ──
    ctx.globalAlpha = eased * 0.7;
    ctx.strokeStyle = C.wrapOuter;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - tissueHalfW, flowerBase);
    for (let x = cx - tissueHalfW; x <= cx + tissueHalfW; x += 12) {
      const wave = Math.sin((x - cx) * 0.08) * 5;
      ctx.lineTo(x, flowerBase + wave);
    }
    ctx.lineTo(cx + tissueHalfW, flowerBase);
    ctx.stroke();

    ctx.restore();

    // ── Pink satin bow at the top of the wrap ──
    const bowY = flowerBase + H * 0.01;
    drawBow(cx, bowY, W * 0.072, eased);
  }

  // ── Pink satin bow ───────────────────────────────────────────────
  function drawBow(cx, cy, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const drawLoop = (flip) => {
      ctx.save();
      if (flip) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx - r*0.3, cy - r*0.6,  cx - r*1.8, cy - r*0.9,  cx - r*1.6, cy + r*0.1);
      ctx.bezierCurveTo(cx - r*1.4, cy + r*0.6,  cx - r*0.5, cy + r*0.4,  cx, cy);

      const g = ctx.createRadialGradient(cx - r*0.8, cy - r*0.3, 0, cx - r*0.8, cy - r*0.3, r*1.2);
      g.addColorStop(0,   C.bowLight);
      g.addColorStop(0.5, C.bowPink);
      g.addColorStop(1,   C.bowDark);
      ctx.fillStyle = g;
      ctx.fill();

      // Sheen highlight
      ctx.beginPath();
      ctx.moveTo(cx - r*0.2, cy - r*0.08);
      ctx.bezierCurveTo(cx - r*0.7, cy - r*0.6, cx - r*1.4, cy - r*0.7, cx - r*1.5, cy + 0);
      ctx.strokeStyle = C.bowLight;
      ctx.lineWidth   = r * 0.13;
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineCap     = 'round';
      ctx.stroke();

      ctx.restore();
    };

    drawLoop(false);
    drawLoop(true);

    // Center knot
    ctx.globalAlpha = alpha;
    const kg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*0.35);
    kg.addColorStop(0,   C.bowLight);
    kg.addColorStop(0.5, C.bowPink);
    kg.addColorStop(1,   C.bowDark);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = kg;
    ctx.fill();

    // Tails
    [[ 0.30, 0.90,  0.55, 1.10],
     [-0.30, 0.90, -0.55, 1.10]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + r*x1, cy + r*y1, cx + r*x2, cy + r*y2);
      ctx.lineWidth   = r * 0.26;
      ctx.strokeStyle = C.bowPink;
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.lineWidth   = r * 0.09;
      ctx.strokeStyle = C.bowLight;
      ctx.globalAlpha = alpha * 0.45;
      ctx.stroke();
    });

    ctx.restore();
  }

  // ── Greenery: eucalyptus sprigs + ruscus around flowers ─────────
  function drawLeaves(cx, cy, t) {
    const s = Math.min(W, H);

    // Eucalyptus sprigs: arching stems rising from flower cluster
    const eucaSprigs = [
      { dx: -W*0.28, dy:  H*0.05,  angle: -1.05, len: s*0.22, delay: 0.00 },
      { dx:  W*0.26, dy:  H*0.03,  angle:  1.10, len: s*0.20, delay: 0.02 },
      { dx: -W*0.38, dy: -H*0.02,  angle: -1.30, len: s*0.18, delay: 0.04 },
      { dx:  W*0.35, dy: -H*0.04,  angle:  1.28, len: s*0.17, delay: 0.04 },
      { dx: -W*0.10, dy: -H*0.12,  angle: -0.72, len: s*0.16, delay: 0.06 },
      { dx:  W*0.12, dy: -H*0.14,  angle:  0.68, len: s*0.15, delay: 0.06 },
    ];

    eucaSprigs.forEach((sp, i) => {
      const lt = clamp((t - sp.delay) / 0.55, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt);
      drawEucalyptus(cx + sp.dx, cy + sp.dy, sp.angle, sp.len * lt);
      ctx.restore();
    });

    // Small ruscus accent leaves peeking between flowers
    const ruscusLeaves = [
      { dx: -W*0.18, dy:  H*0.02,  angle: -0.50, len: s*0.09, delay: 0.10 },
      { dx:  W*0.19, dy:  H*0.01,  angle:  0.55, len: s*0.09, delay: 0.10 },
      { dx: -W*0.05, dy:  H*0.08,  angle: -0.20, len: s*0.08, delay: 0.12 },
      { dx:  W*0.08, dy:  H*0.07,  angle:  0.30, len: s*0.08, delay: 0.12 },
    ];

    ruscusLeaves.forEach(l => {
      const lt = clamp((t - l.delay) / 0.50, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.85;
      ctx.translate(cx + l.dx, cy + l.dy);
      ctx.rotate(l.angle);
      ctx.scale(lt, lt);
      drawLeaf(l.len, l.len * 0.30, C.eucaMid);
      ctx.restore();
    });
  }

  // ── Eucalyptus sprig: arching stem with paired oval leaves ───────
  function drawEucalyptus(x, y, angle, len) {
    const leafCount = 5;
    const leafW = len * 0.16;
    const leafH = len * 0.10;
    const stemCol = C.eucaDark;

    // Draw arching stem
    const endX = x + Math.sin(angle) * len;
    const endY = y - Math.cos(Math.abs(angle)) * len;
    const cpX  = x + Math.sin(angle) * len * 0.5 + Math.cos(angle) * len * 0.18;
    const cpY  = y - Math.cos(Math.abs(angle)) * len * 0.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.strokeStyle = stemCol;
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Place leaves along the stem
    for (let i = 1; i <= leafCount; i++) {
      const frac = i / (leafCount + 1);
      // Interpolate along quadratic bezier
      const bx = (1-frac)*(1-frac)*x + 2*(1-frac)*frac*cpX + frac*frac*endX;
      const by = (1-frac)*(1-frac)*y + 2*(1-frac)*frac*cpY + frac*frac*endY;
      // stem tangent angle
      const stemAngle = Math.atan2(endY - y, endX - x);
      const leafCol = i < 3 ? C.eucaDark : (i < 5 ? C.eucaMid : C.eucaLight);
      const scale   = 0.7 + frac * 0.5;

      // Left leaf
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(stemAngle - Math.PI * 0.5 + 0.3);
      ctx.beginPath();
      ctx.ellipse(leafW * scale, 0, leafW * scale, leafH * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = leafCol;
      ctx.fill();
      ctx.restore();

      // Right leaf (mirrored)
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(stemAngle + Math.PI * 0.5 - 0.3);
      ctx.beginPath();
      ctx.ellipse(-leafW * scale, 0, leafW * scale, leafH * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = leafCol;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Single oval leaf (ruscus style) ──────────────────────────────
  function drawLeaf(len, w, col) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len*0.35, -w*0.6, -len*0.75, 0, -len);
    ctx.bezierCurveTo( w*0.6, -len*0.75,  w, -len*0.35, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0,   lighten(col, 0.15));
    g.addColorStop(0.5, col);
    g.addColorStop(1,   darken(col, 0.12));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -len*0.82);
    ctx.strokeStyle = darken(col, 0.20);
    ctx.lineWidth   = w * 0.18;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // ── Flower arrangement: large peonies + baby's breath ────────────
  function drawFlowers(cx, cy, t) {
    const s = Math.min(W, H);

    // Main peonies — 4 large ones + 2 medium side ones
    const peonies = [
      // Back row (drawn first)
      { dx: -W*0.17, dy: -H*0.04, sz: s*0.155, rot: -0.18, delay: 0.00, col: C.peonyLight },
      { dx:  W*0.16, dy: -H*0.06, sz: s*0.148, rot:  0.22, delay: 0.02, col: C.peonyMid   },
      // Front centre
      { dx:  0,      dy:  H*0.03, sz: s*0.170, rot:  0.05, delay: 0.06, col: C.peonyMid   },
      // Side accent
      { dx: -W*0.30, dy:  H*0.02, sz: s*0.120, rot: -0.35, delay: 0.10, col: C.peonyLight },
      { dx:  W*0.30, dy:  H*0.00, sz: s*0.115, rot:  0.40, delay: 0.10, col: C.peonyDeep  },
      // Small peony bud bottom
      { dx: -W*0.08, dy:  H*0.09, sz: s*0.090, rot: -0.12, delay: 0.14, col: C.peonyPale  },
      { dx:  W*0.10, dy:  H*0.08, sz: s*0.085, rot:  0.28, delay: 0.14, col: C.peonyMid   },
    ];

    // Baby's breath clusters — scattered throughout
    const babysBreath = [
      { dx: -W*0.38, dy: -H*0.08, spread: s*0.06, delay: 0.20 },
      { dx:  W*0.38, dy: -H*0.06, spread: s*0.06, delay: 0.20 },
      { dx: -W*0.22, dy: -H*0.12, spread: s*0.05, delay: 0.22 },
      { dx:  W*0.24, dy: -H*0.10, spread: s*0.05, delay: 0.22 },
      { dx: -W*0.40, dy:  H*0.04, spread: s*0.05, delay: 0.24 },
      { dx:  W*0.42, dy:  H*0.02, spread: s*0.05, delay: 0.24 },
      { dx: -W*0.12, dy: -H*0.14, spread: s*0.04, delay: 0.26 },
      { dx:  W*0.14, dy: -H*0.13, spread: s*0.04, delay: 0.26 },
      { dx:  W*0.00, dy: -H*0.16, spread: s*0.04, delay: 0.26 },
      { dx: -W*0.28, dy:  H*0.08, spread: s*0.04, delay: 0.28 },
      { dx:  W*0.26, dy:  H*0.10, spread: s*0.04, delay: 0.28 },
    ];

    // Draw back peonies first (indices 0,1)
    [0, 1, 3, 4].forEach(i => {
      const f = peonies[i];
      const ft = clamp((t - f.delay) / 0.52, 0, 1);
      if (ft <= 0) return;
      const pop = ft < 0.85 ? ft : 0.85 + Math.sin((ft - 0.85) / 0.15 * Math.PI) * 0.08;
      ctx.save();
      ctx.globalAlpha = easeOut(ft);
      ctx.translate(cx + f.dx, cy + f.dy);
      ctx.rotate(f.rot);
      ctx.scale(pop, pop);
      drawPeony(f.col, f.sz);
      ctx.restore();
    });

    // Baby's breath (behind front flowers)
    babysBreath.forEach(bb => {
      const bt = clamp((t - bb.delay) / 0.40, 0, 1);
      if (bt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(bt) * 0.92;
      drawBabysBreath(cx + bb.dx, cy + bb.dy, bb.spread);
      ctx.restore();
    });

    // Front peonies (indices 2, 5, 6 — drawn on top)
    [2, 5, 6].forEach(i => {
      const f = peonies[i];
      const ft = clamp((t - f.delay) / 0.52, 0, 1);
      if (ft <= 0) return;
      const pop = ft < 0.85 ? ft : 0.85 + Math.sin((ft - 0.85) / 0.15 * Math.PI) * 0.08;
      ctx.save();
      ctx.globalAlpha = easeOut(ft);
      ctx.translate(cx + f.dx, cy + f.dy);
      ctx.rotate(f.rot);
      ctx.scale(pop, pop);
      drawPeony(f.col, f.sz);
      ctx.restore();
    });
  }

  // ── Realistic peony: many layered curved petals, light center ────
  function drawPeony(col, s) {
    const innerCol  = lighten(col, 0.28);
    const outerCol  = darken(col, 0.08);
    const centerCol = darken(col, 0.15);

    // Outer petals — 5 wide spread petals (back layer)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.1;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -s*0.06);
      ctx.bezierCurveTo(-s*0.42, -s*0.22,  -s*0.52,  s*0.52, 0, s*0.78);
      ctx.bezierCurveTo( s*0.52,  s*0.52,   s*0.42, -s*0.22, 0, -s*0.06);
      const g = ctx.createLinearGradient(0, -s*0.1, 0, s*0.8);
      g.addColorStop(0,   lighten(col, 0.15));
      g.addColorStop(0.5, outerCol);
      g.addColorStop(1,   darken(col, 0.18));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    // Second petal ring — 7 petals, slightly smaller
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - 0.22;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -s*0.04);
      ctx.bezierCurveTo(-s*0.32, -s*0.16,  -s*0.40,  s*0.38, 0, s*0.60);
      ctx.bezierCurveTo( s*0.40,  s*0.38,   s*0.32, -s*0.16, 0, -s*0.04);
      const g = ctx.createLinearGradient(0, -s*0.04, 0, s*0.6);
      g.addColorStop(0,   lighten(col, 0.20));
      g.addColorStop(1,   col);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    // Third ring — 8 upright inner petals
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.38;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -s*0.02);
      ctx.bezierCurveTo(-s*0.20, -s*0.10,  -s*0.25,  s*0.22, 0, s*0.38);
      ctx.bezierCurveTo( s*0.25,  s*0.22,   s*0.20, -s*0.10, 0, -s*0.02);
      ctx.fillStyle = innerCol;
      ctx.fill();
      ctx.restore();
    }

    // Fourth ring — 9 very tight inner petals, nearly upright
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 - 0.10;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-s*0.11, -s*0.06,  -s*0.13, s*0.12, 0, s*0.21);
      ctx.bezierCurveTo( s*0.13,  s*0.12,   s*0.11, -s*0.06, 0, 0);
      ctx.fillStyle = lighten(col, 0.35);
      ctx.fill();
      ctx.restore();
    }

    // Center — small golden stamens glow
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, s*0.14);
    cg.addColorStop(0,   '#fff5cc');
    cg.addColorStop(0.5, '#ffe090');
    cg.addColorStop(1,   lighten(col, 0.30));
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();

    // Tiny stamen dots
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = s * 0.07;
      ctx.beginPath();
      ctx.arc(Math.cos(a)*r, Math.sin(a)*r, s * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c050';
      ctx.fill();
    }
  }

  // ── Baby's breath: branching clusters of tiny white dots ─────────
  function drawBabysBreath(cx, cy, spread) {
    if (spread <= 0) return;
    const branchCount = 6;
    // Fixed offsets per branch (no random — called every frame)
    const lenFracs = [0.7, 0.9, 0.6, 0.85, 0.75, 0.65];
    for (let b = 0; b < branchCount; b++) {
      const baseAngle = (b / branchCount) * Math.PI * 2;
      const blen      = spread * lenFracs[b];
      const bx        = cx + Math.cos(baseAngle) * blen;
      const by        = cy + Math.sin(baseAngle) * blen;

      // Branch stem
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(130,160,110,0.35)';
      ctx.lineWidth   = 0.8;
      ctx.stroke();

      // Tiny flowers at branch tips — fixed offsets, no random
      const dotOffsets = [
        [0, 0, 2.5], [-0.5, 0.5, 2.0], [0.5, 0.4, 1.8],
      ];
      const dotCount = 3;
      for (let d = 0; d < dotCount; d++) {
        const [ox, oy, dr] = dotOffsets[d];
        const dangle = baseAngle + ox * 0.7;
        const dlen   = spread * (0.12 + oy * 0.06);
        const dx     = bx + Math.cos(dangle) * dlen;
        const dy     = by + Math.sin(dangle) * dlen;

        ctx.beginPath();
        ctx.arc(dx, dy, dr, 0, Math.PI * 2);
        ctx.fillStyle = C.babyBreath;
        ctx.fill();
        // Tiny yellow center
        ctx.beginPath();
        ctx.arc(dx, dy, dr * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe8a0';
        ctx.fill();
      }
    }
  }

  // ── Legacy stubs (kept so switch-case in old drawFlowers won't error) ─
  function drawRose(col, s)       { drawPeony(col, s); }
  function drawRanunculus(col, s) { drawPeony(lighten(col, 0.08), s * 0.88); }
  function drawTulip(col, s)      { drawPeony(darken(col, 0.05),  s * 0.82); }
  function drawBlossom(col, s)    {
    for (let i = 0; i < 5; i++) {
      const a = (i/5)*Math.PI*2 - Math.PI*0.5;
      ctx.save();
      ctx.translate(Math.cos(a)*s*0.38, Math.sin(a)*s*0.38);
      ctx.rotate(a + Math.PI*0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, s*0.27, s*0.37, 0, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, s*0.10, 0, Math.PI*2);
    ctx.fillStyle = lighten(col, 0.25); ctx.fill();
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
