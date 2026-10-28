// Page rustle and thunder, synthesized with Web Audio (no audio files to license).
// Off by default; the dock's speaker button turns it on and the choice is remembered.
import { store } from './util.js';

let ctx = null;
let on = store('ar-sound') === '1';
const listeners = new Set();

function audio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
  return ctx;
}

// White noise, or brown noise (integrated white noise) for low rumbles.
function noise(seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

function rustle() {
  if (!on || !audio()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise(0.6);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(1600, t);
  band.frequency.exponentialRampToValueAtTime(4200, t + 0.38);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.6);
}

function thunder(power = 1) {
  if (!on || !audio()) return;
  const t = ctx.currentTime;
  // the crack
  const crack = ctx.createBufferSource();
  crack.buffer = noise(0.25);
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 1200;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.45 * power, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  crack.connect(high).connect(cg).connect(ctx.destination);
  crack.start(t);
  // the rumble
  const rumble = ctx.createBufferSource();
  rumble.buffer = noise(3.3, true);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(900, t);
  low.frequency.exponentialRampToValueAtTime(140, t + 2.9);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t);
  rg.gain.exponentialRampToValueAtTime(0.9 * power, t + 0.06);
  rg.gain.exponentialRampToValueAtTime(0.32 * power, t + 0.7);
  rg.gain.exponentialRampToValueAtTime(0.5 * power, t + 1.1);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  rumble.connect(low).connect(rg).connect(ctx.destination);
  rumble.start(t);
  rumble.stop(t + 3.3);
}

export const sound = {
  get on() { return on; },
  set(value) {
    on = !!value;
    store('ar-sound', on ? '1' : '0');
    if (on) audio();
    listeners.forEach(fn => fn(on));
  },
  toggle() { this.set(!on); },
  onChange(fn) { listeners.add(fn); },
  rustle,
  thunder,
};
