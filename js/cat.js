/**
 * cat.js — cat walks above each lyric line, synced to music rhythm
 *
 * X position: driven by wall-clock time mapped to each line's duration.
 *             Reliable on mobile regardless of audio state.
 *
 * Bob/tilt:   driven by audio.currentTime when available (music-locked),
 *             falls back to wall-clock so motion never freezes.
 *
 * lyrics.js calls CatScene.startLine(idx, el, durSecs, showAt) on each line.
 */

const CatScene = (() => {

  const state = {
    active:  false,
    x:       0,
    y:       0,
    targetY: 0,
    facing:  1,
    alpha:   0,
  };

  // Per-line timing
  const line = {
    startX:      0,
    endX:        0,
    wallStart:   0,   // performance.now() when this line was activated
    durMs:       0,   // duration in ms
    active:      false,
  };

  let screenW    = 0;
  let screenH    = 0;

  // Bob rhythm — matches chiptune BEAT = 0.58s
  const BEAT_SEC = 0.58;
  const BOB_RATE = (Math.PI * 2) / BEAT_SEC;  // rad/s

  let walkPhase     = 0;
  let lastAudioTime = 0;
  let lastWallMs    = 0;

  const catImg  = new Image();
  let imgReady  = false;
  catImg.onload  = () => { imgReady = true; };
  catImg.onerror = () => { console.warn('catto.png not found at assets/cat/catto.png'); };
  catImg.src     = 'assets/cat/catto.png';

  const CAT_H_BASE = 88;
  const CAT_W_BASE = 110;

  function init() {}

  // ── Called by candle.js after cake reveal ─────────────────────
  function startWalk(W, H) {
    screenW       = W;
    screenH       = H;
    walkPhase     = 0;
    lastAudioTime = 0;
    lastWallMs    = performance.now();
    state.active  = true;
    state.alpha   = 0;
    state.x       = -W * 0.15;
    state.y       = H;
    state.targetY = H;
    line.active   = false;
    LyricsScene.start();
  }

  // ── Called by lyrics.js at the start of each lyric line ───────
  function startLine(idx, lineEl, durSecs, showAtSec) {
    const scale  = clamp(screenW / 390, 0.72, 1.35);
    const catW   = CAT_W_BASE * scale;
    const catH   = CAT_H_BASE * scale;
    const rect   = lineEl.getBoundingClientRect();

    line.startX    = rect.left  - catW * 0.5;
    line.endX      = rect.right + catW * 0.5;
    line.wallStart = performance.now();
    line.durMs     = durSecs * 1000;
    line.active    = true;
    state.targetY  = rect.top - catH * 0.10;
    state.facing   = 1;

    if (idx === 0) {
      state.x = line.startX;
      gsap.to(state, { alpha: 1, duration: 0.4, ease: 'power1.out' });
    } else {
      // Quick blink: fade out → snap to new line start → fade in
      gsap.to(state, {
        alpha: 0, duration: 0.15, ease: 'power1.in',
        onComplete: () => {
          state.x = line.startX;
          gsap.to(state, { alpha: 1, duration: 0.15, ease: 'power1.out' });
        }
      });
    }
  }

  // ── Draw — called every frame by candle.js ────────────────────
  function draw(ctx, W, H, elapsed) {
    if (!state.active || state.alpha <= 0) return;

    const now    = performance.now();
    const wallDt = Math.min((now - (lastWallMs || now)) / 1000, 0.05);
    lastWallMs   = now;

    // ── Bob: advance walkPhase via audio clock if available ───────
    const audioEl  = (typeof LyricsScene.getAudio === 'function') ? LyricsScene.getAudio() : null;
    const audioCT  = (audioEl && audioEl.currentTime > 0) ? audioEl.currentTime : null;

    if (audioCT !== null) {
      const audioDt = clamp(audioCT - lastAudioTime, 0, 0.1);
      lastAudioTime = audioCT;
      walkPhase += BOB_RATE * audioDt;
    } else {
      walkPhase += BOB_RATE * wallDt;
    }

    // ── X: wall-clock interpolation across the line ───────────────
    // This is unconditional — works whether audio plays or not.
    if (line.active && line.durMs > 0) {
      const elapsed = now - line.wallStart;
      const t = clamp(elapsed / line.durMs, 0, 1);
      state.x = line.startX + (line.endX - line.startX) * t;
    }

    // ── Smooth Y tracking ─────────────────────────────────────────
    state.y += (state.targetY - state.y) * Math.min(wallDt * 8, 1);

    // ── Waltz bob: strong beat accent every 3 beats ───────────────
    const beatPos  = (walkPhase / (Math.PI * 2)) % 3;
    const isStrong = beatPos < 1;
    const bob      = Math.sin(walkPhase) * (isStrong ? 6 : 3.5)
                   + Math.sin(walkPhase * 2) * 1.8;
    const tilt     = Math.sin(walkPhase) * 0.055 * (isStrong ? 1.4 : 0.7);

    // ── Render ────────────────────────────────────────────────────
    const scale = clamp(W / 390, 0.72, 1.35);
    const catW  = CAT_W_BASE * scale;
    const catH  = CAT_H_BASE * scale;

    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.translate(state.x, state.y + bob);
    ctx.rotate(tilt);
    if (state.facing === -1) ctx.scale(-1, 1);

    if (imgReady) {
      ctx.drawImage(catImg, -catW / 2, -catH, catW, catH);
    } else {
      ctx.beginPath();
      ctx.arc(0, -catH / 2, catW * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,160,120,0.8)';
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Finish → flash → final reveal ────────────────────────────
  function finishScene() {
    const flashEl = document.getElementById('kiss-flash');
    gsap.to(state, {
      alpha: 0, duration: 0.4, ease: 'power1.in',
      onComplete: () => { state.active = false; line.active = false; },
    });
    gsap.to(flashEl, {
      opacity: 1, duration: 0.4, ease: 'power2.in', delay: 0.5,
      onComplete: () => { gsap.delayedCall(0.3, () => FinalRevealScene.beginReveal()); },
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function beginKiss() {}

  return { init, draw, startWalk, startLine, finishScene, beginKiss };

})();
