/**
 * script.js
 * ─────────────────────────────────────────────────────────────────
 * Main controller. Runs after all modules are loaded.
 *
 * Responsibilities:
 *  1. Show loading screen for a minimum duration
 *  2. Initialise all scene modules
 *  3. Hand off to the entry scene
 *  4. Listen for the first tap to begin the experience
 */

(function () {

  const loadingScreen = document.getElementById('loading-screen');
  const experience    = document.getElementById('experience');
  const entryScene    = document.getElementById('scene-entry');

  // ── 1. Mark start time so we can enforce a minimum loading duration ──
  const startTime = Date.now();

  // ── 2. Initialise all modules ────────────────────────────────────────
  function initModules() {
    FlowerScene.init();   // sets up the canvas
    EnvelopeScene.init();
    CandleScene.init();
    CakeScene.init();
    CatScene.init();
    LyricsScene.init();
    FinalRevealScene.init();
  }

  // ── 3. Register scene onEnter handlers ──────────────────────────────
  function registerScenes() {

    // Entry scene: wait for tap → go to envelope
    SceneController.register('scene-entry', () => {
      entryScene.addEventListener('click', onFirstTap, { once: true });
    });

    // Envelope scene is registered inside EnvelopeScene.init()
    // Future scenes will be registered in their own modules
  }

  // ── 4. First tap handler ─────────────────────────────────────────────
  function onFirstTap() {
    // Fade out the entry prompt, then go to the envelope scene
    gsap.to('#tap-prompt', {
      opacity: 0,
      y: -10,
      duration: 0.4,
      ease: 'power1.in',
      onComplete: () => SceneController.go('scene-envelope'),
    });
  }

  // ── 5. Loading → experience handoff ─────────────────────────────────
  function revealExperience() {
    const elapsed   = Date.now() - startTime;
    const remaining = Math.max(0, CONFIG.timing.loadingMin - elapsed);

    setTimeout(() => {
      // Fade out loading screen
      gsap.to(loadingScreen, {
        opacity: 0,
        duration: 0.6,
        ease: 'power1.in',
        onComplete: () => {
          loadingScreen.style.display = 'none';

          // Show experience and go to entry scene
          experience.classList.remove('hidden');
          SceneController.go('scene-entry');
        }
      });
    }, remaining);
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initModules();
    registerScenes();
    revealExperience();
  });

})();
