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
  lyricTimings: [
    { showAt: 0.5,  holdFor: 2.9 },   // "Happy birthday to you,"
    { showAt: 3.8,  holdFor: 2.9 },   // "Happy birthday to you,"
    { showAt: 7.2,  holdFor: 3.2 },   // "Happy birthday, happy birthday,"
    { showAt: 10.8, holdFor: 3.2 },   // "Happy birthday to you."
  ],

  // ── Flower animation settings (used in Phase 2) ────────────────
  flowers: {
    count:     200,
    colors: ['#e8749a', '#f4a0b5', '#f7c5d5', '#c8566a', '#fde8ef'],
    duration:  4000,  // ms for full bloom
  },

};