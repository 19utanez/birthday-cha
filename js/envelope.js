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
      master.gain.value = 0.38;
      master.connect(Ctx.destination);

      const now = Ctx.currentTime;
      const sr  = Ctx.sampleRate;

      // Short paper rustle burst
      const noiseBuf = Ctx.createBuffer(1, Math.ceil(sr * 0.18), sr);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const noise = Ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const bp = Ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.0;
      const ng = Ctx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(0.55, now + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      noise.connect(bp); bp.connect(ng); ng.connect(master);
      noise.start(now); noise.stop(now + 0.20);

      // Magical shimmer chord: C5 E5 G5 B5 ascending
      [[523.25, 0.00], [659.25, 0.10], [783.99, 0.20], [987.77, 0.32]].forEach(([freq, delay]) => {
        const osc = Ctx.createOscillator();
        const env = Ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + delay);
        env.gain.linearRampToValueAtTime(0.28, now + delay + 0.03);
        env.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.8);
        osc.connect(env); env.connect(master);
        osc.start(now + delay); osc.stop(now + delay + 1.9);

        // Subtle triangle harmonic for warmth
        const osc2 = Ctx.createOscillator();
        const env2 = Ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = freq;
        env2.gain.setValueAtTime(0, now + delay);
        env2.gain.linearRampToValueAtTime(0.10, now + delay + 0.03);
        env2.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.4);
        osc2.connect(env2); env2.connect(master);
        osc2.start(now + delay); osc2.stop(now + delay + 1.5);
      });

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
