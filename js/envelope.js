/**
 * envelope.js
 * ─────────────────────────────────────────────────────────────────
 * Romantic envelope scene — Phase 1.
 *
 * Responsibilities:
 *  - Register the scene with SceneController
 *  - On scene enter: play idle float animation
 *  - On tap: run cinematic open sequence via GSAP timeline
 *  - Prime the audio context (mobile autoplay unlock)
 *  - Signal SceneController to advance to Phase 2 when done
 */

const EnvelopeScene = (() => {

  // DOM refs (resolved in init, after DOM is ready)
  let envelopeWrap = null;
  let envelope     = null;
  let flap         = null;
  let seal         = null;
  let letter       = null;
  let prompt       = null;

  // Prevent double-tap
  let opened = false;

  // Will hold the silent AudioContext used to unlock mobile audio
  let audioCtx = null;

  // ── Public: called once by script.js on boot ───────────────────
  function init() {
    envelopeWrap = document.getElementById('envelope-wrap');
    envelope     = document.getElementById('envelope');
    flap         = document.getElementById('env-flap');
    seal         = document.getElementById('env-seal');
    letter       = document.getElementById('env-letter');
    prompt       = document.getElementById('env-prompt');

    // Register scene onEnter with the controller
    SceneController.register('scene-envelope', onEnter);
  }

  // ── Called by SceneController when this scene becomes active ───
  function onEnter() {
    opened = false;

    // Reset all transform states in case scene is re-entered
    gsap.set(envelopeWrap, { opacity: 0, y: 30 });
    gsap.set(flap,   { rotateX: 0 });
    gsap.set(seal,   { opacity: 1, scale: 1 });
    gsap.set(letter, { opacity: 0, y: 0 });
    gsap.set(prompt, { opacity: 0 });

    // Fade-in + float the envelope into view
    const intro = gsap.timeline();

    intro
      .to(envelopeWrap, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power2.out',
      })
      .to(prompt, {
        opacity: 0.75,
        duration: 0.6,
        ease: 'power1.out',
      }, '-=0.2')
      .call(startIdleFloat);  // gentle hover after intro

    // Attach tap listener
    envelope.addEventListener('click',      onTap, { once: true });
    envelope.addEventListener('touchstart', onTap, { once: true, passive: true });
  }

  // ── Idle float animation (loops until opened) ──────────────────
  function startIdleFloat() {
    gsap.to(envelopeWrap, {
      y: -10,
      duration: 2.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  // ── Tap handler ────────────────────────────────────────────────
  function onTap(e) {
    if (opened) return;
    opened = true;

    // Remove the second listener type (click or touchstart)
    envelope.removeEventListener('click',      onTap);
    envelope.removeEventListener('touchstart', onTap);

    // Unlock audio context on first user gesture
    unlockAudio();

    // Play envelope opening sound
    playEnvelopeSound();

    // Kill the float so it doesn't fight GSAP
    gsap.killTweensOf(envelopeWrap);

    // Run the cinematic open sequence
    openEnvelope();
  }

  // ── Cinematic open sequence ────────────────────────────────────
  function openEnvelope() {
    const tl = gsap.timeline({ onComplete: onOpenComplete });

    tl
      // 1. React to touch: quick press-down
      .to(envelope, {
        scaleX: 0.96,
        scaleY: 0.97,
        duration: 0.12,
        ease: 'power2.in',
      })

      // 2. Slight tilt — like picking up a letter
      .to(envelope, {
        scaleX: 1,
        scaleY: 1,
        rotation: -2,
        y: -8,
        duration: 0.25,
        ease: 'power2.out',
      })

      // 3. Fade out the "tap to open" prompt
      .to(prompt, {
        opacity: 0,
        duration: 0.25,
        ease: 'power1.in',
      }, '<')

      // 4. Seal cracks: scale up then shrink-away
      .to(seal, {
        scale: 1.15,
        duration: 0.18,
        ease: 'back.out(2)',
      })
      .to(seal, {
        scale: 0,
        opacity: 0,
        duration: 0.22,
        ease: 'power2.in',
      })

      // 5. Flap lifts open — rotateX with perspective gives 3-D fold
      .to(flap, {
        rotateX: -178,
        duration: 0.82,
        ease: 'power2.inOut',
      })

      // 6. Envelope settles: straighten, rise slightly
      .to(envelope, {
        rotation: 0,
        y: -18,
        duration: 0.45,
        ease: 'power2.out',
      }, '-=0.35')

      // 7. Letter slides up from inside
      .to(letter, {
        opacity: 1,
        y: -28,
        duration: 0.55,
        ease: 'power3.out',
      }, '-=0.2')

      // 8. Envelope + letter float upward and fade out (clean exit)
      .to(envelopeWrap, {
        y: -60,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.in',
        delay: 0.55,
      });
  }

  // ── After animation ends: advance to next scene ────────────────
  function onOpenComplete() {
    SceneController.go('scene-flowers');
  }

  // ── Audio unlock (mobile autoplay fix) ────────────────────────
  // Creates a silent AudioContext on the first user gesture.
  // Later, LyricsScene can check window._audioUnlocked before playing.
  function unlockAudio() {
    try {
      if (window._audioUnlocked) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      // Play a zero-duration silent buffer to satisfy the browser
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
      window._audioUnlocked = true;
      window._audioContext  = audioCtx;
      console.log('Audio context unlocked.');
    } catch (err) {
      console.warn('Audio unlock failed (non-fatal):', err);
    }
  }

  // ── Envelope opening sound ────────────────────────────────────
  // Paper rustle → seal crack pop → flap whoosh → soft letter slide
  function playEnvelopeSound() {
    try {
      const Ctx = window._audioContext;
      if (!Ctx) return;
      if (Ctx.state === 'suspended') Ctx.resume();

      const master = Ctx.createGain();
      master.gain.value = 0.50;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;

      // ── 1. Paper rustle — bandpass noise, short & papery ──────
      const rustleDur = 0.35;
      const rBuf  = Ctx.createBuffer(1, Ctx.sampleRate * rustleDur, Ctx.sampleRate);
      const rData = rBuf.getChannelData(0);
      for (let i = 0; i < rData.length; i++) rData[i] = Math.random() * 2 - 1;
      const rSrc = Ctx.createBufferSource();
      const rBp  = Ctx.createBiquadFilter();
      const rEnv = Ctx.createGain();
      rSrc.buffer = rBuf;
      rBp.type = 'bandpass'; rBp.frequency.value = 4200; rBp.Q.value = 0.8;
      rEnv.gain.setValueAtTime(0, now);
      rEnv.gain.linearRampToValueAtTime(0.70, now + 0.05);
      rEnv.gain.linearRampToValueAtTime(0.30, now + 0.20);
      rEnv.gain.linearRampToValueAtTime(0, now + rustleDur);
      rSrc.connect(rBp); rBp.connect(rEnv); rEnv.connect(master);
      rSrc.start(now); rSrc.stop(now + rustleDur + 0.05);

      // ── 2. Wax seal crack — short pitched pop ─────────────────
      const pop = Ctx.createOscillator();
      const popEnv = Ctx.createGain();
      pop.type = 'sine';
      pop.frequency.setValueAtTime(320, now + 0.42);
      pop.frequency.exponentialRampToValueAtTime(80, now + 0.52);
      popEnv.gain.setValueAtTime(0.65, now + 0.42);
      popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      pop.connect(popEnv); popEnv.connect(master);
      pop.start(now + 0.42); pop.stop(now + 0.56);

      // ── 3. Flap whoosh — filtered noise sweep ─────────────────
      const wDur = 0.55;
      const wBuf  = Ctx.createBuffer(1, Ctx.sampleRate * wDur, Ctx.sampleRate);
      const wData = wBuf.getChannelData(0);
      for (let i = 0; i < wData.length; i++) wData[i] = Math.random() * 2 - 1;
      const wSrc = Ctx.createBufferSource();
      const wLp  = Ctx.createBiquadFilter();
      const wEnv = Ctx.createGain();
      wSrc.buffer = wBuf;
      wLp.type = 'lowpass';
      wLp.frequency.setValueAtTime(2200, now + 0.56);
      wLp.frequency.exponentialRampToValueAtTime(400, now + 0.56 + wDur);
      wEnv.gain.setValueAtTime(0, now + 0.56);
      wEnv.gain.linearRampToValueAtTime(0.55, now + 0.62);
      wEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.56 + wDur);
      wSrc.connect(wLp); wLp.connect(wEnv); wEnv.connect(master);
      wSrc.start(now + 0.56); wSrc.stop(now + 0.56 + wDur + 0.05);

      // ── 4. Letter slide — soft paper whisper ──────────────────
      const sDur = 0.30;
      const sBuf  = Ctx.createBuffer(1, Ctx.sampleRate * sDur, Ctx.sampleRate);
      const sData = sBuf.getChannelData(0);
      for (let i = 0; i < sData.length; i++) sData[i] = Math.random() * 2 - 1;
      const sSrc = Ctx.createBufferSource();
      const sBp  = Ctx.createBiquadFilter();
      const sEnv = Ctx.createGain();
      sSrc.buffer = sBuf;
      sBp.type = 'bandpass'; sBp.frequency.value = 2800; sBp.Q.value = 1.2;
      sEnv.gain.setValueAtTime(0, now + 1.1);
      sEnv.gain.linearRampToValueAtTime(0.28, now + 1.18);
      sEnv.gain.exponentialRampToValueAtTime(0.001, now + 1.1 + sDur);
      sSrc.connect(sBp); sBp.connect(sEnv); sEnv.connect(master);
      sSrc.start(now + 1.1); sSrc.stop(now + 1.1 + sDur + 0.05);

    } catch(e) {
      console.warn('Envelope sound unavailable:', e.message);
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  return { init };

})();
