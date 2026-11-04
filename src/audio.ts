// Synthesized Discord-style notification pings via the Web Audio API.
// Sounds are generated at runtime so no copyrighted audio ships with the
// project. Each tone is built to be instantly recognizable by ear: the
// familiar two-note ding, a haunted tritone, jingling bells, digital
// corruption, and a vast hum from somewhere below the server room.

/** Minimum gap between plays so rapid clicks do not stack into mush. */
const MIN_REPEAT_SECONDS = 0.045;
/** Ambient tones need a longer gap or overlapping drones turn to mud. */
const AMBIENT_REPEAT_SECONDS = 0.4;

export type SoundTheme =
  | "classic"
  | "halloween"
  | "christmas"
  | "glitch"
  | "void";

export class PingSoundPlayer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private echoSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayedAt = 0;
  private theme: SoundTheme = "classic";

  /** Switch the notification tone. Each Holiday Ping Upgrade advances it. */
  setTheme(theme: SoundTheme): void {
    this.theme = theme;
  }

  /** Play the currently selected notification tone. */
  play(): void {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      void context.resume();
    }
    const now = context.currentTime;
    const gap = this.theme === "void"
      ? AMBIENT_REPEAT_SECONDS
      : MIN_REPEAT_SECONDS;
    if (now - this.lastPlayedAt < gap) {
      return;
    }
    this.lastPlayedAt = now;
    switch (this.theme) {
      case "halloween":
        this.playHalloween(context, now);
        break;
      case "christmas":
        this.playChristmas(context, now);
        break;
      case "glitch":
        this.playGlitch(context, now);
        break;
      case "void":
        this.playVoid(context, now);
        break;
      default:
        this.playClassic(context, now);
    }
  }

  private ensureContext(): AudioContext {
    if (this.context && this.masterGain && this.echoSend && this.noiseBuffer) {
      return this.context;
    }
    const context = new AudioContext();

    const masterGain = context.createGain();
    masterGain.gain.value = 0.5;
    const compressor = context.createDynamicsCompressor();
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    // A soft feedback echo; haunted voices send into it for ghost tails.
    const echoSend = context.createGain();
    const delay = context.createDelay(1.0);
    delay.delayTime.value = 0.29;
    const feedback = context.createGain();
    feedback.gain.value = 0.38;
    echoSend.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGain);

    // One second of white noise, shared by every static-like voice.
    const noiseBuffer = context.createBuffer(
      1,
      context.sampleRate,
      context.sampleRate,
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }

    this.context = context;
    this.masterGain = masterGain;
    this.echoSend = echoSend;
    this.noiseBuffer = noiseBuffer;
    return context;
  }

  /** The familiar two-note warm marimba ding. */
  private playClassic(context: AudioContext, start: number): void {
    this.playNote(context, start, 659.25, 0.3, 0.5, 0.12); // E5
    this.playNote(context, start + 0.09, 493.88, 0.42, 0.5, 0.12); // B4
  }

  /** A dissonant tritone stab that slithers downward and haunts the tail. */
  private playHalloween(context: AudioContext, start: number): void {
    this.playWobbleNote(context, start, 466.16, 0.35, 0.3, 0.35); // A#4
    this.playWobbleNote(context, start + 0.16, 311.13, 0.4, 0.3, 0.35); // D#4
    this.playSlide(context, start + 0.34, 311.13, 174.61, 0.5, 0.25, 0.4);
  }

  /** Bright ascending bells with an inharmonic music-box shimmer. */
  private playChristmas(context: AudioContext, start: number): void {
    this.playBell(context, start, 1046.5, 0.6, 0.4, 0.2); // C6
    this.playBell(context, start + 0.11, 1318.51, 0.6, 0.4, 0.2); // E6
    this.playBell(context, start + 0.22, 1567.98, 0.85, 0.4, 0.25); // G6
  }

  /** Digital corruption: stepped square chirps plus static ticks. */
  private playGlitch(context: AudioContext, start: number): void {
    if (!this.masterGain || !this.echoSend) {
      return;
    }
    const steps = [1180, 880, 1320, 660, 990, 520, 760, 440];
    const oscillator = context.createOscillator();
    oscillator.type = "square";
    for (let i = 0; i < steps.length; i++) {
      oscillator.frequency.setValueAtTime(steps[i]!, start + i * 0.032);
    }
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.8;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.26, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    const send = context.createGain();
    send.gain.value = 0.15;
    gain.connect(send);
    send.connect(this.echoSend);
    oscillator.start(start);
    oscillator.stop(start + 0.4);

    this.playNoise(context, start, 0.035, 2400, 0.2, 0);
    this.playNoise(context, start + 0.1, 0.03, 3100, 0.16, 0);
    this.playNoise(context, start + 0.19, 0.05, 1800, 0.22, 0.1);
  }

  /** A vast, patient hum from somewhere below the server room. */
  private playVoid(context: AudioContext, start: number): void {
    this.playDrone(context, start, 55, 2.0, 0.2); // sub swell
    this.playDrone(context, start, 164.81, 1.9, 0.1); // E3 pad
    this.playDrone(context, start + 0.05, 246.94, 1.8, 0.08); // B3 pad
    this.playNote(context, start + 0.1, 2093.0, 1.2, 0.05, 0.6, "sine"); // C7
  }

  private playNote(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    peak: number,
    echoAmount: number,
    type: OscillatorType = "triangle",
  ): void {
    if (!this.masterGain || !this.echoSend) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    this.sendToEcho(gain, echoAmount);

    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  /** Sawtooth note with a slow uneasy vibrato around its pitch. */
  private playWobbleNote(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    peak: number,
    echoAmount: number,
  ): void {
    if (!this.masterGain || !this.echoSend) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = frequency;

    const lfo = context.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.detune);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    this.sendToEcho(gain, echoAmount);

    const end = when + duration + 0.05;
    oscillator.start(when);
    lfo.start(when);
    oscillator.stop(end);
    lfo.stop(end);
  }

  /** Metallic bell: a sine with a fast inharmonic overtone. */
  private playBell(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    peak: number,
    echoAmount: number,
  ): void {
    if (!this.masterGain) {
      return;
    }
    this.playNote(context, when, frequency, duration, peak, echoAmount, "sine");

    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = frequency * 2.76;
    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, when);
    shimmerGain.gain.exponentialRampToValueAtTime(peak * 0.24, when + 0.01);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, when + duration / 2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmer.start(when);
    shimmer.stop(when + duration / 2 + 0.05);
  }

  /** Eerie pitch drop, like something sinking out of earshot. */
  private playSlide(
    context: AudioContext,
    when: number,
    from: number,
    to: number,
    duration: number,
    peak: number,
    echoAmount: number,
  ): void {
    if (!this.masterGain || !this.echoSend) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, when);
    oscillator.frequency.exponentialRampToValueAtTime(to, when + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    this.sendToEcho(gain, echoAmount);

    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  /** Filtered burst of the shared noise buffer. */
  private playNoise(
    context: AudioContext,
    when: number,
    duration: number,
    filterFrequency: number,
    peak: number,
    echoAmount: number,
  ): void {
    if (!this.noiseBuffer || !this.masterGain || !this.echoSend) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.9;
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    this.sendToEcho(gain, echoAmount);
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  /** Slow swelling sine that fades in and out like a distant presence. */
  private playDrone(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    peak: number,
  ): void {
    if (!this.masterGain || !this.echoSend) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const gain = context.createGain();
    const attack = duration * 0.35;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    this.sendToEcho(gain, 0.45);

    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  private sendToEcho(source: AudioNode, amount: number): void {
    if (!this.echoSend || amount <= 0) {
      return;
    }
    const send = this.echoSend.context.createGain();
    send.gain.value = amount;
    source.connect(send);
    send.connect(this.echoSend);
  }
}
