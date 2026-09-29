// scripts/generate-bgm.js
// Procedural high-energy 124 BPM Synthwave Loop Generator for InterRun
// Generates a sample-accurate, seamless 16-bar loop saved as a 44.1kHz 16-bit Stereo WAV file.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 44100;
const BPM = 124;
const BEAT_DURATION = 60 / BPM; // ~0.48387s
const SIXTEENTH = BEAT_DURATION / 4; // ~0.12097s
const TOTAL_BARS = 16;
const TOTAL_BEATS = TOTAL_BARS * 4; // 64 beats
const DURATION = TOTAL_BEATS * BEAT_DURATION; // ~30.9677s
const TOTAL_SAMPLES = Math.round(DURATION * SAMPLE_RATE);

console.log(`[BGM Generator] Generating ${TOTAL_BARS}-bar Synthwave Loop at ${BPM} BPM...`);
console.log(`[BGM Generator] Duration: ${DURATION.toFixed(2)}s (${TOTAL_SAMPLES} samples at ${SAMPLE_RATE}Hz)`);

// Buffers for Left and Right channels (Float32 for mixing)
const left = new Float32Array(TOTAL_SAMPLES);
const right = new Float32Array(TOTAL_SAMPLES);

// Helper: Wrap time for seamless looping
function wrapSample(idx) {
  return ((idx % TOTAL_SAMPLES) + TOTAL_SAMPLES) % TOTAL_SAMPLES;
}

// ─── SYNTHESIS HELPERS ────────────────────────────────────────────────────────

// Band-limited bandpass / lowpass state-variable filter simulation
class SVFilter {
  constructor(cutoff = 1000, q = 1.5) {
    this.cutoff = cutoff;
    this.q = q;
    this.low = 0;
    this.band = 0;
  }
  process(input, cutoff = this.cutoff) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SAMPLE_RATE * 0.45)) / SAMPLE_RATE);
    const qInv = 1 / this.q;
    this.low += f * this.band;
    const high = input - this.low - qInv * this.band;
    this.band += f * high;
    return this.low;
  }
}

// ─── 1. KICK DRUM (Four on the floor) ─────────────────────────────────────────
function addKick(startTime, velocity = 0.9) {
  const kickDuration = 0.28;
  const kickSamples = Math.round(kickDuration * SAMPLE_RATE);
  const startIdx = Math.round(startTime * SAMPLE_RATE);

  for (let i = 0; i < kickSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 18);
    // Pitch drops from 150Hz to 42Hz
    const freq = 42 + 108 * Math.exp(-t * 35);
    const phase = 2 * Math.PI * (42 * t + (108 / 35) * (1 - Math.exp(-t * 35)));
    let val = Math.sin(phase) * env * velocity;
    // Add subtle distortion click at start
    if (t < 0.015) {
      val += (Math.random() * 2 - 1) * 0.15 * (1 - t / 0.015);
    }
    const idx = wrapSample(startIdx + i);
    left[idx] += val * 0.85;
    right[idx] += val * 0.85;
  }
}

// ─── 2. SNARE DRUM (Beats 2 and 4) ───────────────────────────────────────────
function addSnare(startTime, velocity = 0.75) {
  const snareDuration = 0.22;
  const snareSamples = Math.round(snareDuration * SAMPLE_RATE);
  const startIdx = Math.round(startTime * SAMPLE_RATE);

  for (let i = 0; i < snareSamples; i++) {
    const t = i / SAMPLE_RATE;
    const toneEnv = Math.exp(-t * 24);
    const noiseEnv = Math.exp(-t * 16);
    // Body: 185Hz dropping to 130Hz
    const tone = Math.sin(2 * Math.PI * (130 + 55 * Math.exp(-t * 40)) * t) * toneEnv * 0.5;
    // Snappy noise
    const noise = (Math.random() * 2 - 1) * noiseEnv * 0.6;
    const val = (tone + noise) * velocity;

    const idx = wrapSample(startIdx + i);
    left[idx] += val * 0.7;
    right[idx] += val * 0.7;
  }
}

