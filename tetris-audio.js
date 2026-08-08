// Synthesized SFX + BGM for the Tetris pages -- no audio files at all, just
// Web Audio oscillators. Shared by solo and multiplayer. Also auto-wires a
// volume slider (#volume-slider) and music toggle (#music-toggle) if the
// page has them.
(function () {
  "use strict";

  const VOLUME_KEY = "koppepandayo-tetris-volume";
  const MUSIC_KEY = "koppepandayo-tetris-music-on";
  const DEFAULT_VOLUME = 0.25;

  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let musicTimer = null;
  let musicOn = localStorage.getItem(MUSIC_KEY) !== "false";

  let volume = Number(localStorage.getItem(VOLUME_KEY));
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) volume = DEFAULT_VOLUME;

  function ensureContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(masterGain);
  }

  function resume() {
    ensureContext();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    localStorage.setItem(VOLUME_KEY, String(volume));
    if (masterGain && ctx) masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }

  function getVolume() {
    return volume;
  }

  function beep(opts) {
    if (!ctx) return;
    const { freq = 440, duration = 0.08, type = "square", gain = 0.3, sweep = null, delay = 0 } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweep), t0 + duration);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function chord(freqs, opts) {
    freqs.forEach((f, i) => beep({ ...opts, freq: f, delay: (opts.delay || 0) + i * (opts.stagger || 0.03) }));
  }

  const SFX = {
    move: () => beep({ freq: 220, duration: 0.03, type: "square", gain: 0.15 }),
    rotate: () => beep({ freq: 330, duration: 0.04, type: "square", gain: 0.18 }),
    softdrop: () => beep({ freq: 150, duration: 0.02, type: "square", gain: 0.1 }),
    harddrop: () => beep({ freq: 100, duration: 0.08, type: "square", gain: 0.3, sweep: 50 }),
    lock: () => beep({ freq: 200, duration: 0.05, type: "triangle", gain: 0.18 }),
    hold: () => beep({ freq: 500, duration: 0.05, type: "sine", gain: 0.2 }),
    line1: () => beep({ freq: 440, duration: 0.12, type: "square", gain: 0.25 }),
    line2: () => chord([440, 554], { duration: 0.12, type: "square", gain: 0.22 }),
    line3: () => chord([440, 554, 659], { duration: 0.14, type: "square", gain: 0.22 }),
    tetris: () => chord([440, 554, 659, 880], { duration: 0.2, type: "square", gain: 0.25, stagger: 0.05 }),
    tspin: () => beep({ freq: 300, duration: 0.15, type: "sawtooth", gain: 0.2, sweep: 700 }),
    levelup: () => chord([523, 659, 784], { duration: 0.15, type: "triangle", gain: 0.25, stagger: 0.07 }),
    gameover: () => chord([392, 349, 293, 220], { duration: 0.25, type: "triangle", gain: 0.25, stagger: 0.15 }),
    countdown: () => beep({ freq: 440, duration: 0.1, type: "square", gain: 0.3 }),
    go: () => beep({ freq: 880, duration: 0.15, type: "square", gain: 0.35 }),
    attack: () => beep({ freq: 600, duration: 0.1, type: "sawtooth", gain: 0.2, sweep: 200 }),
    incoming: () => beep({ freq: 200, duration: 0.15, type: "square", gain: 0.25, sweep: 450 }),
    ko: () => beep({ freq: 150, duration: 0.4, type: "sawtooth", gain: 0.3, sweep: 60 }),
    victory: () => chord([523, 659, 784, 1046], { duration: 0.3, type: "triangle", gain: 0.3, stagger: 0.1 }),
    join: () => beep({ freq: 660, duration: 0.06, type: "sine", gain: 0.2 }),
  };

  function playSFX(name) {
    resume();
    if (!ctx) return;
    const fn = SFX[name];
    if (fn) fn();
  }

  // Short original chiptune-style loop (not the Tetris theme -- avoids any
  // question of copying that specific arrangement).
  const MELODY = [
    [440, 1], [523, 1], [587, 1], [659, 1], [587, 1], [523, 1], [440, 1], [0, 1],
    [349, 1], [392, 1], [440, 1], [494, 1], [440, 1], [392, 1], [349, 1], [0, 1],
  ];
  const BEAT = 0.22;

  function scheduleMusic() {
    if (!musicOn || !ctx) return;
    let t = ctx.currentTime + 0.05;
    for (const [freq, beats] of MELODY) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + beats * BEAT * 0.9);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(t);
        osc.stop(t + beats * BEAT);
      }
      t += beats * BEAT;
    }
    const loopSeconds = MELODY.reduce((s, [, b]) => s + b, 0) * BEAT;
    musicTimer = setTimeout(scheduleMusic, loopSeconds * 1000 - 50);
  }

  function startMusic() {
    resume();
    if (!ctx || musicTimer || !musicOn) return;
    scheduleMusic();
  }

  function stopMusic() {
    clearTimeout(musicTimer);
    musicTimer = null;
  }

  function toggleMusic() {
    musicOn = !musicOn;
    localStorage.setItem(MUSIC_KEY, String(musicOn));
    if (musicOn) startMusic();
    else stopMusic();
    return musicOn;
  }

  function isMusicOn() {
    return musicOn;
  }

  window.TetrisAudio = {
    resume,
    setVolume,
    getVolume,
    playSFX,
    startMusic,
    stopMusic,
    toggleMusic,
    isMusicOn,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("volume-slider");
    if (slider) {
      slider.value = String(Math.round(volume * 100));
      slider.addEventListener("input", () => {
        setVolume(Number(slider.value) / 100);
      });
      slider.addEventListener("pointerdown", () => resume());
    }
    const musicBtn = document.getElementById("music-toggle");
    if (musicBtn) {
      musicBtn.textContent = musicOn ? "🎵" : "🔇";
      musicBtn.addEventListener("click", () => {
        resume();
        musicBtn.textContent = toggleMusic() ? "🎵" : "🔇";
      });
    }
  });
})();
