/**
 * scenes.js
 * ─────────────────────────────────────────────────────────────────
 * Scene/state controller.
 *
 * Each scene has a string ID that matches the HTML element's id.
 * Call SceneController.go('scene-id') to transition to any scene.
 *
 * Scenes register an optional onEnter callback via
 * SceneController.register('scene-id', onEnterFn).
 */

const SceneController = (() => {

  // Map of scene-id → onEnter callback
  const registry = {};

  // The currently active scene element
  let current = null;

  /**
   * Register an onEnter handler for a scene.
   * @param {string} sceneId  — matches the element's id
   * @param {Function} onEnter — called after the scene becomes active
   */
  function register(sceneId, onEnter) {
    registry[sceneId] = onEnter;
  }

  /**
   * Transition to a scene by id.
   * Fades out current → fades in next → calls onEnter.
   * @param {string} sceneId
   */
  function go(sceneId) {
    const next = document.getElementById(sceneId);

    if (!next) {
      console.warn(`SceneController.go: no element found with id "${sceneId}"`);
      return;
    }

    if (current && current !== next) {
      // Fade out the current scene
      gsap.to(current, {
        opacity: 0,
        duration: 0.5,
        ease: 'power1.in',
        onComplete: () => {
          current.classList.remove('active');
          current.style.opacity = '';
          activateScene(next);
        }
      });
    } else {
      activateScene(next);
    }
  }

  /** Internal: make a scene visible and call its onEnter */
  function activateScene(sceneEl) {
    sceneEl.classList.add('active');
    sceneEl.style.opacity = 0;

    gsap.to(sceneEl, {
      opacity: 1,
      duration: 0.5,
      ease: 'power1.out',
      onComplete: () => {
        current = sceneEl;
        const handler = registry[sceneEl.id];
        if (typeof handler === 'function') handler();
      }
    });
  }

  /**
   * Return the id of the currently active scene.
   * @returns {string|null}
   */
  function currentId() {
    return current ? current.id : null;
  }

  return { register, go, currentId };

})();
