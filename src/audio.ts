// Synthesized Discord-style notification pings via the Web Audio API.
// Sounds are generated at runtime so no copyrighted audio ships with the
// project; each voice evokes the official notification tones instead.

/** Minimum gap between plays so rapid clicks do not stack into mush. */
const MIN_REPEAT_SECONDS = 0.045;

export type SoundTheme = "default" | "halloween" | "christmas" | "new-years";

export class PingSoundPlayer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lastPlayedAt = 0;
  private theme: SoundTheme = "default";

  /** Switch the notification tone to a seasonal variant. */
  setTheme(theme: SoundTheme): void {
    this.theme = theme;
  }

  /** Play the current notification ping. */
  play(): void {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      void context.resume();
    }
    const now = context.currentTime;
    if (now - this.lastPlayedAt < MIN_REPEAT_SECONDS) {
      return;
    }
    this.lastPlayedAt = now;

    switch (this.theme) {
      case "halloween":
        this.playHalloweenPing(context, now);
        break;
      case "christmas":
        this.playChristmasPing(context, now);
        break;
      case "new-years":
        this.playNewYearsPing(context, now);
        break;
      default:
        this.playDefaultPing(context, now);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.context || !this.masterGain) {
      const context = new AudioContext();
      const masterGain = context.createGain();
      masterGain.gain.value = 0.5;
      const compressor = context.createDynamicsCompressor();
      masterGain.connect(compressor);
      compressor.connect(context.destination);
      this.context = context;
      this.masterGain = masterGain;
    }
    return this.context;
  }

  /** Two warm marimba-like notes, the second lower than the first. */
  private playDefaultPing(context: AudioContext, start: number): void {
    this.playNote(context, start, 659.25, 0.3); // E5
    this.playNote(context, start + 0.09, 493.88, 0.4); // B4
  }

  /** Minor-key tritone stab, then a ghostly descending slide. */
  private playHalloweenPing(context: AudioContext, start: number): void {
    this.playNote(context, start, 466.16, 0.25, "sawtooth"); // A#4
    this.playNote(context, start + 0.12, 311.13, 0.35, "sawtooth"); // D#4
    this.playSlide(context, start + 0.25, 311.13, 196.0, 0.4); // D#4 down to G3
  }

  /** Bells — bright metallic harmonics, ascending like a music box. */
  private playChristmasPing(context: AudioContext, start: number): void {
    this.playBell(context, start, 1046.5, 0.6); // C6
    this.playBell(context, start + 0.1, 1318.51, 0.6); // E6
    this.playBell(context, start + 0.2, 1567.98, 0.8); // G6
  }

  /** A rising arpeggio with a tiny pop, like a New Year's sparkler. */
  private playNewYearsPing(context: AudioContext, start: number): void {
    this.playNote(context, start, 523.25, 0.15); // C5
    this.playNote(context, start + 0.08, 659.25, 0.15); // E5
    this.playNote(context, start + 0.16, 783.99, 0.15); // G5
    this.playNote(context, start + 0.24, 1046.5, 0.4); // C6
  }

  private playNote(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
    type: OscillatorType = "triangle",
  ): void {
    if (!this.masterGain) {
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
    gain.gain.exponentialRampToValueAtTime(0.5, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  /** Metallic bell: a sine with a fast detuned harmonic overtone. */
  private playBell(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
  ): void {
    if (!this.masterGain) {
      return;
    }
    // Fundamental
    this.playNote(context, when, frequency, duration, "sine");
    // Inharmonic shimmer (bell-like)
    const shimmer = context.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = frequency * 2.76;
    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, when);
    shimmerGain.gain.exponentialRampToValueAtTime(0.12, when + 0.01);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, when + duration / 2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmer.start(when);
    shimmer.stop(when + duration / 2 + 0.05);
  }

  /** Glissando slide (pitch drop) for spooky or dramatic transitions. */
  private playSlide(
    context: AudioContext,
    when: number,
    from: number,
    to: number,
    duration: number,
  ): void {
    if (!this.masterGain) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, when);
    oscillator.frequency.exponentialRampToValueAtTime(to, when + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.25, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }
}
