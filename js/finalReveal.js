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

    // ── Vertical slot: between the photo frame's bottom edge and the
    //    birthday message's top edge (measured from the real DOM). ──
    const frameEl = document.getElementById('photo-frame');
    const msgEl   = document.getElementById('birthday-message');
    const frameBottom = frameEl.getBoundingClientRect().bottom + 10; // + outline
    const msgTop      = msgEl.getBoundingClientRect().top;
    const slotTop     = frameBottom;
    const slotBottom  = Math.max(msgTop, slotTop + H * 0.06);
    const slotH       = slotBottom - slotTop;

    // Un-scaled bouquet spans roughly 0.18*H vertically around bCY0
    const BOUQUET_H = H * 0.18;
    const k = Math.max(0.30, Math.min(0.55, (slotH * 0.75) / BOUQUET_H));
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
    const replayBtn = document.getElementById('replay-btn');

    // Restyle replay-btn to circular to match the click-me btn
    if (replayBtn) {
      replayBtn.style.cssText += `
        width:62px; height:62px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        padding:0; font-size:1.4rem; line-height:1;
        position:static; bottom:auto; left:auto; transform:none;
        flex-shrink:0;
      `;

      // Move into btn-row if not already there
      const row = document.getElementById('btn-row');
      if (row && replayBtn.parentElement !== row) {
        row.insertBefore(replayBtn, row.firstChild);
      }

      replayBtn.style.pointerEvents = 'auto';
      gsap.fromTo(replayBtn,
        { opacity: 0, scale: 0.72 },
        { opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(2.2)', delay: 1.2 }
      );

      // Also make btn-row visible
      const row2 = document.getElementById('btn-row');
      if (row2) row2.style.pointerEvents = 'none'; // children handle their own
    }
    playIdleMusic();

    // Show the click-me bouquet button shortly after
    if (typeof BouquetPopup !== 'undefined') {
      gsap.delayedCall(1.8, () => BouquetPopup.showButton());
    }
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

  const C = {
    deepRose:   '#c8506a',
    rose:       '#e8749a',
    blush:      '#f4a0b5',
    cream:      '#faf0e0',
    white:      '#fff8f8',
    lavender:   '#d8c0d8',
    peach:      '#f5c8a8',
    leafDark:   '#5a7a3a',
    leafMid:    '#7a9c5a',
    leafLight:  '#8aac6a',
    wrapBase:   '#fff0f3',
    wrapSheen:  '#ffe8ee',
    wrapShadow: '#f0c8d8',
    ribbonGold: '#d4af6a',
    ribbonHi:   '#f0d090',
    ribbonSha:  '#a87840',
  };

  function init() {
    injectDOM();
    const btn = document.getElementById('click-me-btn');
    if (btn) btn.addEventListener('click', open);
  }

  function injectDOM() {
    if (!document.getElementById('click-me-btn')) {
      // Wrap both buttons in a flex row container
      let row = document.getElementById('btn-row');
      if (!row) {
        row = document.createElement('div');
        row.id = 'btn-row';
        row.style.cssText = `
          position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
          z-index:60; display:flex; align-items:center; gap:18px;
          pointer-events:none;
        `;
        document.body.appendChild(row);

        // Move existing replay-btn inside the row if it exists
        const existingReplay = document.getElementById('replay-btn');
        if (existingReplay) {
          existingReplay.style.position = 'static';
          existingReplay.style.transform = 'none';
          existingReplay.style.bottom    = 'auto';
          existingReplay.style.left      = 'auto';
          row.appendChild(existingReplay);
        }
      }

      // Inject CSS keyframes for heartbeat once
      if (!document.getElementById('heartbeat-style')) {
        const style = document.createElement('style');
        style.id = 'heartbeat-style';
        style.textContent = `
          @keyframes hb-beat {
            0%   { transform: scale(1); }
            8%   { transform: scale(1.18); }
            16%  { transform: scale(1); }
            24%  { transform: scale(1.14); }
            32%  { transform: scale(1); }
            100% { transform: scale(1); }
          }
          #click-me-btn.hb-1 { animation: hb-beat 2.8s ease-in-out 1; }
          @keyframes hb-beat2 {
            0%   { transform: scale(1); }
            7%   { transform: scale(1.18); }
            14%  { transform: scale(1); }
            22%  { transform: scale(1.14); }
            29%  { transform: scale(1); }
            38%  { transform: scale(1.16); }
            45%  { transform: scale(1); }
            100% { transform: scale(1); }
          }
          #click-me-btn.hb-2 { animation: hb-beat2 3.2s ease-in-out 1; }
          @keyframes hb-beat3 {
            0%   { transform: scale(1); }
            6%   { transform: scale(1.18); }
            12%  { transform: scale(1); }
            19%  { transform: scale(1.14); }
            25%  { transform: scale(1); }
            33%  { transform: scale(1.16); }
            39%  { transform: scale(1); }
            47%  { transform: scale(1.12); }
            53%  { transform: scale(1); }
            100% { transform: scale(1); }
          }
          #click-me-btn.hb-3 { animation: hb-beat3 3.6s ease-in-out 1; }
        `;
        document.head.appendChild(style);
      }

      const CIRCLE_SIZE = '62px';
      const btn = document.createElement('button');
      btn.id = 'click-me-btn';
      btn.innerHTML = '💕';
      btn.title = 'Click me!';
      btn.style.cssText = `
        width:${CIRCLE_SIZE}; height:${CIRCLE_SIZE};
        font-size:1.55rem; line-height:1;
        display:flex; align-items:center; justify-content:center;
        background:linear-gradient(135deg,#fff0f3 0%,#ffe4ec 50%,#fff0f3 100%);
        border:2px solid #d4af6a; border-radius:50%;
        box-shadow:0 2px 18px rgba(200,80,106,0.22), 0 0 0 1px rgba(212,175,106,0.28) inset;
        cursor:pointer; opacity:0; pointer-events:none;
        transition:opacity .5s ease, box-shadow .18s ease;
        flex-shrink:0;
      `;
      btn.onmouseenter = () => {
        btn.style.boxShadow = '0 4px 28px rgba(200,80,106,0.35), 0 0 0 1px rgba(212,175,106,0.40) inset';
      };
      btn.onmouseleave = () => {
        btn.style.boxShadow = '0 2px 18px rgba(200,80,106,0.22), 0 0 0 1px rgba(212,175,106,0.28) inset';
      };
      row.appendChild(btn);

      // Heartbeat scheduler — random pattern: 1, 2 or 3 beats, slow organic pacing
      let hbTimer = null;
      function scheduleHeartbeat() {
        const waitMs = 2800 + Math.random() * 3200; // 2.8–6s between pulses
        hbTimer = setTimeout(() => {
          if (!document.getElementById('click-me-btn')) return;
          const beats = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
          btn.classList.remove('hb-1','hb-2','hb-3');
          void btn.offsetWidth; // reflow to restart animation
          btn.classList.add(`hb-${beats}`);
          const animDur = beats === 1 ? 2800 : beats === 2 ? 3200 : 3600;
          hbTimer = setTimeout(scheduleHeartbeat, animDur + 400);
        }, waitMs);
      }
      btn._startHeartbeat = () => scheduleHeartbeat();
      row.style.pointerEvents = 'none'; // controlled per-button
    }

    if (!document.getElementById('bouquet-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'bouquet-overlay';
      ov.style.cssText = `
        position:fixed; inset:0; z-index:200;
        display:flex; align-items:center; justify-content:center;
        background:rgba(30,10,18,0.72); backdrop-filter:blur(6px);
        opacity:0; pointer-events:none; transition:opacity .35s ease;
      `;

      const card = document.createElement('div');
      card.id = 'bouquet-card';
      card.style.cssText = `
        position:relative; width:min(92vw,420px);
        background:linear-gradient(160deg,#fff8fb 0%,#ffeef4 60%,#fff5e8 100%);
        border:2px solid rgba(212,175,106,0.55); border-radius:24px;
        box-shadow:0 8px 48px rgba(200,80,106,0.22), 0 2px 12px rgba(212,175,106,0.18);
        overflow:hidden; transform:scale(.88) translateY(24px);
        transition:transform .4s cubic-bezier(.34,1.56,.64,1), opacity .35s ease;
        opacity:0;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.id = 'bouquet-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = `
        position:absolute; top:12px; right:16px; z-index:5;
        background:none; border:none; font-size:1.7rem; line-height:1;
        color:#c8506a; cursor:pointer; opacity:.7; padding:4px 8px;
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
        font-size:.95rem; color:#c8506a; font-style:italic;
        letter-spacing:.02em; opacity:.85;
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
    btn.style.opacity       = '1';
    btn.style.pointerEvents = 'auto';
    // Start the organic heartbeat loop
    if (typeof btn._startHeartbeat === 'function') btn._startHeartbeat();
  }

  function open() {
    overlay = document.getElementById('bouquet-overlay');
    canvas  = document.getElementById('bouquet-popup-canvas');
    if (!overlay || !canvas) return;

    const cardW = Math.min(window.innerWidth * 0.84, 360);
    const cardH = Math.round(cardW * 1.05);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cardW; H = cardH;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = cardH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    phase = 1; bloomT = 0; bloomStart = performance.now();
    particles = spawnSparkles();

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
    if (card) { card.style.opacity='0'; card.style.transform='scale(.88) translateY(24px)'; }
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

  // ── Master bouquet layout (Korean-style: wide kraft wrap, white collar, peonies + baby's breath) ──
  function drawBouquet(t) {
    const cx = W * 0.50;
    // Bouquet sits in upper 55% of canvas; smaller and higher up
    const flowerCY = H * 0.34;
    const wrapTopY = H * 0.44;  // where the wrap collar starts

    drawKraftWrap(cx, wrapTopY, t);
    drawWhiteCollar(cx, wrapTopY, t);
    drawEucalyptus(cx, flowerCY, t);
    drawBabysBreath(cx, flowerCY, t);
    drawPeonies(cx, flowerCY, t);
    drawPinkRibbon(cx, wrapTopY + (H - wrapTopY) * 0.28, t);
  }

  // ── Pink kraft paper wrap — wide fan of overlapping sheets ──────────
  function drawKraftWrap(cx, topY, t) {
    const ea = easeOut(clampB(t / 0.5, 0, 1));
    ctx.save();
    ctx.globalAlpha = ea;

    const bottomY = H * 0.90;
    // Fan: 7 sheets angled outward like in the reference
    const sheets = [
      { angle: -0.50, wTop: W*0.09, wBot: W*0.055 },
      { angle: -0.28, wTop: W*0.10, wBot: W*0.062 },
      { angle: -0.10, wTop: W*0.11, wBot: W*0.068 },
      { angle:  0.00, wTop: W*0.12, wBot: W*0.072 },
      { angle:  0.10, wTop: W*0.11, wBot: W*0.068 },
      { angle:  0.28, wTop: W*0.10, wBot: W*0.062 },
      { angle:  0.50, wTop: W*0.09, wBot: W*0.055 },
    ];

    // Pink kraft base colour: muted dusty rose, same as reference
    const KRAFT      = '#f2cac9';
    const KRAFT_DARK = '#dba8a5';
    const KRAFT_LIGHT= '#fde8e6';
    const GOLD_EDGE  = 'rgba(210,180,100,0.70)';

    sheets.forEach((sh, si) => {
      ctx.save();
      ctx.translate(cx, topY);
      ctx.rotate(sh.angle);

      // Sheet body
      const hw = sh.wTop / 2;
      const hb = sh.wBot / 2;
      const len = bottomY - topY;
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.lineTo( hw, 0);
      ctx.lineTo( hb, len);
      ctx.lineTo(-hb, len);
      ctx.closePath();

      const g = ctx.createLinearGradient(-hw, 0, hw, 0);
      const shade = si < 3 ? KRAFT_DARK : si === 3 ? KRAFT : KRAFT_LIGHT;
      g.addColorStop(0,   darkenB(shade, 0.08));
      g.addColorStop(0.3, lightenB(shade, 0.10));
      g.addColorStop(0.7, shade);
      g.addColorStop(1,   darkenB(shade, 0.06));
      ctx.fillStyle = g;
      ctx.fill();

      // Gold edge line on left side of each sheet (signature detail from reference)
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.lineTo(-hb, len);
      ctx.strokeStyle = GOLD_EDGE;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Subtle fold shadow
      ctx.beginPath();
      ctx.moveTo(-hw*0.3, 0);
      ctx.lineTo(-hb*0.3, len);
      ctx.strokeStyle = 'rgba(180,120,115,0.12)';
      ctx.lineWidth   = hw * 0.5;
      ctx.stroke();

      ctx.restore();
    });

    // Gold curl ribbons on outer edges (reference has curling gold ribbon strips)
    const curlCols = [
      { x: cx - W*0.36, startY: topY + H*0.02, flip: false },
      { x: cx + W*0.34, startY: topY + H*0.02, flip: true  },
      { x: cx - W*0.24, startY: topY + H*0.06, flip: false },
      { x: cx + W*0.22, startY: topY + H*0.06, flip: true  },
    ];
    curlCols.forEach(c => drawGoldCurl(c.x, c.startY, c.flip, ea));

    ctx.restore();
  }

  function drawGoldCurl(x, y, flip, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = '#c8a84a';
    ctx.lineWidth   = 1.4;
    ctx.lineCap     = 'round';
    const dir = flip ? 1 : -1;
    // Draw a wavy curl descending
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      const cy1 = y + i * H*0.04 + H*0.015;
      const cy2 = y + i * H*0.04 + H*0.035;
      const cx1 = x + dir * W*0.04;
      const cx2 = x - dir * W*0.04;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy1, x, cy2);
      ctx.bezierCurveTo(cx1, cy2 + H*0.005, cx1, cy2 + H*0.02, x + dir*W*0.02, y + (i+1)*H*0.04);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── White tissue collar — ruffled inner wrap just below the flowers ─
  function drawWhiteCollar(cx, topY, t) {
    const ea = easeOut(clampB(t / 0.45, 0, 1));
    ctx.save();
    ctx.globalAlpha = ea * 0.92;

    const collarW = W * 0.62;
    const collarH = H * 0.14;

    // 5 overlapping rounded petals of white tissue paper
    for (let i = 0; i < 5; i++) {
      const angle = (i / 4 - 0.5) * 0.90; // spread -0.45 to +0.45 rad
      ctx.save();
      ctx.translate(cx, topY);
      ctx.rotate(angle);

      const pw = collarW * 0.28;
      const ph = collarH * 0.95;

      ctx.beginPath();
      ctx.moveTo(-pw*0.5, 0);
      ctx.bezierCurveTo(-pw*0.8, -ph*0.4, -pw*0.8, -ph*0.9,  0, -ph);
      ctx.bezierCurveTo( pw*0.8, -ph*0.9,  pw*0.8, -ph*0.4,  pw*0.5, 0);
      ctx.closePath();

      const g = ctx.createLinearGradient(-pw*0.4, 0, pw*0.4, 0);
      g.addColorStop(0,   'rgba(245,235,238,0.90)');
      g.addColorStop(0.5, 'rgba(255,252,253,0.95)');
      g.addColorStop(1,   'rgba(240,230,235,0.85)');
      ctx.fillStyle = g;
      ctx.fill();

      // Subtle tissue edge
      ctx.strokeStyle = 'rgba(210,190,195,0.35)';
      ctx.lineWidth   = 0.8;
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  // ── Eucalyptus sprigs — tall wispy greenery poking above peonies ─────
  function drawEucalyptus(cx, cy, t) {
    const ea = easeOut(clampB(t / 0.55, 0, 1));
    const sprigs = [
      { dx: -W*0.10, dy: -H*0.02, angle: -0.18, len: H*0.20 },
      { dx:  W*0.09, dy: -H*0.00, angle:  0.14, len: H*0.18 },
      { dx: -W*0.20, dy:  H*0.03, angle: -0.30, len: H*0.16 },
      { dx:  W*0.18, dy:  H*0.02, angle:  0.28, len: H*0.17 },
    ];

    sprigs.forEach((sp, si) => {
      const lt = clampB((t - si*0.04) / 0.50, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.88;
      ctx.translate(cx + sp.dx, cy + sp.dy);
      ctx.rotate(sp.angle);
      ctx.scale(lt, lt);
      drawEucalyptusSprig(sp.len);
      ctx.restore();
    });
  }

  function drawEucalyptusSprig(len) {
    const stemCol  = '#7a9878';
    const leafCol  = '#8aaa80';
    const leafCol2 = '#a0bc96';
    // Stem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.strokeStyle = stemCol;
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Tiny round eucalyptus leaves alternating sides
    const leafCount = 9;
    for (let i = 0; i < leafCount; i++) {
      const frac = i / (leafCount - 1);
      const y    = -len * (0.12 + frac * 0.82);
      const side = i % 2 === 0 ? 1 : -1;
      const lw   = len * 0.065 * (1 - frac * 0.3);
      const lh   = len * 0.052 * (1 - frac * 0.3);
      ctx.save();
      ctx.translate(side * len * 0.045, y);
      ctx.rotate(side * 0.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, lw, lh, 0, 0, Math.PI*2);
      ctx.fillStyle = i % 3 === 0 ? leafCol2 : leafCol;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Baby's breath — tiny white cloud clusters ────────────────────────
  function drawBabysBreath(cx, cy, t) {
    const clusters = [
      { dx: -W*0.15, dy: -H*0.04, count: 22, r: W*0.075 },
      { dx:  W*0.13, dy: -H*0.02, count: 18, r: W*0.065 },
      { dx:  W*0.02, dy:  H*0.00, count: 16, r: W*0.055 },
      { dx: -W*0.07, dy:  H*0.02, count: 14, r: W*0.048 },
      { dx:  W*0.22, dy:  H*0.01, count: 10, r: W*0.038 },
      { dx: -W*0.24, dy:  H*0.03, count:  9, r: W*0.035 },
    ];

    // Seeded positions so they don't move each frame
    if (!drawBabysBreath._seeds) {
      drawBabysBreath._seeds = clusters.map(cl =>
        Array.from({length: cl.count}, () => ({
          ax: (Math.random()-0.5)*2,
          ay: (Math.random()-0.5)*2,
          sz: 0.012 + Math.random()*0.018,
        }))
      );
    }

    clusters.forEach((cl, ci) => {
      const lt = clampB((t - ci*0.05) / 0.45, 0, 1);
      if (lt <= 0) return;
      ctx.save();
      ctx.globalAlpha = easeOut(lt) * 0.90;
      const seeds = drawBabysBreath._seeds[ci];
      seeds.forEach(s => {
        const bx = cx + cl.dx + s.ax * cl.r;
        const by = cy + cl.dy + s.ay * cl.r * 0.7;
        const br = W * s.sz * lt;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI*2);
        ctx.fillStyle = s.ay < 0 ? '#fff8f8' : '#f5f0f2';
        ctx.fill();
      });
      ctx.restore();
    });
  }
  drawBabysBreath._seeds = null;

  // ── Peonies — 6 big blooms like in the reference ─────────────────────
  function drawPeonies(cx, cy, t) {
    const s = Math.min(W, H);
    // Reference: 6 big hot-pink/blush peonies arranged in a slightly arced cluster
    const peonies = [
      // back row (drawn first, slightly higher and smaller)
      { dx: -W*0.18, dy: -H*0.06, sz: s*0.110, rot: -0.20, col: '#e87098', delay: 0.05 },
      { dx:  W*0.00, dy: -H*0.09, sz: s*0.115, rot:  0.10, col: '#f090b0', delay: 0.08 },
      { dx:  W*0.19, dy: -H*0.06, sz: s*0.108, rot:  0.22, col: '#e06888', delay: 0.05 },
      // front row (bigger, lower, more prominent)
      { dx: -W*0.22, dy:  H*0.02, sz: s*0.122, rot: -0.15, col: '#e87098', delay: 0.18 },
      { dx:  W*0.01, dy:  H*0.01, sz: s*0.132, rot:  0.05, col: '#f090b8', delay: 0.22 },
      { dx:  W*0.22, dy:  H*0.02, sz: s*0.118, rot:  0.18, col: '#d86080', delay: 0.18 },
    ];

    peonies.forEach(p => {
      const ft = clampB((t - p.delay) / 0.48, 0, 1);
      if (ft <= 0) return;
      const pop = ft < 0.82 ? ft : 0.82 + Math.sin((ft-0.82)/0.18*Math.PI)*0.10;
      ctx.save();
      ctx.globalAlpha = easeOut(ft);
      ctx.translate(cx + p.dx, cy + p.dy);
      ctx.rotate(p.rot);
      ctx.scale(pop, pop);
      drawKoreanPeony(p.col, p.sz);
      ctx.restore();
    });
  }

  // Korean-style fluffy peony: many ruffled petals in concentric rings
  function drawKoreanPeony(col, s) {
    const rings = [
      { cnt: 12, r: 0.92, pw: 0.32, ph: 0.44, col: darkenB(col, 0.08) },
      { cnt: 10, r: 0.72, pw: 0.30, ph: 0.40, col: col },
      { cnt:  9, r: 0.54, pw: 0.27, ph: 0.36, col: lightenB(col, 0.10) },
      { cnt:  7, r: 0.36, pw: 0.23, ph: 0.30, col: lightenB(col, 0.20) },
      { cnt:  5, r: 0.20, pw: 0.18, ph: 0.22, col: lightenB(col, 0.30) },
    ];

    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.cnt; i++) {
        const a = (i / ring.cnt) * Math.PI * 2 + ri * 0.18;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        // Ruffled petal — wider and rounder than a tulip, with a slight notch at tip
        const px = 0, py = -s * ring.r;
        const hw = s * ring.pw * 0.5;
        const hh = s * ring.ph * 0.5;
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-hw*1.1, py*0.35, -hw*1.0, py*0.75, -hw*0.5, py - hh*0.1);
        ctx.bezierCurveTo(-hw*0.2, py - hh*0.35, hw*0.2, py - hh*0.35, hw*0.5, py - hh*0.1);
        ctx.bezierCurveTo( hw*1.0, py*0.75,  hw*1.1, py*0.35, 0, 0);
        ctx.closePath();

        const g = ctx.createLinearGradient(-hw, py*0.5, hw, py*0.5);
        g.addColorStop(0,   darkenB(ring.col, 0.05));
        g.addColorStop(0.5, lightenB(ring.col, 0.08));
        g.addColorStop(1,   darkenB(ring.col, 0.05));
        ctx.fillStyle = g;
        ctx.globalAlpha *= 0.92;
        ctx.fill();
        ctx.restore();
      }
    });

    // Centre button
    ctx.beginPath();
    ctx.arc(0, 0, s*0.10, 0, Math.PI*2);
    ctx.fillStyle = lightenB(col, 0.45);
    ctx.fill();
    // Tiny stamens
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      ctx.beginPath();
      ctx.arc(Math.cos(a)*s*0.07, Math.sin(a)*s*0.07, s*0.018, 0, Math.PI*2);
      ctx.fillStyle = '#ffe090';
      ctx.fill();
    }
  }

  // ── Pink satin ribbon + bow — matches reference exactly ─────────────
  function drawPinkRibbon(cx, y, t) {
    const ea = easeOut(clampB((t - 0.3) / 0.4, 0, 1));
    if (ea <= 0) return;

    const ribbonW = W * 0.13;
    const ribbonH = H * 0.22;
    const PINK_RIBBON      = '#e8a0b0';
    const PINK_RIBBON_DARK = '#c07888';
    const PINK_RIBBON_HI   = '#f5c8d4';

    ctx.save();
    ctx.globalAlpha = ea;

    // Two ribbon strips crossing in the middle (like reference)
    [[-0.18, 0.10], [0.18, -0.10]].forEach(([rot, dx]) => {
      ctx.save();
      ctx.translate(cx + dx * W * 0.5, y);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-ribbonW*0.5, 0, ribbonW*0.5, 0);
      g.addColorStop(0,   PINK_RIBBON_DARK);
      g.addColorStop(0.35, PINK_RIBBON);
      g.addColorStop(0.65, PINK_RIBBON_HI);
      g.addColorStop(1,   PINK_RIBBON_DARK);
      ctx.beginPath();
      ctx.moveTo(-ribbonW*0.5, -ribbonH*0.5);
      ctx.lineTo( ribbonW*0.5, -ribbonH*0.5);
      ctx.lineTo( ribbonW*0.38, ribbonH*0.5);
      ctx.lineTo(-ribbonW*0.38, ribbonH*0.5);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      // Sheen line
      ctx.beginPath();
      ctx.moveTo(ribbonW*0.12, -ribbonH*0.5);
      ctx.lineTo(ribbonW*0.10,  ribbonH*0.5);
      ctx.strokeStyle = PINK_RIBBON_HI;
      ctx.lineWidth   = ribbonW * 0.12;
      ctx.globalAlpha = ea * 0.45;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    });

    // Satin bow loops
    const bowR = W * 0.095;
    drawPinkBow(cx, y - ribbonH*0.08, bowR, ea, PINK_RIBBON, PINK_RIBBON_DARK, PINK_RIBBON_HI);

    ctx.restore();
  }

  function drawPinkBow(cx, cy, r, alpha, col, dark, hi) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const drawLoop = flip => {
      ctx.save();
      if (flip) { ctx.scale(-1, 1); }
      ctx.translate(flip ? -cx : cx, cy);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r*0.9, -r*0.5,  -r*2.1, -r*0.75, -r*1.9,  r*0.08);
      ctx.bezierCurveTo(-r*1.7,  r*0.52, -r*0.5,  r*0.28,  0, 0);
      const g = ctx.createRadialGradient(-r*0.85, -r*0.28, 0, -r*0.85, -r*0.28, r*1.05);
      g.addColorStop(0,   hi);
      g.addColorStop(0.4, col);
      g.addColorStop(1,   dark);
      ctx.fillStyle = g;
      ctx.fill();
      // Sheen
      ctx.beginPath();
      ctx.moveTo(-r*0.15, -r*0.04);
      ctx.bezierCurveTo(-r*0.55, -r*0.50, -r*1.2, -r*0.65, -r*1.55, r*0.02);
      ctx.strokeStyle = hi;
      ctx.lineWidth   = r * 0.12;
      ctx.globalAlpha = alpha * 0.50;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };
    drawLoop(false);
    drawLoop(true);

    // Centre knot
    ctx.globalAlpha = alpha;
    const kg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*0.30);
    kg.addColorStop(0, hi); kg.addColorStop(0.5, col); kg.addColorStop(1, dark);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI*2);
    ctx.fillStyle = kg;
    ctx.fill();

    // Ribbon tails
    [[ 0.30, 0.90, 0.60, 1.15], [-0.30, 0.90, -0.58, 1.15]].forEach(([x2,y2,x3,y3]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + r*x2, cy + r*y2, cx + r*x3, cy + r*y3);
      ctx.lineWidth   = r * 0.26;
      ctx.strokeStyle = col;
      ctx.globalAlpha = alpha * 0.90;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth   = r * 0.08;
      ctx.strokeStyle = hi;
      ctx.globalAlpha = alpha * 0.45;
      ctx.stroke();
    });

    ctx.restore();
  }

  function spawnSparkles() {
    const ps=[], cx=W*0.5, cy=H*0.42;
    const cols=['#fff8e1','#ffe9a8','#ffd6e5','#ffffff','#ffc2d6','#d4af6a'];
    for (let i=0;i<55;i++) {
      const angle=Math.random()*Math.PI*2, speed=1.2+Math.random()*2.8;
      ps.push({ x:cx,y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-1.2,
        r:1.5+Math.random()*3.0, col:cols[Math.floor(Math.random()*cols.length)],
        life:1.0, decay:0.012+Math.random()*0.018 });
    }
    return ps;
  }

  function updateParticles(elapsed) {
    if (elapsed < 100) return;
    particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.life-=p.decay; });
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save(); ctx.globalAlpha=p.life*0.9;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.col; ctx.fill(); ctx.restore();
    });
  }

  function playOpenChime() {
    try {
      const Ctx = window._audioContext ||
        (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      if (!Ctx) return;
      if (Ctx.state==='suspended') Ctx.resume();
      const master=Ctx.createGain(); master.gain.value=0.22; master.connect(Ctx.destination);
      const now=Ctx.currentTime;
      [523.25,659.25,783.99,1046.50].forEach((freq,i)=>{
        const d=i*0.10;
        ['sine','triangle'].forEach((type,j)=>{
          const osc=Ctx.createOscillator(), env=Ctx.createGain();
          osc.type=type; osc.frequency.value=freq;
          const vol=j===0?0.55:0.18;
          env.gain.setValueAtTime(0,now+d);
          env.gain.linearRampToValueAtTime(vol,now+d+0.025);
          env.gain.exponentialRampToValueAtTime(0.001,now+d+2.2);
          osc.connect(env); env.connect(master);
          osc.start(now+d); osc.stop(now+d+2.3);
        });
      });
      [1318.51,1567.98,1760.00].forEach((freq,i)=>{
        const d=0.42+i*0.10, osc=Ctx.createOscillator(), env=Ctx.createGain();
        osc.type='sine'; osc.frequency.value=freq;
        env.gain.setValueAtTime(0,now+d);
        env.gain.linearRampToValueAtTime(0.06,now+d+0.02);
        env.gain.exponentialRampToValueAtTime(0.001,now+d+1.2);
        osc.connect(env); env.connect(master);
        osc.start(now+d); osc.stop(now+d+1.3);
      });
    } catch(e) {}
  }

  function hexToRgbB(h) {
    h=h.replace('#','');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }
  function toHexB(r,g,b) {
    return '#'+[r,g,b].map(v=>Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  function lightenB(hex,a) { const[r,g,b]=hexToRgbB(hex); return toHexB(r+(255-r)*a,g+(255-g)*a,b+(255-b)*a); }
  function darkenB(hex,a)  { const[r,g,b]=hexToRgbB(hex); return toHexB(r*(1-a),g*(1-a),b*(1-a)); }
  function clampB(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }
  function easeOut(t)      { return 1-(1-t)*(1-t); }

  return { init, showButton, open, close };

})();
