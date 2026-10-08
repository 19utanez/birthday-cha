/**
 * lyrics.js — drives cat across each lyric line for its exact duration
 * showLine(i) calls CatScene.startLine(i, el, durSecs) so the cat
 * walks from left edge to right edge of that line in exactly holdFor seconds.
 */

const LyricsScene = (() => {

  let audio      = null;
  let started    = false;
  let lineTimers = [];

  const LINES = [
    'Happy birthday to you,',
    'Happy birthday to you,',
    'Happy birthday, happy birthday,',
    'Happy birthday to you.',
  ];

  // ── 8-bit chiptune state ──────────────────────────────────────
  let chipCtx       = null;   // AudioContext for chiptune
  let chipGain      = null;
  let chipScheduled = false;

  // Happy Birthday melody — [note in Hz, duration in beats]
  // Each beat ≈ 0.46s (~65 BPM — a bit quicker, matches tighter lyric timing)
  const BEAT = 0.46;
  const MELODY = [
    // "Hap-py birth-day to you"
    [392.00, 0.75], [392.00, 0.25], [440.00, 1.0 ], [392.00, 1.0 ],
    [523.25, 1.0 ], [493.88, 2.0 ],
    // "Hap-py birth-day to you"
    [392.00, 0.75], [392.00, 0.25], [440.00, 1.0 ], [392.00, 1.0 ],
    [587.33, 1.0 ], [523.25, 2.0 ],
    // "Hap-py birth-day, hap-py birth-day"
    [392.00, 0.75], [392.00, 0.25], [784.00, 1.0 ], [659.25, 1.0 ],
    [523.25, 1.0 ], [493.88, 1.0 ], [440.00, 2.0 ],
    [698.46, 0.75], [698.46, 0.25], [659.25, 1.0 ], [523.25, 1.0 ],
    [587.33, 1.0 ], [523.25, 2.0 ],
  ];

  function initChiptune() {
    if (chipCtx) return;
    try {
      const Ctx = window._audioContext ||
                  (window.AudioContext ? new AudioContext() : new webkitAudioContext());
      chipCtx  = Ctx;
      chipGain = Ctx.createGain();
      chipGain.gain.value = 0.12;   // subtle — underneath the main audio
      chipGain.connect(Ctx.destination);
    } catch(e) {
      console.warn('Chiptune unavailable:', e.message);
    }
  }

  function playChiptune(startDelaySec) {
    if (!chipCtx || chipScheduled) return;
    chipScheduled = true;

    const now = chipCtx.currentTime + (startDelaySec || 0.05);
    let t = now;

    for (const [freq, beats] of MELODY) {
      const dur = beats * BEAT;

      // Square wave oscillator (classic 8-bit sound)
      const osc = chipCtx.createOscillator();
      osc.type      = 'square';
      osc.frequency.value = freq;

      // Per-note gain envelope: fast attack, short decay, silence before next note
      const env = chipCtx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + 0.01);      // instant attack
      env.gain.setValueAtTime(0.85, t + 0.02);            // slight decay
      env.gain.setValueAtTime(0.85, t + dur * 0.78);      // hold
      env.gain.linearRampToValueAtTime(0, t + dur * 0.88);// release gap

      osc.connect(env);
      env.connect(chipGain);

      osc.start(t);
      osc.stop(t + dur);

      t += dur;
    }
  }

  function init() {
    audio = new Audio();
    audio.src     = CONFIG.audio.birthday;
    audio.preload = 'auto';
    audio.load();
    // Init chiptune context (will be resumed on first gesture)
    initChiptune();
  }

  function start() {
    if (started) return;
    started = true;

    // Populate text first so getBoundingClientRect() has real widths
    LINES.forEach((text, i) => {
      const el = document.getElementById('lyric-line-' + i);
      if (el) el.textContent = text;
    });

    const p = audio.play();
    if (p !== undefined) p.catch(err => console.warn('Audio autoplay blocked:', err.message));

    // 8-bit chiptune melody plays in sync with lyrics
    if (chipCtx) {
      if (chipCtx.state === 'suspended') {
        chipCtx.resume().then(() => playChiptune(0.05));
      } else {
        playChiptune(0.05);
      }
    }

    const timings = CONFIG.lyricTimings;

    timings.forEach((timing, i) => {
      // Show line text + start cat walk across this line
      const h = gsap.delayedCall(timing.showAt, () => showLine(i, timing.holdFor));
      lineTimers.push(h);

      // Dim the previous line just before the next appears
      if (i < timings.length - 1) {
        const hd = gsap.delayedCall(timings[i + 1].showAt - 0.15, () => dimLine(i));
        lineTimers.push(hd);
      }
    });

    // After last line hold, fade all out then finish
    const last = timings[timings.length - 1];
    gsap.delayedCall(last.showAt + last.holdFor, onLyricsComplete);
  }

  // ── Show line + send cat across it ────────────────────────────
  function showLine(idx, durSecs) {
    const el = document.getElementById('lyric-line-' + idx);
    if (!el) return;

    // Fade line in
    gsap.to(el, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    el.style.textShadow = `
      0 0 28px rgba(255,200,100,0.80),
      0 0 10px rgba(255,160,60,0.55),
      0 1px 4px rgba(0,0,0,0.9)
    `;
    el.style.color = '#fff5e8';

    // Tell cat to walk this line — pass showAt so X is driven by audio time
    requestAnimationFrame(() => {
      if (typeof CatScene.startLine === 'function') {
        const showAt = CONFIG.lyricTimings[idx] ? CONFIG.lyricTimings[idx].showAt : 0;
        CatScene.startLine(idx, el, durSecs, showAt);
      }
    });
  }

  function dimLine(idx) {
    const el = document.getElementById('lyric-line-' + idx);
    if (!el) return;
    gsap.to(el, { opacity: 0.28, duration: 0.4, ease: 'power1.in' });
    el.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
    el.style.color = '#d8c4b0';
  }

  function onLyricsComplete() {
    // Fade all lines
    LINES.forEach((_, i) => {
      const el = document.getElementById('lyric-line-' + i);
      if (el) gsap.to(el, { opacity: 0, duration: 0.8, ease: 'power1.in' });
    });
    // Cat fades + flash → final reveal
    if (typeof CatScene.finishScene === 'function') CatScene.finishScene();
  }

  function reset() {
    started = false;
    lineTimers.forEach(h => h.kill());
    lineTimers = [];
    if (audio) { audio.pause(); audio.currentTime = 0; }
    LINES.forEach((_, i) => {
      const el = document.getElementById('lyric-line-' + i);
      if (!el) return;
      gsap.set(el, { opacity: 0, y: 8 });
      el.style.textShadow = '';
      el.style.color = '';
    });
  }

  function stop() { reset(); }
  function getAudio() { return audio; }

  return { init, start, stop, getAudio };

})();