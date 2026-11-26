export type MusicMood = "dock" | "battle";

const MUSIC_PREF_KEY = "drydock_music_enabled_v1";

let audioCtx: AudioContext | null = null;
let muted = false;
let musicEnabled = loadMusicPref();
let currentMood: MusicMood = "dock";

let musicMasterGain: GainNode | null = null;
let schedulerId: number | null = null;
let nextNoteTime = 0;
let currentStep = 0;

function loadMusicPref(): boolean {
  try {
    const raw = localStorage.getItem(MUSIC_PREF_KEY);
    if (raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

function saveMusicPref(val: boolean): void {
  try {
    localStorage.setItem(MUSIC_PREF_KEY, String(val));
  } catch {
    // Ignore storage errors
  }
}

function ensureCtx(allowWhenMuted = false): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (muted && !allowWhenMuted) return null;

  if (!audioCtx) {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }
  if (!audioCtx) return null;

  if (!musicMasterGain) {
    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.setValueAtTime(
      !muted && musicEnabled ? 0.85 : 0,
      audioCtx.currentTime
    );
    musicMasterGain.connect(audioCtx.destination);
  }

  return audioCtx;
}

function syncMusicGain(): void {
  if (!audioCtx || !musicMasterGain) return;
  const target = !muted && musicEnabled ? 0.85 : 0;
  try {
    musicMasterGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.08);
  } catch {
    // Ignore audio errors
  }
}

function getCtx(): AudioContext | null {
  const ctx = ensureCtx(false);
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isAudioMuted(): boolean {
  return muted;
}

export function setAudioMuted(next: boolean): void {
  muted = next;
  if (!next && musicEnabled) {
    unlockAndStartMusic();
  }
  syncMusicGain();
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function setMusicEnabled(next: boolean): void {
  musicEnabled = next;
  saveMusicPref(next);
  if (next && !muted) {
    unlockAndStartMusic();
  }
  syncMusicGain();
}

export function setMusicMood(mood: MusicMood): void {
  currentMood = mood;
}

// Light, airy, uplifting ambient progression (Cmaj9 -> Gmaj7/B -> Am9 -> Fmaj9)
const PROGRESSION = [
  { bass: 130.81, chord: [261.63, 329.63, 392.0, 493.88], arp: [523.25, 659.25, 783.99, 987.77] },
  { bass: 123.47, chord: [246.94, 329.63, 392.0, 587.33], arp: [493.88, 587.33, 783.99, 880.0] },
  { bass: 110.0, chord: [220.0, 329.63, 392.0, 493.88], arp: [440.0, 523.25, 659.25, 987.77] },
  { bass: 174.61, chord: [261.63, 349.23, 440.0, 523.25], arp: [523.25, 659.25, 783.99, 1046.5] },
];

function schedulePad(
  ctx: AudioContext,
  dest: AudioNode,
  freqs: number[],
  time: number,
  duration: number,
  cutoff: number,
  peak: number
): void {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.7);
  gain.gain.setValueAtTime(peak * 0.85, time + duration - 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  filter.connect(gain);
  gain.connect(dest);

  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, time);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 4, time);
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + duration + 0.08);
  }
}

function scheduleNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  type: OscillatorType,
  peak: number,
  cutoff = 2800
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(480, cutoff * 0.55), time + duration);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function scheduleStep(ctx: AudioContext, dest: AudioNode, step: number, time: number): void {
  const bar = Math.floor(step / 16) % PROGRESSION.length;
  const stepInBar = step % 16;
  const harmony = PROGRESSION[bar];
  const stepDur = currentMood === "battle" ? 0.19 : 0.22;

  if (stepInBar === 0) {
    schedulePad(ctx, dest, harmony.chord, time, stepDur * 16.5, 1900, 0.075);
    scheduleNote(ctx, dest, harmony.bass, time, stepDur * 14, "sine", 0.055, 700);
  }

  if (stepInBar % 4 === 0) {
    const idx = (Math.floor(stepInBar / 4) + bar) % harmony.arp.length;
    scheduleNote(ctx, dest, harmony.arp[idx], time, 1.15, "sine", 0.075, 3200);
  }

  if (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
    const idx = (stepInBar + bar) % harmony.arp.length;
    const peak = currentMood === "battle" ? 0.055 : 0.042;
    scheduleNote(ctx, dest, harmony.arp[idx], time, 0.9, "triangle", peak, 2600);
  }
}

export function unlockAndStartMusic(): void {
  const ctx = ensureCtx(true);
  if (!ctx || !musicMasterGain) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  syncMusicGain();

  if (schedulerId !== null) return;

  nextNoteTime = ctx.currentTime + 0.08;
  schedulerId = window.setInterval(() => {
    const activeCtx = ensureCtx(true);
    if (!activeCtx || !musicMasterGain) return;
    if (activeCtx.state !== "running") return;
    if (muted || !musicEnabled) {
      nextNoteTime = activeCtx.currentTime + 0.08;
      return;
    }

    if (nextNoteTime < activeCtx.currentTime - 0.35) {
      nextNoteTime = activeCtx.currentTime + 0.06;
    }

    const lookAhead = 0.26;
    while (nextNoteTime < activeCtx.currentTime + lookAhead) {
      scheduleStep(activeCtx, musicMasterGain, currentStep, nextNoteTime);
      const stepSec = currentMood === "battle" ? 0.19 : 0.22;
      nextNoteTime += stepSec;
      currentStep = (currentStep + 1) % 64;
    }
  }, 60);
}

export function stopMusicLoop(): void {
  if (schedulerId !== null) {
    window.clearInterval(schedulerId);
    schedulerId = null;
  }
}

function playTone(
  freq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  gainPeak: number
): void {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Ignore audio errors
  }
}

export function playPaintSound(): void {
  playTone(280, 340, 0.05, "triangle", 0.045);
}

export function playMountSound(): void {
  playTone(420, 620, 0.08, "sine", 0.06);
}

export function playEraseSound(): void {
  playTone(220, 120, 0.07, "sawtooth", 0.035);
}

export function playLaserSound(): void {
  playTone(760, 210, 0.11, "sawtooth", 0.04);
}

export function playHitSound(): void {
  playTone(190, 65, 0.14, "square", 0.055);
}

export function playBrownoutSound(): void {
  playTone(140, 95, 0.06, "triangle", 0.025);
}

export function playBoostSound(): void {
  playTone(220, 620, 0.22, "triangle", 0.065);
}