// ─── 3. HI-HAT (16th notes, accented off-beats) ──────────────────────────────
function addHiHat(startTime, isOpen = false, velocity = 0.4) {
  const hatDuration = isOpen ? 0.15 : 0.055;
  const hatSamples = Math.round(hatDuration * SAMPLE_RATE);
  const startIdx = Math.round(startTime * SAMPLE_RATE);
  const decay = isOpen ? 22 : 65;

  let lastNoise = 0;
  for (let i = 0; i < hatSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * decay);
    // High-pass filtered noise
    const rawNoise = Math.random() * 2 - 1;
    const hpNoise = rawNoise - lastNoise * 0.85;
    lastNoise = rawNoise;

    const val = hpNoise * env * velocity;
    const idx = wrapSample(startIdx + i);
    // Slight stereo spread
    left[idx] += val * 0.55;
    right[idx] += val * 0.45;
  }
}

// ─── 4. SYNTH BASS (16th notes rolling bassline) ──────────────────────────────
function addBassNote(startTime, duration, freq, velocity = 0.6) {
  const noteSamples = Math.round(duration * SAMPLE_RATE);
  const startIdx = Math.round(startTime * SAMPLE_RATE);
  const filter = new SVFilter(1800, 2.2);

  for (let i = 0; i < noteSamples; i++) {
    const t = i / SAMPLE_RATE;
    const ampEnv = Math.exp(-t * 12);
    const filterEnv = Math.exp(-t * 18);
    const cutoff = 250 + 2200 * filterEnv;

    // Sawtooth wave + sub-oscillator
    const phase = (freq * t) % 1;
    const saw = 2 * phase - 1;
    const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t);

    const raw = saw * 0.7 + sub * 0.4;
    const filtered = filter.process(raw, cutoff);
    const val = filtered * ampEnv * velocity;

    const idx = wrapSample(startIdx + i);
    left[idx] += val * 0.7;
    right[idx] += val * 0.7;
  }
}

// ─── 5. SYNTH PAD / CHORD ─────────────────────────────────────────────────────
function addPadChord(startTime, duration, freqs, velocity = 0.28) {
  const padSamples = Math.round((duration + 0.8) * SAMPLE_RATE); // includes tail
  const startIdx = Math.round(startTime * SAMPLE_RATE);
  const filterL = new SVFilter(1400, 1.2);
  const filterR = new SVFilter(1400, 1.2);

  for (let i = 0; i < padSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Attack / Release envelope
    let env = 1;
    if (t < 0.15) env = t / 0.15;
    else if (t > duration) env = Math.max(0, 1 - (t - duration) / 0.8);

    let mixL = 0;
    let mixR = 0;

    for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
      const f = freqs[fIdx];
      // Detuned supersaw voices
      const saw1 = 2 * ((f * 0.997 * t) % 1) - 1;
      const saw2 = 2 * ((f * 1.003 * t) % 1) - 1;
      const saw3 = 2 * ((f * t) % 1) - 1;

      mixL += (saw1 + saw3 * 0.5) / freqs.length;
      mixR += (saw2 + saw3 * 0.5) / freqs.length;
    }

    const filteredL = filterL.process(mixL, 1600 + 400 * Math.sin(t * 1.5));
    const filteredR = filterR.process(mixR, 1600 + 400 * Math.cos(t * 1.5));

    const idx = wrapSample(startIdx + i);
    left[idx] += filteredL * env * velocity;
    right[idx] += filteredR * env * velocity;
  }
}

// ─── 6. SYNTH LEAD / ARPEGGIO ────────────────────────────────────────────────
function addArpNote(startTime, duration, freq, velocity = 0.32, pan = 0) {
  const noteSamples = Math.round((duration + 0.25) * SAMPLE_RATE); // slight delay tail
  const startIdx = Math.round(startTime * SAMPLE_RATE);
  const filter = new SVFilter(2800, 2.0);

  for (let i = 0; i < noteSamples; i++) {
    const t = i / SAMPLE_RATE;
    const ampEnv = Math.exp(-t * 9);
    const filterEnv = Math.exp(-t * 16);
    const cutoff = 600 + 3400 * filterEnv;

    // Pulse / Square wave with PWM
    const width = 0.5 + 0.3 * Math.sin(t * 8);
    const phase = (freq * t) % 1;
    const square = phase < width ? 1 : -1;

    const filtered = filter.process(square, cutoff);
    const val = filtered * ampEnv * velocity;

    const panL = 0.5 * (1 - pan);
    const panR = 0.5 * (1 + pan);

    const idx = wrapSample(startIdx + i);
    left[idx] += val * panL;
    right[idx] += val * panR;

    // Subtle stereo delay echo (3 sixteenth notes later)
    const delayIdx = wrapSample(startIdx + i + Math.round(SIXTEENTH * 3 * SAMPLE_RATE));
    left[delayIdx] += val * panR * 0.25;
    right[delayIdx] += val * panL * 0.25;
  }
}

