/**
 * config.js
 * ─────────────────────────────────────────────────────────────────
 * Central configuration for the birthday experience.
 * Edit ONLY this file to personalise names, messages, and asset paths.
 */

const CONFIG = {

  // ── Girlfriend details ─────────────────────────────────────────
  girlfriend: {
    name: 'charlene',
    birthday: 'Month Day, Year',
    photo: 'assets/girlfriend/girlfriend.jpg', // ← first photo (also used as fallback)
    // Slideshow: all photos cycle every 3 s or on tap.
    // Add/remove paths here — no other file needs changing.
    photos: [
      'assets/girlfriend/girlfriend.jpg',
      'assets/girlfriend/girlfriend2.jpg',
      'assets/girlfriend/girlfriend3.jpg',
      'assets/girlfriend/girlfriend4.jpg',
      'assets/girlfriend/girlfriend5.jpg',
    ],
    // How long each photo is shown before auto-advancing (seconds)
    photoInterval: 4,
  },

  // ── Personal message (shown in the final scene) ────────────────
  message: [
    'hii happy birthday to this cute girl that i like',
    'enjoy urr dayy!! best wishes to you po',
    'may goodluck come to your birth month!!',
  ],

  // ── Audio ──────────────────────────────────────────────────────
  audio: {
    birthday: 'assets/audio/birthday.mp3', // ← Drop audio file here
  },

  // ── Timing (milliseconds) — adjust feel without touching scenes ─
  timing: {
    loadingMin:        1200,  // minimum loading screen duration
    entryFadeIn:        800,  // entry scene fade-in
    tapToEnvelopeFade:  600,  // tap → envelope scene transition
  },

  // ── Lyric timing — adjust showAt (seconds) to match your audio ─
  // showAt  : seconds after audio starts when line appears
  // holdFor : seconds the line stays active before lyrics end signal
  // showAt/holdFor derived from chiptune melody beats (BEAT=0.46s) + 0.5s lead-in
  lyricTimings: [
    { showAt:  0.50, holdFor: 3.48 }, // "Happy birthday to you,"    (6 beats × 0.58s)
    { showAt:  3.98, holdFor: 3.48 }, // "Happy birthday to you,"    (6 beats × 0.58s)
    { showAt:  7.46, holdFor: 4.06 }, // "Happy birthday dear ___,"  (7 beats × 0.58s)
    { showAt: 11.52, holdFor: 4.06 }, // "Happy birthday to you."    (7 beats × 0.58s)
  ],

  // ── Flower animation settings (used in Phase 2) ────────────────
  flowers: {
    count:     200,
    colors: ['#e8749a', '#f4a0b5', '#f7c5d5', '#c8566a', '#fde8ef'],
    duration:  4000,  // ms for full bloom
  },

};
