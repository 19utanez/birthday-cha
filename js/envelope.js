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

    // Show silent-mode reminder if not already shown
    if (!document.getElementById('silent-notice')) {
      const notice = document.createElement('div');
      notice.id = 'silent-notice';
      notice.innerHTML = '🔔 Turn off silent mode for music';
      notice.style.cssText = `
        position:fixed; bottom:22px; left:50%; transform:translateX(-50%);
        background:rgba(30,10,18,0.72); color:#fff;
        font-size:0.78rem; letter-spacing:0.03em;
        padding:8px 18px; border-radius:20px;
        backdrop-filter:blur(6px);
        pointer-events:none; z-index:999;
        white-space:nowrap;
        opacity:0; transition:opacity 0.5s ease;
      `;
      document.body.appendChild(notice);
      setTimeout(() => { notice.style.opacity = '1'; }, 800);
      // Fade out after 5s
      setTimeout(() => {
        notice.style.opacity = '0';
        setTimeout(() => notice.remove(), 600);
      }, 5500);
    }

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

    // Play envelope open sound immediately inside this gesture (iOS requires it)
    playEnvelopeSound();

    // Kill the float so it doesn't fight GSAP
    gsap.killTweensOf(envelopeWrap);

    // Run the cinematic open sequence
    openEnvelope();
  }

  // ── Envelope open sound ────────────────────────────────────────
  // Physically accurate sequence:
  //  0.00s  wax seal crack — low thud + high-freq click
  //  0.10s  flap peel start — slow friction scrape rising in pitch
  //  0.45s  flap fully open — soft paper flutter/flap landing
  //  0.70s  letter slide out — smooth paper-on-paper drag
  //  1.10s  letter unfold crinkle — two quick paper crease snaps
  function playEnvelopeSound() {
    try {
      const Ctx = audioCtx;
      if (!Ctx) return;

      const master = Ctx.createGain();
      master.gain.value = 0.55;
      master.connect(Ctx.destination);

      const sr  = Ctx.sampleRate;
      const now = Ctx.currentTime;

      // Helper: generate a noise buffer of given seconds
      function makeNoiseBuf(secs) {
        const len = Math.ceil(sr * secs);
        const buf = Ctx.createBuffer(1, len, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
      }

      // Helper: play a shaped noise burst
      function noiseShot(startT, durSecs, freqLo, freqHi, peakT, peakGain, decayEnd) {
        const src = Ctx.createBufferSource();
        src.buffer = makeNoiseBuf(durSecs + 0.05);

        // Two bandpass filters in series to narrow the spectrum
        const bp1 = Ctx.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.frequency.setValueAtTime(freqLo, startT);
        bp1.frequency.linearRampToValueAtTime(freqHi, startT + durSecs);
        bp1.Q.value = 1.2;

        const bp2 = Ctx.createBiquadFilter();
        bp2.type  = 'highshelf';
        bp2.frequency.value = 3000;
        bp2.gain.value = -6;

        const g = Ctx.createGain();
        g.gain.setValueAtTime(0, startT);
        g.gain.linearRampToValueAtTime(peakGain, startT + peakT);
        g.gain.exponentialRampToValueAtTime(0.001, startT + decayEnd);

        src.connect(bp1); bp1.connect(bp2); bp2.connect(g); g.connect(master);
        src.start(startT);
        src.stop(startT + durSecs + 0.05);
      }

      // 1. Wax seal crack — dull thud (low sine sweep) + sharp click (short noise)
      const sealOsc  = Ctx.createOscillator();
      const sealGain = Ctx.createGain();
      sealOsc.type = 'sine';
      sealOsc.frequency.setValueAtTime(220, now);
      sealOsc.frequency.exponentialRampToValueAtTime(55, now + 0.09);
      sealGain.gain.setValueAtTime(0.85, now);
      sealGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
      sealOsc.connect(sealGain); sealGain.connect(master);
      sealOsc.start(now); sealOsc.stop(now + 0.11);

      // High-freq click component of the crack
      noiseShot(now, 0.04, 3000, 6000, 0.005, 0.9, 0.04);

      // 2. Flap peel — slow friction scrape: noise sweeping 600→1800Hz over 0.35s
      //    Models paper adhesive tearing away gradually
      noiseShot(now + 0.10, 0.38, 600, 1800, 0.06, 0.42, 0.38);

      // 3. Mid-peel crinkle — slight pitch spike as flap crosses 90°
      noiseShot(now + 0.30, 0.12, 1200, 3000, 0.02, 0.55, 0.12);

      // 4. Flap lands open — soft paper flutter (fast decay, low-mid freq)
      noiseShot(now + 0.46, 0.18, 300, 900, 0.015, 0.48, 0.18);

      // 5. Letter slide out — paper-on-paper drag: smooth 800→400Hz descending
      //    Slightly longer, gentle envelope, mimics letter being pulled out slowly
      {
        const src = Ctx.createBufferSource();
        src.buffer = makeNoiseBuf(0.50);
        const bp = Ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(800, now + 0.70);
        bp.frequency.linearRampToValueAtTime(350, now + 1.20);
        bp.Q.value = 0.9;
        const lp = Ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2200;
        const g = Ctx.createGain();
        g.gain.setValueAtTime(0, now + 0.70);
        g.gain.linearRampToValueAtTime(0.38, now + 0.78);
        g.gain.setValueAtTime(0.35, now + 1.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.22);
        src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
        src.start(now + 0.70);
        src.stop(now + 1.22);
      }

      // 6. Letter unfold — two quick paper crease snaps (short sharp noise spikes)
      noiseShot(now + 1.10, 0.06, 1000, 4000, 0.008, 0.65, 0.055);
      noiseShot(now + 1.18, 0.05, 800,  3500, 0.007, 0.50, 0.048);

    } catch(e) {
      console.warn('Envelope sound failed:', e.message);
    }
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
      const CtxClass = window.AudioContext || window.webkitAudioContext;
      if (!CtxClass) return;

      // Create context synchronously inside the gesture — iOS requirement
      audioCtx = new CtxClass();

      // Play a zero-duration silent buffer to satisfy iOS
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);

      window._audioUnlocked = true;
      window._audioContext  = audioCtx;

      // Unlock the actual birthday <audio> element on this same gesture.
      // iOS only allows audio.play() inside a direct user gesture, so we
      // call play()+pause() immediately — this primes the element so
      // LyricsScene.start() can play it freely later without another tap.
      const doUnlockAudioEl = (el) => {
        if (!el) return;
        el.muted = true;
        const p = el.play();
        if (p) p.then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => {});
      };

      // Unlock the birthday song element if already created
      if (window._birthdayAudio) doUnlockAudioEl(window._birthdayAudio);

      // Also watch for it being created shortly after (if lyrics.js inits later)
      const checkInterval = setInterval(() => {
        if (window._birthdayAudio) {
          doUnlockAudioEl(window._birthdayAudio);
          clearInterval(checkInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 3000);

      // Keep context alive on every subsequent touch (iOS suspends it on blur)
      document.addEventListener('touchstart', () => {
        if (window._audioContext && window._audioContext.state === 'suspended') {
          window._audioContext.resume().catch(() => {});
        }
      }, { passive: true });

      console.log('Audio context unlocked.');
    } catch (err) {
      console.warn('Audio unlock failed (non-fatal):', err);
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  return { init };

})();
