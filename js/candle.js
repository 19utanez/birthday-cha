/**
 * candle.js — smaller candle, shifted up for lyric room, upgraded visuals
 */

const CandleScene = (() => {

  let canvas  = null;
  let ctx     = null;
  let dpr     = 1;
  let W       = 0;
  let H       = 0;

  let rafId     = null;
  let running   = false;
  let startTime = 0;

  let cx      = 0;
  let candleY = 0;   // TOP of wax column
  let candleW = 0;
  let candleH = 0;

  // Hot-pink / white — classic birthday candle
  const candleColor = ['#e8306a', '#ff90b8'];

  const FLICKER = [
    { freq: 1.7,  amp: 1.00, phase: 0.00 },
    { freq: 3.1,  amp: 0.45, phase: 1.20 },
    { freq: 7.3,  amp: 0.18, phase: 2.80 },
    { freq: 11.9, amp: 0.06, phase: 0.55 },
  ];

  let igniting    = true;
  let igniteTimer = 0;
  const IGNITE_MS = 700;

  function init() {
    canvas = document.getElementById('candle-canvas');
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    SceneController.register('scene-candle', onEnter);
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
    layout();
  }

  function layout() {
    cx = W * 0.5;

    // Smaller candle — shorter, proportionally wider
    candleW = clamp(W * 0.032, 11, 18);
    candleH = clamp(H * 0.07,  32, 52);   // was H*0.12 — now much shorter

    // Flame ignites at H*0.32 (upper third).
    // As cake reveals, the whole stack is already anchored here.
    // candleY = top of wax. Flame tip is ~flameH above this.
    // Keep ignition point at a fixed comfortable height.
    candleY = H * 0.32;
  }

  function onEnter() {}

  function beginTransition(flowerCanvas, stopFlowerLoop, clearFlowerCanvas) {
    const blackout = document.getElementById('blackout');
    const tl = gsap.timeline();

    tl
      .to(blackout, { opacity: 0.15, duration: 0.35, ease: 'power1.in' })
      .to(blackout, { opacity: 1,    duration: 0.55, ease: 'power3.in' })
      .call(() => {
        gsap.set(flowerCanvas, { opacity: 0 });
        stopFlowerLoop();
        clearFlowerCanvas();
      })
      .to({}, { duration: 1.1 })
      .call(() => { SceneController.go('scene-candle'); })
      .to({}, { duration: 0.7 })
      .call(() => { startFlame(); })
      .to(canvas, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '+=0.05')
      .call(() => { gsap.delayedCall(4.5, onCandleComplete); });
  }

  function startFlame() {
    if (running) return;
    igniting    = true;
    igniteTimer = 0;
    startTime   = performance.now();
    running     = true;
    rafId       = requestAnimationFrame(tick);
    playLighterSound();
  }

  // ── Lighter sound: click → hiss → soft flame whoosh ──────────
  function playLighterSound() {
    try {
      const Ctx = window._audioContext ||
        (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      if (!Ctx) return;
      if (Ctx.state === 'suspended') Ctx.resume();

      const master = Ctx.createGain();
      master.gain.value = 0.55;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;

      // ── 1. Flint click — very short noise burst ───────────────
      const clickBuf = Ctx.createBuffer(1, Ctx.sampleRate * 0.04, Ctx.sampleRate);
      const clickData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickData.length; i++) {
        clickData[i] = (Math.random() * 2 - 1) *
          Math.exp(-i / (Ctx.sampleRate * 0.006));  // fast exponential decay
      }
      const clickSrc = Ctx.createBufferSource();
      const clickEnv = Ctx.createGain();
      clickSrc.buffer = clickBuf;
      clickEnv.gain.setValueAtTime(0.9, now);
      clickEnv.gain.linearRampToValueAtTime(0, now + 0.04);
      const clickHp = Ctx.createBiquadFilter();
      clickHp.type = 'highpass';
      clickHp.frequency.value = 2200;
      clickSrc.connect(clickHp);
      clickHp.connect(clickEnv);
      clickEnv.connect(master);
      clickSrc.start(now);
      clickSrc.stop(now + 0.05);

      // ── 2. Gas hiss — filtered white noise ───────────────────
      const hissDur = 0.28;
      const hissBuf = Ctx.createBuffer(1, Ctx.sampleRate * hissDur, Ctx.sampleRate);
      const hissData = hissBuf.getChannelData(0);
      for (let i = 0; i < hissData.length; i++) hissData[i] = Math.random() * 2 - 1;
      const hissSrc = Ctx.createBufferSource();
      const hissEnv = Ctx.createGain();
      const hissBp  = Ctx.createBiquadFilter();
      hissSrc.buffer = hissBuf;
      hissBp.type = 'bandpass';
      hissBp.frequency.value = 3800;
      hissBp.Q.value = 0.6;
      hissEnv.gain.setValueAtTime(0, now + 0.03);
      hissEnv.gain.linearRampToValueAtTime(0.55, now + 0.08);
      hissEnv.gain.linearRampToValueAtTime(0.28, now + 0.18);
      hissEnv.gain.linearRampToValueAtTime(0, now + hissDur + 0.03);
      hissSrc.connect(hissBp);
      hissBp.connect(hissEnv);
      hissEnv.connect(master);
      hissSrc.start(now + 0.03);
      hissSrc.stop(now + hissDur + 0.05);

      // ── 3. Flame whoosh — low warm tone that blooms open ─────
      const whoosh = Ctx.createOscillator();
      const whooshEnv = Ctx.createGain();
      const whooshLp  = Ctx.createBiquadFilter();
      whoosh.type = 'sawtooth';
      whoosh.frequency.setValueAtTime(120, now + 0.12);
      whoosh.frequency.exponentialRampToValueAtTime(55, now + 0.55);
      whooshLp.type = 'lowpass';
      whooshLp.frequency.setValueAtTime(800, now + 0.12);
      whooshLp.frequency.exponentialRampToValueAtTime(180, now + 0.55);
      whooshEnv.gain.setValueAtTime(0, now + 0.12);
      whooshEnv.gain.linearRampToValueAtTime(0.38, now + 0.22);
      whooshEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      whoosh.connect(whooshLp);
      whooshLp.connect(whooshEnv);
      whooshEnv.connect(master);
      whoosh.start(now + 0.12);
      whoosh.stop(now + 0.8);

      // ── 4. Soft warm flame sustain — crackling warmth ─────────
      const flameDur = 1.8;
      const flameBuf = Ctx.createBuffer(1, Ctx.sampleRate * flameDur, Ctx.sampleRate);
      const flameData = flameBuf.getChannelData(0);
      for (let i = 0; i < flameData.length; i++) flameData[i] = Math.random() * 2 - 1;
      const flameSrc = Ctx.createBufferSource();
      const flameEnv = Ctx.createGain();
      const flameLp  = Ctx.createBiquadFilter();
      flameSrc.buffer = flameBuf;
      flameLp.type = 'lowpass';
      flameLp.frequency.value = 320;
      flameEnv.gain.setValueAtTime(0, now + 0.18);
      flameEnv.gain.linearRampToValueAtTime(0.18, now + 0.38);
      flameEnv.gain.setValueAtTime(0.12, now + 0.9);
      flameEnv.gain.exponentialRampToValueAtTime(0.001, now + flameDur);
      flameSrc.connect(flameLp);
      flameLp.connect(flameEnv);
      flameEnv.connect(master);
      flameSrc.start(now + 0.18);
      flameSrc.stop(now + flameDur + 0.05);

    } catch(e) {
      console.warn('Lighter sound unavailable:', e.message);
    }
  }

  function stopFlame() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  let lastT = 0;

  function tick(now) {
    if (!running) return;
    const elapsed = now - startTime;
    const dt      = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    const flicker = sampleFlicker(elapsed / 1000);
    if (igniting) {
      igniteTimer += dt * 1000;
      if (igniteTimer >= IGNITE_MS) igniting = false;
      drawIgnition(igniteTimer / IGNITE_MS, flicker);
    } else {
      drawScene(elapsed / 1000, flicker);
    }
    rafId = requestAnimationFrame(tick);
  }

  function sampleFlicker(t) {
    let v = 0, total = 0;
    for (const o of FLICKER) {
      v     += Math.sin(t * o.freq * Math.PI * 2 + o.phase) * o.amp;
      total += o.amp;
    }
    return v / total;
  }

  // ── Ignition ──────────────────────────────────────────────────
  function drawIgnition(progress, flicker) {
    const expand = Math.min(progress / 0.4, 1);
    const settle = Math.max((progress - 0.4) / 0.6, 0);
    const flareR = easeOutExpo(expand) * 62 * (1 - settle * 0.75);
    const alpha  = expand < 0.5 ? expand * 2 : 1 - (expand - 0.5) * 2 * settle;
    const fy     = candleY - 4;

    if (flareR > 0.5) {
      const g = ctx.createRadialGradient(cx, fy, 0, cx, fy, flareR);
      g.addColorStop(0,    `rgba(255,255,240,${clamp(alpha,0,1)})`);
      g.addColorStop(0.25, `rgba(255,230,120,${clamp(alpha*0.88,0,1)})`);
      g.addColorStop(0.55, `rgba(255,140,30,${clamp(alpha*0.55,0,1)})`);
      g.addColorStop(0.75, `rgba(255,80,10,${clamp(alpha*0.30,0,1)})`);
      g.addColorStop(1,    'rgba(255,40,0,0)');
      ctx.beginPath();
      ctx.arc(cx, fy, flareR, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    if (settle > 0.2) {
      ctx.save();
      ctx.globalAlpha = easeOutCubic((settle - 0.2) / 0.8);
      drawScene(settle * 0.5, flicker);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ── Full scene ────────────────────────────────────────────────
  function drawScene(t, flicker) {
    const rv = CakeScene.reveal.value;

    CakeScene.draw(ctx, W, H, flicker, cx, candleY);
    CatScene.draw(ctx, W, H, t);
    drawAmbientGlow(flicker, rv);
    drawWaxBody(flicker);

    const sway   = flicker * 3.5;
    const scaleH = 1 + flicker * 0.09;
    const scaleW = 1 - Math.abs(flicker) * 0.07;
    const wickTop = candleY - candleW * 0.8;
    const flameH  = clamp(H * 0.072, 38, 65) * scaleH;
    const flameW  = clamp(W * 0.028, 11, 20) * scaleW;
    const tipX    = cx + sway;
    const tipY    = wickTop - flameH;

    drawFlameLayer(tipX, tipY, cx, wickTop, flameW*1.95, flameH*1.12,
      ['rgba(215,45,5,0.75)','rgba(255,90,15,0.62)','rgba(255,150,25,0.35)','rgba(255,190,70,0.0)']);
    drawFlameLayer(tipX, tipY, cx, wickTop, flameW*1.15, flameH*0.90,
      ['rgba(255,130,8,0.92)','rgba(255,180,35,0.80)','rgba(255,215,85,0.48)','rgba(255,235,155,0.0)']);
    drawFlameLayer(tipX, tipY, cx, wickTop, flameW*0.58, flameH*0.65,
      ['rgba(255,215,75,0.96)','rgba(255,238,135,0.82)','rgba(255,252,200,0.0)','rgba(255,252,200,0.0)']);
    drawFlameLayer(tipX, tipY, cx, wickTop, flameW*0.24, flameH*0.34,
      ['rgba(255,255,245,1.0)','rgba(255,252,210,0.74)','rgba(255,245,165,0.0)','rgba(255,245,165,0.0)']);

    // Ember dot at wick tip
    ctx.beginPath();
    ctx.arc(cx, wickTop + 2, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,200,0.88)';
    ctx.fill();
  }

  // ── Ambient glow ──────────────────────────────────────────────
  function drawAmbientGlow(flicker, rv) {
    const fy  = candleY - clamp(H * 0.072, 38, 65) * 0.4;
    const b   = (0.55 + rv * 0.38) + flicker * 0.08;
    const oMin = clamp(W * 0.18, 55, 100);
    const oMax = clamp(W * 0.70, 200, 360);
    const outerR = oMin + (oMax - oMin) * rv;

    const go = ctx.createRadialGradient(cx, fy, 0, cx, fy, outerR);
    go.addColorStop(0,    `rgba(255,190,75,${(0.13 + rv*0.10)*b})`);
    go.addColorStop(0.30, `rgba(220,110,25,${(0.07 + rv*0.055)*b})`);
    go.addColorStop(0.65, `rgba(155,55,8,${(0.025 + rv*0.025)*b})`);
    go.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, fy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = go; ctx.fill();

    const innerR = clamp(W * 0.17, 50, 88);
    const gi = ctx.createRadialGradient(cx, fy, 0, cx, fy, innerR);
    gi.addColorStop(0,    `rgba(255,205,95,${(0.20 + rv*0.11)*b})`);
    gi.addColorStop(0.38, `rgba(255,135,35,${(0.10 + rv*0.055)*b})`);
    gi.addColorStop(0.72, `rgba(195,72,8,${(0.04 + rv*0.025)*b})`);
    gi.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, fy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = gi; ctx.fill();
  }

  // ── Upgraded birthday candle wax body ─────────────────────────
  function drawWaxBody(flicker) {
    const alpha = igniting ? clamp((igniteTimer/IGNITE_MS - 0.1)/0.5, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    const x  = cx - candleW / 2;
    const y  = candleY;
    const w  = candleW;
    const h  = candleH;
    const r  = candleW * 0.38;
    const [baseCol, litCol] = candleColor;

    // ── Main wax body ─────────────────────────────────────────
    // Left-to-right: shadow edge → bright lit center → shadow edge
    const gw = ctx.createLinearGradient(x, y, x + w, y);
    gw.addColorStop(0,    darkHex(baseCol, 0.35));
    gw.addColorStop(0.20, litCol);
    gw.addColorStop(0.50, baseCol);
    gw.addColorStop(0.80, darkHex(baseCol, 0.25));
    gw.addColorStop(1,    darkHex(baseCol, 0.42));

    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = gw;
    ctx.fill();

    // ── Helical white stripes (clipped inside wax) ────────────
    const stripes = 4;
    const sH = h / stripes;
    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.globalAlpha = alpha * 0.22;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue;
      const sy = y + i * sH;
      ctx.beginPath();
      ctx.moveTo(x,     sy + sH * 0.18);
      ctx.lineTo(x + w, sy - sH * 0.18);
      ctx.lineTo(x + w, sy + sH * 0.82);
      ctx.lineTo(x,     sy + sH * 1.18);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();

    // ── Rounded left highlight (gives 3-D cylinder feel) ─────
    const ghl = ctx.createLinearGradient(x, y, x + w * 0.45, y);
    ghl.addColorStop(0,    'rgba(255,255,255,0.0)');
    ghl.addColorStop(0.22, 'rgba(255,255,255,0.38)');
    ghl.addColorStop(0.55, 'rgba(255,255,255,0.08)');
    ghl.addColorStop(1,    'rgba(255,255,255,0.0)');
    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = ghl;
    ctx.fill();

    // ── Flame warmth gradient — top of candle glows warm ─────
    const gfv = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    gfv.addColorStop(0,    `rgba(255,200,100,${0.32 + flicker * 0.08})`);
    gfv.addColorStop(0.40, 'rgba(255,170,50,0.07)');
    gfv.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = gfv;
    ctx.fill();

    // ── Gold metallic base ring ───────────────────────────────
    const ringH = clamp(h * 0.12, 3, 6);
    const ringY = y + h - ringH;
    const gg = ctx.createLinearGradient(x, ringY, x + w, ringY);
    gg.addColorStop(0,    '#8a6a20');
    gg.addColorStop(0.25, '#e8c060');
    gg.addColorStop(0.50, '#f8e090');
    gg.addColorStop(0.75, '#d4a840');
    gg.addColorStop(1,    '#8a6a20');
    ctx.beginPath();
    ctx.moveTo(x + r, ringY);
    ctx.lineTo(x + w - r, ringY);
    ctx.quadraticCurveTo(x + w, ringY, x + w, ringY + r);
    ctx.lineTo(x + w, ringY + ringH);
    ctx.lineTo(x, ringY + ringH);
    ctx.lineTo(x, ringY + r);
    ctx.quadraticCurveTo(x, ringY, x + r, ringY);
    ctx.closePath();
    ctx.fillStyle = gg;
    ctx.fill();

    // ── Wax pool at top (melted area) ────────────────────────
    const poolRX = w * 0.82;
    const poolRY = w * 0.30;
    const gpx = ctx.createRadialGradient(cx, y + poolRY*0.4, 0, cx, y, poolRX);
    gpx.addColorStop(0,   'rgba(255,248,220,0.95)');
    gpx.addColorStop(0.5, 'rgba(250,225,180,0.80)');
    gpx.addColorStop(1,   'rgba(220,180,140,0.55)');
    ctx.beginPath();
    ctx.ellipse(cx, y + poolRY * 0.4, poolRX, poolRY, 0, 0, Math.PI * 2);
    ctx.fillStyle = gpx;
    ctx.fill();
    // Inner liquid shimmer
    ctx.beginPath();
    ctx.ellipse(cx - w*0.12, y + poolRY*0.3, poolRX*0.38, poolRY*0.40, -0.3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,235,0.45)';
    ctx.fill();

    // ── Wick (slight curve toward flame lean) ─────────────────
    const wickLen = candleW * 0.82;
    ctx.beginPath();
    ctx.moveTo(cx, y + poolRY * 0.5);
    ctx.quadraticCurveTo(cx + 1.2, y - wickLen*0.5, cx + 1, y - wickLen);
    ctx.strokeStyle = '#150a03';
    ctx.lineWidth   = 1.6;
    ctx.lineCap     = 'round';
    ctx.stroke();

    ctx.restore();
  }

  // ── Generic flame layer (teardrop bezier) ─────────────────────
  function drawFlameLayer(tipX, tipY, baseX, baseY, w, h, stops) {
    const midY = baseY - h * 0.10;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.bezierCurveTo(tipX+w*0.55, tipY+h*0.38, baseX+w, midY, baseX, baseY);
    ctx.bezierCurveTo(baseX-w, midY, tipX-w*0.55, tipY+h*0.38, tipX, tipY);
    ctx.closePath();
    const g = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    const step = 1 / (stops.length - 1);
    stops.forEach((c, i) => g.addColorStop(i * step, c));
    ctx.fillStyle = g;
    ctx.fill();
  }

  // ── Cake reveal sequence ──────────────────────────────────────
  function onCandleComplete() {
    const tl = gsap.timeline({ onComplete: onCakeComplete });
    tl
      .to(CakeScene.reveal, { value: 0.20, duration: 1.6, ease: 'power1.inOut' })
      .to(CakeScene.reveal, { value: 0.56, duration: 2.2, ease: 'power2.out'   })
      .to(CakeScene.reveal, { value: 0.84, duration: 1.8, ease: 'power1.inOut' })
      .to(CakeScene.reveal, { value: 1.0,  duration: 1.2, ease: 'power2.out'   });
  }

  function onCakeComplete() {
    gsap.delayedCall(1.4, () => CatScene.startWalk(W, H));
  }

  // ── Helpers ───────────────────────────────────────────────────
  function darkHex(hex, amt) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    const d = 1 - Math.min(amt, 0.9);
    return `rgb(${Math.round(r*d)},${Math.round(g*d)},${Math.round(b*d)})`;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }
  function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
  function easeOutExpo(t) { return t===1?1:1-Math.pow(2,-10*t); }

  return { init, beginTransition, stopFlame };

})();
