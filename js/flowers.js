/**
 * flowers.js  ── UPGRADED v2  (bigger · blooming · radial spread)
 * ─────────────────────────────────────────────────────────────────
 * After the mail opens, a bloom-flash erupts from the center of the
 * screen and a circular shockwave spreads outward. Giant flowers
 * burst open ring-by-ring right as the wave passes them, each with
 * a glowing halo, a "pop" when fully open, and a puff of sparkles.
 *
 * What changed vs v1:
 *  - Flowers are ~2.5x larger (scaled to the screen size)
 *  - Bloom effects: halo glow, scale-up while opening, bloom "pop",
 *    gentle breathing, sparkle/pollen burst at full bloom
 *  - Spawn pattern: concentric rings expanding from the center,
 *    timed to a visible circular ripple, with a soft swirl motion
 */

const FlowerScene = (() => {

  // ── Canvas ──────────────────────────────────────────────────────
  let canvas = null, ctx = null, dpr = 1, W = 0, H = 0;

  // ── State ───────────────────────────────────────────────────────
  let flowers       = [];
  let particles     = [];
  let rafId         = null;
  let running       = false;
  let startTime     = 0;
  let lastNow       = 0;
  let spawnSchedule = [];
  let maxR          = 0;     // distance from center to farthest corner
  let sizeBase      = 60;    // base flower size, scaled to screen

  const SPAWN_WINDOW = 3800;                 // ms — wave travels center → corners
  const HOLD         = 2400;                 // ms at peak before handing off
  const BLOOM_DUR    = SPAWN_WINDOW + HOLD;
  const WAVE_MS      = SPAWN_WINDOW * 0.85;  // time for the ripple to reach the edge
  const MAX_FLOWERS  = 150;                  // performance cap

  // ── Palette — romantic blush / rose / petal tones ──────────────
  const PALETTES = {
    rose:     ['#e8748a', '#f4a0b0', '#c85070', '#fde8ef', '#ffc0cb'],
    peony:    ['#f48fb1', '#f06292', '#ec407a', '#fce4ec', '#f8bbd9'],
    blossom:  ['#ffd7e8', '#ffb3d1', '#ff8fab', '#ffc8d8', '#ffe4f0'],
    ranunculus:['#f9a8c0', '#f472a0', '#e8648a', '#fbd0df', '#fcecf2'],
    magnolia: ['#fef0e8', '#f9d8c8', '#f0b8a0', '#fce8e0', '#fff5f0'],
  };

  const TYPES = ['rose', 'peony', 'blossom', 'ranunculus', 'magnolia'];

  // Real petal counts (must match what each draw function renders)
  const PETAL_COUNTS = { rose: 25, peony: 34, blossom: 5, ranunculus: 42, magnolia: 9 };

  const SPARKLE_COLORS = ['#fff8e1', '#ffe9a8', '#ffd6e5', '#ffffff', '#ffc2d6'];

  // ── Public init ─────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('flower-canvas');
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    SceneController.register('scene-flowers', onEnter);
  }

  function resize() {
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

  // ── Scene enter (fires right after the mail opens) ──────────────
  function onEnter() {
    clear();
    flowers       = [];
    particles     = [];
    spawnSchedule = [];
    startTime     = performance.now();
    lastNow       = startTime;

    buildSpawnSchedule();
    startLoop();

    gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' });

    // Play the magical bloom sound
    playBloomSound();

    gsap.delayedCall(BLOOM_DUR / 1000, onBloomComplete);
  }

  // ── Bloom sound — magical rising chord + sparkle tones ──────────
  // Synthesized with Web Audio API: no file needed.
  // Uses the AudioContext already unlocked by the envelope tap.
  function playBloomSound() {
    try {
      const Ctx = window._audioContext ||
        (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      if (!Ctx) return;
      if (Ctx.state === 'suspended') Ctx.resume();

      const master = Ctx.createGain();
      master.gain.value = 0.28;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;

      // ── 1a. First rising arpeggio — C4, E4, G4, C5, E5 ─────────
      const ARP = [261.63, 329.63, 392.00, 523.25, 659.25];
      ARP.forEach((freq, i) => {
        const delay = i * 0.18;
        ['sine', 'triangle'].forEach((type, j) => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          const vol = j === 0 ? 0.55 : 0.22;
          env.gain.setValueAtTime(0, now + delay);
          env.gain.linearRampToValueAtTime(vol, now + delay + 0.04);
          env.gain.exponentialRampToValueAtTime(0.001, now + delay + 3.2);
          osc.connect(env); env.connect(master);
          osc.start(now + delay); osc.stop(now + delay + 3.3);
        });
      });

      // ── 1b. Second arpeggio wave — starts at 3.0s, goes higher ──
      const ARP2 = [392.00, 523.25, 659.25, 783.99, 1046.50];
      ARP2.forEach((freq, i) => {
        const delay = 3.0 + i * 0.20;
        ['sine', 'triangle'].forEach((type, j) => {
          const osc = Ctx.createOscillator();
          const env = Ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          const vol = j === 0 ? 0.40 : 0.16;
          env.gain.setValueAtTime(0, now + delay);
          env.gain.linearRampToValueAtTime(vol, now + delay + 0.04);
          env.gain.exponentialRampToValueAtTime(0.001, now + delay + 3.5);
          osc.connect(env); env.connect(master);
          osc.start(now + delay); osc.stop(now + delay + 3.6);
        });
      });

      // ── 2. Sustained lush pad — holds the whole 9 seconds ───────
      const PAD = [130.81, 164.81, 196.00, 261.63];
      PAD.forEach((freq) => {
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.18, now + 0.6);
        env.gain.setValueAtTime(0.18, now + 6.0);
        env.gain.exponentialRampToValueAtTime(0.001, now + 9.2);
        osc.connect(env); env.connect(master);
        osc.start(now); osc.stop(now + 9.3);
      });

      // ── 3. Sparkle shimmer — two waves ──────────────────────────
      const SPARKLE = [1046.50, 1318.51, 1567.98, 2093.00];
      // First wave
      SPARKLE.forEach((freq, i) => {
        const delay = 0.35 + i * 0.22;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + delay);
        env.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.5);
        osc.connect(env); env.connect(master);
        osc.start(now + delay); osc.stop(now + delay + 1.6);
      });
      // Second wave at 4.5s
      SPARKLE.forEach((freq, i) => {
        const delay = 4.5 + i * 0.20;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq * 1.5;
        env.gain.setValueAtTime(0, now + delay);
        env.gain.linearRampToValueAtTime(0.06, now + delay + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.8);
        osc.connect(env); env.connect(master);
        osc.start(now + delay); osc.stop(now + delay + 1.9);
      });

      // ── 4. Slow string layer — soft high tones, bloom from 1.5s ─
      const STRINGS = [523.25, 659.25, 783.99, 880.00];
      STRINGS.forEach((freq, i) => {
        const delay = 1.5 + i * 0.35;
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + delay);
        env.gain.linearRampToValueAtTime(0.10, now + delay + 0.8);
        env.gain.setValueAtTime(0.10, now + delay + 3.5);
        env.gain.exponentialRampToValueAtTime(0.001, now + delay + 6.0);
        osc.connect(env); env.connect(master);
        osc.start(now + delay); osc.stop(now + delay + 6.1);
      });

      // ── 4. Bloom "pop" — soft percussive thud at center ─────────
      const pop = Ctx.createOscillator();
      const popEnv = Ctx.createGain();
      pop.type = 'sine';
      pop.frequency.setValueAtTime(180, now);
      pop.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      popEnv.gain.setValueAtTime(0.45, now);
      popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      pop.connect(popEnv);
      popEnv.connect(master);
      pop.start(now);
      pop.stop(now + 0.25);

    } catch(e) {
      console.warn('Bloom sound unavailable:', e.message);
    }
  }

  // ── Spawn schedule: concentric rings spreading from the center ──
  function buildSpawnSchedule() {
    sizeBase = clamp(Math.min(W, H) * 0.09, 38, 82);
    maxR     = Math.hypot(W, H) * 0.5;

    const cx = W * 0.5, cy = H * 0.5;
    const ringGap = sizeBase * 1.45;   // distance between rings
    const spacing = sizeBase * 1.85;   // distance between flowers on a ring
    const margin  = sizeBase + 90;     // allow slightly off-screen (swirl drift)

    const hero = makeDef(0, rand(0, Math.PI * 2), sizeBase * 1.9);
    hero.type    = 'rose';
    hero.petalCount = PETAL_COUNTS.rose;
    hero.t       = 0;
    const list = [];

    for (let r = ringGap; r < maxR + sizeBase * 0.5; r += ringGap) {
      const n      = Math.max(5, Math.round((Math.PI * 2 * r) / spacing));
      const offset = rand(0, Math.PI * 2);

      for (let i = 0; i < n; i++) {
        const rr  = r + rand(-ringGap * 0.22, ringGap * 0.22);
        const ang = offset + (i / n) * Math.PI * 2 + rand(-0.06, 0.06);
        const x   = cx + Math.cos(ang) * rr;
        const y   = cy + Math.sin(ang) * rr;
        if (x < -margin || x > W + margin || y < -margin || y > H + margin) continue;

        list.push(makeDef(rr, ang, sizeBase * rand(0.8, 1.45)));
      }
    }

    // Performance cap — thin out randomly, keep the hero
    while (list.length > MAX_FLOWERS - 1) {
      list.splice(Math.floor(Math.random() * list.length), 1);
    }

    spawnSchedule = [hero, ...list];
    spawnSchedule.sort((a, b) => a.t - b.t);
  }

  function makeDef(r, ang, size) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const pal  = PALETTES[type];
    return {
      // Spawn exactly when the circular ripple reaches this radius
      t:       (r / maxR) * WAVE_MS + rand(0, 140),
      r, ang,
      swirl:   rand(0.16, 0.30),            // gentle clockwise drift (radians)
      type,
      color:   pal[Math.floor(Math.random() * pal.length)],
      accent:  pal[Math.floor(Math.random() * pal.length)],
      size,
      stemLen: size * rand(0.55, 0.95),
      rot:     rand(-Math.PI, Math.PI),
      rotSpeed: rand(-0.22, 0.22),
      opacity: rand(0.88, 1.0),
      // grow timing (ms after spawn) — faster petals so big blooms feel lively
      stemDur:    rand(220, 380),
      petalDelay: rand(22, 42),
      petalDur:   rand(380, 600),
      petalCount: PETAL_COUNTS[type],
      leafOffset: rand(0.3, 0.7),
    };
  }

  // ── rAF loop ────────────────────────────────────────────────────
  function startLoop() {
    if (running) return;
    running = true;
    rafId   = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick(now) {
    if (!running) return;
    const elapsed = now - startTime;
    const dt      = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;

    while (spawnSchedule.length && spawnSchedule[0].t <= elapsed) {
      flowers.push(createFlower(spawnSchedule.shift(), elapsed));
    }

    ctx.clearRect(0, 0, W, H);
    drawRipples(elapsed);
    updateAndDraw(elapsed, dt);
    updateAndDrawParticles(dt);
    rafId = requestAnimationFrame(tick);
  }

  // ── Create flower object ─────────────────────────────────────────
  function createFlower(def, elapsed) {
    return {
      x: W * 0.5, y: H * 0.5,
      r: def.r, ang: def.ang, swirl: def.swirl,
      rot: def.rot, rotSpeed: def.rotSpeed,
      type: def.type,
      color: def.color, accent: def.accent,
      size: def.size, stemLen: def.stemLen,
      opacity: def.opacity,
      spawnedAt: elapsed,
      stemDur: def.stemDur,
      petalDelay: def.petalDelay,
      petalDur: def.petalDur,
      petalCount: def.petalCount,
      leafOffset: def.leafOffset,
      // moment (ms after spawn) when the very last petal is fully open
      openEndMs: def.stemDur * 0.55 + def.petalDelay * (def.petalCount - 1) + def.petalDur,
      burst: false,
      _age: 0, _scale: 1, _alpha: 1,
    };
  }

  // ── Circular ripple: center flash + expanding shock rings ───────
  function drawRipples(elapsed) {
    const cx = W * 0.5, cy = H * 0.5;

    ctx.save();

    // Opening flash — the "mail just opened" bloom of light
    const flashT = elapsed / 900;
    if (flashT < 1) {
      const R = lerp(sizeBase * 1.5, sizeBase * 7, easeOutCubic(flashT));
      const a = (1 - flashT) * 0.8;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0,   `rgba(255,244,248,${a})`);
      g.addColorStop(0.4, `rgba(255,170,200,${a * 0.5})`);
      g.addColorStop(1,   'rgba(255,150,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Three expanding rings, each trailing the one before it
    for (let k = 0; k < 3; k++) {
      const e = elapsed - k * 420;
      if (e <= 0) continue;
      const p = e / WAVE_MS;
      if (p >= 1.15) continue;

      const R     = p * maxR;
      const fade  = (1 - p / 1.15) * (0.6 - k * 0.15);

      // soft wide glow
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,170,200,${fade * 0.28})`;
      ctx.lineWidth   = 28;
      ctx.stroke();

      // crisp thin ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,225,236,${fade})`;
      ctx.lineWidth   = lerp(4.5, 1.5, Math.min(p, 1));
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Update + draw flowers ────────────────────────────────────────
  function updateAndDraw(elapsed, dt) {
    const cx = W * 0.5, cy = H * 0.5;

    // Pass 1 — update motion/bloom state and paint glow halos underneath
    for (const f of flowers) {
      const age = elapsed - f.spawnedAt;
      f._age = age;

      // Circular drift: flowers push slightly outward and swirl clockwise
      const swirlT = easeOutCubic(Math.min(age / 2400, 1));
      const a  = f.ang + f.swirl * swirlT;
      const rr = f.r * (0.9 + 0.1 * easeOutCubic(Math.min(age / 1000, 1)));
      f.x = cx + Math.cos(a) * rr;
      f.y = cy + Math.sin(a) * rr;
      f.rot += f.rotSpeed * dt;

      // Bloom progress: 0 (bud) → 1 (last petal open)
      const startMs   = f.stemDur * 0.55;
      const openP     = clamp((age - startMs) / (f.openEndMs - startMs), 0, 1);
      const sincePop  = age - f.openEndMs;

      // Flower grows from 70% → 100% as it opens
      let scale = 0.7 + 0.3 * easeOutCubic(openP);
      let glow  = openP * 0.35;

      if (sincePop > 0) {
        if (!f.burst) { f.burst = true; spawnSparkles(f); }

        // Bloom "pop": quick swell then settle
        const pt = Math.min(sincePop / 650, 1);
        scale *= 1 + 0.16 * Math.sin(pt * Math.PI) * (1 - pt * 0.3);

        // Gentle breathing afterwards
        const breathe = easeOutCubic(Math.min(sincePop / 800, 1));
        scale *= 1 + 0.025 * Math.sin(age / 380 + f.ang * 3) * breathe;

        // Glow flash that fades to a soft afterglow
        glow += 0.5 * Math.max(0, 1 - sincePop / 900);
      }

      f._scale = scale;
      f._alpha = Math.min(age / 350, 1) * f.opacity;

      if (glow > 0.01) {
        const R = f.size * (1.5 + 0.5 * openP) * scale;
        ctx.save();
        ctx.translate(f.x, f.y);
        const g = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
        const hc = lighten(f.color, 0.35);
        g.addColorStop(0, rgba(hc, Math.min(glow, 1) * 0.85 * f._alpha));
        g.addColorStop(1, rgba(hc, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Pass 2 — draw the flowers themselves on top of all halos
    for (const f of flowers) {
      ctx.save();
      ctx.globalAlpha = Math.min(f._alpha, 1);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(f._scale, f._scale);

      drawFlower(f, f._age);

      ctx.restore();
    }
  }

  // ── Sparkle / pollen burst when a flower finishes blooming ──────
  function spawnSparkles(f) {
    if (particles.length > 900) return;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a  = rand(0, Math.PI * 2);
      const sp = rand(35, 120) * (f.size / 60);
      particles.push({
        x: f.x, y: f.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 18,
        life: 0,
        max: rand(700, 1300),
        r: rand(1.2, 3.4),
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });
    }
  }

  function updateAndDrawParticles(dt) {
    if (!particles.length) return;
    ctx.save();
    let w = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += dt * 1000;
      if (p.life >= p.max) continue;

      const drag = Math.max(0, 1 - 1.8 * dt);
      p.vx *= drag;
      p.vy  = p.vy * drag - 10 * dt;   // slow upward float
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;

      const k = p.life / p.max;
      ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(p.life / 60));  // twinkle
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();

      particles[w++] = p;
    }
    particles.length = w;
    ctx.restore();
  }

  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── Master flower draw dispatcher ───────────────────────────────
  function drawFlower(f, age) {
    // Stem progress: 0→1 over stemDur ms
    const stemT = Math.min(age / f.stemDur, 1);

    // Draw stem (grows upward from bottom)
    if (stemT > 0.05) drawStem(f, stemT);

    // Each petal opens with its own offset
    const totalPetalMs = f.petalDelay * f.petalCount + f.petalDur;
    const petalStartMs = f.stemDur * 0.55;

    switch (f.type) {
      case 'rose':        drawRose(f, age, petalStartMs);        break;
      case 'peony':       drawPeony(f, age, petalStartMs);       break;
      case 'blossom':     drawBlossom(f, age, petalStartMs);     break;
      case 'ranunculus':  drawRanunculus(f, age, petalStartMs);  break;
      case 'magnolia':    drawMagnolia(f, age, petalStartMs);    break;
    }
  }

  // ── Stem with leaves ─────────────────────────────────────────────
  function drawStem(f, stemT) {
    const s   = f.size;
    const len = f.stemLen * stemT;

    // Stem line (grows downward from flower center)
    ctx.save();
    ctx.strokeStyle = '#6b9e5e';
    ctx.lineWidth   = Math.max(1, s * 0.06);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Subtle curve on stem
    ctx.quadraticCurveTo(s * 0.18, len * 0.5, s * 0.06, len);
    ctx.stroke();

    // Leaf (appears when stem is ~60% grown)
    if (stemT > 0.6) {
      const leafT = (stemT - 0.6) / 0.4;
      const leafPos = len * f.leafOffset;
      ctx.save();
      ctx.translate(s * 0.1, leafPos);
      ctx.rotate(-0.7 * leafT);
      drawLeaf(ctx, s * 0.35 * leafT, '#5a9050');
      ctx.restore();
    }

    ctx.restore();
  }

  function drawLeaf(ctx, size, color) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * 0.6, -size * 0.25, size * 0.8, size * 0.4, size, 0);
    ctx.bezierCurveTo(size * 0.8,  size * 0.3,  size * 0.4, size * 0.2, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── ROSE: spiral layered petals, curled tips ─────────────────────
  function drawRose(f, age, startMs) {
    const s = f.size;
    const c = f.color;

    // Draw layers from outer to inner so inner sits on top
    const layers = [
      { count: 7,  r: 0.92, petalH: 1.05, tilt: 0.28, colorFn: x => darken(c, 0.05) },
      { count: 6,  r: 0.68, petalH: 0.82, tilt: 0.22, colorFn: x => c },
      { count: 5,  r: 0.48, petalH: 0.65, tilt: 0.16, colorFn: x => lighten(c, 0.12) },
      { count: 4,  r: 0.28, petalH: 0.44, tilt: 0.10, colorFn: x => lighten(c, 0.24) },
      { count: 3,  r: 0.14, petalH: 0.28, tilt: 0.05, colorFn: x => lighten(c, 0.38) },
    ];

    let petalIdx = 0;
    for (let li = 0; li < layers.length; li++) {
      const lyr = layers[li];
      const layerRotOffset = (li / layers.length) * Math.PI * 0.4;

      for (let i = 0; i < lyr.count; i++, petalIdx++) {
        const t = petalOpenT(age, startMs, f, petalIdx);
        if (t <= 0) continue;

        const angle = (i / lyr.count) * Math.PI * 2 + layerRotOffset;
        ctx.save();
        ctx.rotate(angle);

        // Petal: narrows at base, wide rounded tip, slightly cupped
        const petalW = s * 0.30 * t;
        const petalH = s * lyr.r * lyr.petalH * t;

        const grad = ctx.createRadialGradient(0, -petalH * 0.5, 0, 0, -petalH * 0.3, petalH * 0.9);
        grad.addColorStop(0, lighten(lyr.colorFn(), 0.25));
        grad.addColorStop(0.5, lyr.colorFn());
        grad.addColorStop(1, darken(lyr.colorFn(), 0.18));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Left edge curves out
        ctx.bezierCurveTo(
          -petalW * 0.8,  -petalH * 0.25,
          -petalW * 1.0,  -petalH * 0.75,
          0,              -petalH
        );
        // Right edge mirrors
        ctx.bezierCurveTo(
           petalW * 1.0, -petalH * 0.75,
           petalW * 0.8, -petalH * 0.25,
           0,             0
        );

        ctx.fillStyle = grad;
        ctx.globalAlpha *= 0.88;
        ctx.fill();

        // Petal vein — subtle center line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -petalH * 0.75);
        ctx.strokeStyle = darken(lyr.colorFn(), 0.22);
        ctx.lineWidth   = 0.4;
        ctx.globalAlpha *= 0.4;
        ctx.stroke();

        ctx.restore();
      }
    }

    // Tight spiral center bud (always present once started)
    const centerT = petalOpenT(age, startMs, f, 0);
    if (centerT > 0.2) {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.09 * centerT, 0, Math.PI * 2);
      const cg = ctx.createRadialGradient(0,0,0, 0,0, s*0.09*centerT);
      cg.addColorStop(0, lighten(c, 0.45));
      cg.addColorStop(1, c);
      ctx.fillStyle = cg;
      ctx.fill();
    }
  }

  // ── PEONY: many ruffled, wide petals in tight concentric rings ──
  function drawPeony(f, age, startMs) {
    const s = f.size;
    const c = f.color;

    const rings = [
      { count: 8, r: 0.95, w: 0.50, h: 0.55, rot: 0.00 },
      { count: 8, r: 0.72, w: 0.42, h: 0.48, rot: 0.22 },
      { count: 7, r: 0.52, w: 0.36, h: 0.40, rot: 0.10 },
      { count: 6, r: 0.34, w: 0.30, h: 0.32, rot: 0.30 },
      { count: 5, r: 0.18, w: 0.22, h: 0.24, rot: 0.15 },
    ];

    let petalIdx = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri];
      const col  = lighten(c, ri * 0.08);
      for (let i = 0; i < ring.count; i++, petalIdx++) {
        const t = petalOpenT(age, startMs, f, petalIdx);
        if (t <= 0) continue;

        const angle = (i / ring.count) * Math.PI * 2 + ring.rot;

        ctx.save();
        ctx.rotate(angle);

        // Wide ruffled ellipse petal
        const pw = s * ring.w * t;
        const ph = s * ring.h * t;

        const grad = ctx.createRadialGradient(0, -ph*0.4, 0, 0, -ph*0.4, ph);
        grad.addColorStop(0, lighten(col, 0.3));
        grad.addColorStop(1, darken(col, 0.1));

        ctx.beginPath();
        // Ruffled petal using multiple bezier control points
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-pw*0.9, -ph*0.2, -pw*1.1, -ph*0.7, -pw*0.3, -ph);
        ctx.bezierCurveTo(-pw*0.1, -ph*1.1,  pw*0.1, -ph*1.1,  pw*0.3, -ph);
        ctx.bezierCurveTo( pw*1.1, -ph*0.7,  pw*0.9, -ph*0.2,  0,  0);

        ctx.fillStyle = grad;
        ctx.globalAlpha *= 0.82;
        ctx.fill();
        ctx.restore();
      }
    }

    // Fluffy stamen center
    const t0 = petalOpenT(age, startMs, f, 0);
    if (t0 > 0.3) {
      for (let i = 0; i < 10; i++) {
        const a  = (i / 10) * Math.PI * 2;
        const sr = s * 0.13 * t0;
        ctx.beginPath();
        ctx.arc(Math.cos(a)*sr*0.6, Math.sin(a)*sr*0.6, s*0.03*t0, 0, Math.PI*2);
        ctx.fillStyle = '#ffe4a0';
        ctx.globalAlpha *= 0.9;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.07 * t0, 0, Math.PI * 2);
      ctx.fillStyle = lighten(c, 0.5);
      ctx.fill();
    }
  }

  // ── BLOSSOM: 5 heart-shaped petals, cherry/plum style ───────────
  function drawBlossom(f, age, startMs) {
    const s = f.size;
    const c = f.color;

    for (let i = 0; i < 5; i++) {
      const t = petalOpenT(age, startMs, f, i);
      if (t <= 0) continue;

      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px    = Math.cos(angle) * s * 0.44 * t;
      const py    = Math.sin(angle) * s * 0.44 * t;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle + Math.PI / 2);

      const pw = s * 0.36 * t;
      const ph = s * 0.48 * t;

      const grad = ctx.createRadialGradient(0, -ph*0.3, 0, 0, 0, ph);
      grad.addColorStop(0, lighten(c, 0.4));
      grad.addColorStop(0.6, c);
      grad.addColorStop(1, darken(c, 0.12));

      // Heart-notched petal top
      ctx.beginPath();
      ctx.moveTo(0, ph * 0.5);
      ctx.bezierCurveTo(-pw*1.1, ph*0.2, -pw*1.1, -ph*0.4, -pw*0.3, -ph*0.5);
      ctx.bezierCurveTo(-pw*0.1, -ph*0.9,  0, -ph*0.7,  0, -ph*0.6);
      ctx.bezierCurveTo( 0, -ph*0.7,  pw*0.1, -ph*0.9,  pw*0.3, -ph*0.5);
      ctx.bezierCurveTo( pw*1.1, -ph*0.4,  pw*1.1,  ph*0.2,  0, ph*0.5);

      ctx.fillStyle = grad;
      ctx.fill();

      // Pink blush vein
      ctx.beginPath();
      ctx.moveTo(0, ph*0.4);
      ctx.lineTo(0, -ph*0.5);
      ctx.strokeStyle = darken(c, 0.3);
      ctx.lineWidth   = 0.5;
      ctx.globalAlpha *= 0.3;
      ctx.stroke();

      ctx.restore();
    }

    // Stamens
    const t0 = petalOpenT(age, startMs, f, 0);
    if (t0 > 0.5) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = s * 0.18 * t0;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r*0.4, Math.sin(a)*r*0.4);
        ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        ctx.strokeStyle = '#ffe060';
        ctx.lineWidth   = 0.7;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(Math.cos(a)*r, Math.sin(a)*r, s*0.03*t0, 0, Math.PI*2);
        ctx.fillStyle = '#ffcc40';
        ctx.fill();
      }
    }
  }

  // ── RANUNCULUS: dense concentric rings of papery petals ─────────
  function drawRanunculus(f, age, startMs) {
    const s = f.size;
    const c = f.color;

    const rings = [
      { count: 10, r: 0.90, pw: 0.22, ph: 0.42, rot: 0 },
      { count:  9, r: 0.70, pw: 0.20, ph: 0.36, rot: 0.18 },
      { count:  8, r: 0.52, pw: 0.18, ph: 0.30, rot: 0.12 },
      { count:  6, r: 0.36, pw: 0.16, ph: 0.24, rot: 0.24 },
      { count:  5, r: 0.22, pw: 0.14, ph: 0.18, rot: 0.08 },
      { count:  4, r: 0.11, pw: 0.10, ph: 0.12, rot: 0.34 },
    ];

    let petalIdx = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri];
      const col  = lighten(c, ri * 0.07);
      for (let i = 0; i < ring.count; i++, petalIdx++) {
        const t = petalOpenT(age, startMs, f, petalIdx);
        if (t <= 0) continue;

        const angle = (i / ring.count) * Math.PI * 2 + ring.rot;
        ctx.save();
        ctx.rotate(angle);

        const pw = s * ring.pw * t;
        const ph = s * ring.ph * t;
        const cy_off = -s * ring.r * t;

        // Thin papery ellipse petal
        ctx.beginPath();
        ctx.ellipse(0, cy_off, pw, ph, 0, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(0, cy_off, 0, 0, cy_off, ph);
        grad.addColorStop(0, lighten(col, 0.25));
        grad.addColorStop(1, darken(col, 0.08));
        ctx.fillStyle = grad;
        ctx.globalAlpha *= 0.85;
        ctx.fill();
        ctx.restore();
      }
    }

    // Compact seed center
    const t0 = petalOpenT(age, startMs, f, 0);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.09 * t0, 0, Math.PI * 2);
    const cg = ctx.createRadialGradient(0,0,0, 0,0, s*0.09*t0);
    cg.addColorStop(0, '#fffbe0');
    cg.addColorStop(1, lighten(c, 0.35));
    ctx.fillStyle = cg;
    ctx.fill();
  }

  // ── MAGNOLIA: 9 large cup petals, waxy & luminous ───────────────
  function drawMagnolia(f, age, startMs) {
    const s = f.size;
    const c = f.color;   // creamy white / pale blush

    for (let i = 0; i < 9; i++) {
      const t = petalOpenT(age, startMs, f, i);
      if (t <= 0) continue;

      // Outer 6 spread wide; inner 3 form cup
      const isInner  = i >= 6;
      const angle    = (i / (isInner ? 3 : 6)) * Math.PI * 2 + (isInner ? 0.52 : 0);
      const pw       = s * (isInner ? 0.28 : 0.38) * t;
      const ph       = s * (isInner ? 0.80 : 1.05) * t;
      const cup      = isInner ? 0.35 : 0;   // inner petals lean inward

      ctx.save();
      ctx.rotate(angle);

      const grad = ctx.createLinearGradient(0, 0, 0, -ph);
      grad.addColorStop(0,   darken(c, 0.08));
      grad.addColorStop(0.4, c);
      grad.addColorStop(1,   lighten(c, 0.3));

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        -pw * 0.8 + cup, -ph * 0.3,
        -pw * 0.95 + cup, -ph * 0.78,
         0,              -ph
      );
      ctx.bezierCurveTo(
         pw * 0.95 - cup, -ph * 0.78,
         pw * 0.8  - cup, -ph * 0.3,
         0,               0
      );

      ctx.fillStyle = grad;
      ctx.globalAlpha *= isInner ? 0.92 : 0.80;
      ctx.fill();

      // Subtle pink blush at base
      ctx.beginPath();
      ctx.ellipse(0, -ph * 0.12, pw * 0.55, ph * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = lighten(f.accent, 0.1);
      ctx.globalAlpha *= 0.35;
      ctx.fill();

      ctx.restore();
    }

    // Center cone of stamens
    const t0 = petalOpenT(age, startMs, f, 0);
    if (t0 > 0.4) {
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.1*t0, s*0.16*t0, 0, 0, Math.PI*2);
      ctx.fillStyle = '#b8860b';
      ctx.globalAlpha *= 0.7;
      ctx.fill();

      for (let i = 0; i < 12; i++) {
        const a  = (i / 12) * Math.PI * 2;
        const r  = s * 0.14 * t0;
        ctx.beginPath();
        ctx.arc(Math.cos(a)*r, Math.sin(a)*r, s*0.025*t0, 0, Math.PI*2);
        ctx.fillStyle = '#ffd700';
        ctx.globalAlpha *= 0.85;
        ctx.fill();
      }
    }
  }

  // ── Petal open progress (0→1) ────────────────────────────────────
  // petalIdx: which petal (opens in sequence with delay)
  function petalOpenT(age, startMs, f, petalIdx) {
    const openStart = startMs + petalIdx * f.petalDelay;
    const openEnd   = openStart + f.petalDur;
    if (age < openStart) return 0;
    if (age >= openEnd)  return 1;
    return easeOutBack((age - openStart) / (openEnd - openStart));
  }

  // ── Color helpers ────────────────────────────────────────────────
  function hexToRgb(hex) {
    const h = hex.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function rgbToHex(r,g,b) {
    return '#'+[r,g,b].map(v=>Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  function lighten(hex, a) {
    const [r,g,b] = hexToRgb(hex);
    return rgbToHex(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a);
  }
  function darken(hex, a) {
    const [r,g,b] = hexToRgb(hex);
    return rgbToHex(r*(1-a), g*(1-a), b*(1-a));
  }

  // ── Math helpers ─────────────────────────────────────────────────
  function rand(a, b)    { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ── Bloom complete ────────────────────────────────────────────────
  function onBloomComplete() {
    CandleScene.beginTransition(canvas, stopLoop, clear);
  }

  function clear() {
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  return { init, clear };

})();