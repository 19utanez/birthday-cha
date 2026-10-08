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

  // ── Public API ─────────────────────────────────────────────────
  return { init };

})();
