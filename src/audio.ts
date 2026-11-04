// Synthesized Discord-style notification pings via the Web Audio API.
// Sounds are generated at runtime so no copyrighted audio ships with the
// project; each voice evokes the official notification tones instead.

/** Minimum gap between plays so rapid clicks do not stack into mush. */
const MIN_REPEAT_SECONDS = 0.045;

export class PingSoundPlayer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lastPlayedAt = 0;

  /** Play the default two-note notification ping. */
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
    this.playDefaultPing(context, now);
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

  private playNote(
    context: AudioContext,
    when: number,
    frequency: number,
    duration: number,
  ): void {
    if (!this.masterGain) {
      return;
    }
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
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
}