// ─── COMPOSITION ─────────────────────────────────────────────────────────────
console.log('[BGM Generator] Composing tracks...');

// 4-Bar Chord Progression: Am -> F -> C -> G
// Repeated 4 times to make 16 bars total
const CHORDS = [
  // Am
  { root: 55.0, pad: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 587.33, 659.25] },
  // F
  { root: 43.65, pad: [174.61, 220.0, 261.63], arp: [349.23, 440.0, 523.25, 698.46, 523.25, 440.0, 392.0, 440.0] },
  // C
  { root: 65.41, pad: [130.81, 196.0, 261.63], arp: [392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25] },
  // G
  { root: 48.99, pad: [196.0, 246.94, 293.66], arp: [392.0, 493.88, 587.33, 783.99, 587.33, 493.88, 440.0, 493.88] },
];

for (let bar = 0; bar < TOTAL_BARS; bar++) {
  const barStart = bar * 4 * BEAT_DURATION;
  const chord = CHORDS[bar % 4];

  // A. Pads (Full 4-bar sustain with crossfade)
  addPadChord(barStart, 4 * BEAT_DURATION, chord.pad, 0.26);

  // B. Beats & Rhythms
  for (let beat = 0; beat < 4; beat++) {
    const beatTime = barStart + beat * BEAT_DURATION;

    // Kick on every beat
    addKick(beatTime, 0.95);

    // Snare on beats 2 and 4
    if (beat === 1 || beat === 3) {
      addSnare(beatTime, 0.8);
    }

    // 16th Note Groove
    for (let s = 0; s < 4; s++) {
      const stepTime = beatTime + s * SIXTEENTH;
      const stepInBar = beat * 4 + s;

      // Hi-Hats: accented off-beat (s === 2)
      const isOffbeat = (s === 2);
      const isGhost = (s === 1 || s === 3);
      addHiHat(stepTime, isOffbeat, isOffbeat ? 0.38 : (isGhost ? 0.16 : 0.22));

      // Rolling 16th Bassline: root on downbeats, octave hop on off-beats
      const isOctave = (s === 2 || s === 3);
      const bassFreq = isOctave ? chord.root * 2 : chord.root;
      addBassNote(stepTime, SIXTEENTH * 0.9, bassFreq, 0.65);

      // Driving Synth Arpeggio
      const arpFreq = chord.arp[stepInBar % chord.arp.length];
      const pan = Math.sin((stepInBar / 16) * Math.PI * 2) * 0.4;
      addArpNote(stepTime, SIXTEENTH * 0.85, arpFreq, 0.30, pan);
    }
  }

  // Snare roll turn-around at bar 8 and bar 16
  if (bar === 7 || bar === 15) {
    for (let r = 0; r < 8; r++) {
      const rollTime = barStart + 3 * BEAT_DURATION + (r * SIXTEENTH * 0.5);
      addSnare(rollTime, 0.3 + (r / 8) * 0.5);
    }
  }
}

// ─── MASTERING: SOFT LIMITER & NORMALIZATION ─────────────────────────────────
console.log('[BGM Generator] Mastering & Soft Limiting...');

let peak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Soft saturation tanh
  left[i] = Math.tanh(left[i] * 0.95);
  right[i] = Math.tanh(right[i] * 0.95);
  const p = Math.max(Math.abs(left[i]), Math.abs(right[i]));
  if (p > peak) peak = p;
}

const targetPeak = 0.92;
const gain = targetPeak / Math.max(peak, 0.001);
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  left[i] *= gain;
  right[i] *= gain;
}

// ─── WRITE WAV FILE ──────────────────────────────────────────────────────────
function createWavBuffer(leftCh, rightCh, sampleRate) {
  const numSamples = leftCh.length;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp to 16-bit signed integer [-32768, 32767]
    const sL = Math.max(-1, Math.min(1, leftCh[i]));
    const sR = Math.max(-1, Math.min(1, rightCh[i]));
    buffer.writeInt16LE(Math.round(sL * 32767), offset);
    offset += 2;
    buffer.writeInt16LE(Math.round(sR * 32767), offset);
    offset += 2;
  }

  return buffer;
}

const outDir = path.resolve(__dirname, '../public/audio');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'bgm.wav');
const wavBuffer = createWavBuffer(left, right, SAMPLE_RATE);
fs.writeFileSync(outPath, wavBuffer);

console.log(`[BGM Generator] Success! Generated ${outPath} (${(wavBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
