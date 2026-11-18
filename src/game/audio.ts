// Web Audio API Synthesizer for Tantrik vs Daanav
class TantrikAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private bellInterval: number | null = null;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopAmbientDrone();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startAmbientDrone(): void {
    if (this.isMuted || this.droneOsc1) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.06, now + 1.2);

      // Deep dark cave tanpura/sub-drone (D1 & A1 fifth)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(36.71, now); // D1
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(55.0, now); // A1

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.Q.setValueAtTime(4, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.droneOsc1 = osc1;
      this.droneOsc2 = osc2;
      this.droneGain = masterGain;

      // Occasional distant temple bell chime
      this.playTempleBell(0.035);
      this.bellInterval = window.setInterval(() => {
        if (!this.isMuted && this.droneOsc1) {
          this.playTempleBell(0.025);
        }
      }, 7500);
    } catch {
      // Ignore audio autoplay errors until interaction
    }
  }

  public stopAmbientDrone(): void {
    if (this.bellInterval !== null) {
      clearInterval(this.bellInterval);
      this.bellInterval = null;
    }
    if (this.droneGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      } catch {}
    }
    setTimeout(() => {
      try {
        this.droneOsc1?.stop();
        this.droneOsc2?.stop();
        this.droneOsc1?.disconnect();
        this.droneOsc2?.disconnect();
      } catch {}
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      this.droneGain = null;
    }, 280);
  }

  public playTempleBell(volume = 0.05): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic inharmonic partials of a ritual bronze ghanta bell
    const partials = [587.33, 1174.66, 1567.98, 2489.02];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (i % 2 === 0 ? 1.5 : -1.5), now);

      const amp = volume / (i + 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4 / (i * 0.6 + 1));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  public playMudraLock(hand: 'left' | 'right'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = hand === 'left' ? 440 : 554.37;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playSpellCastHit(streak: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Mystical fire whoosh + thunder crack (filtered white noise burst)
    const bufferSize = ctx.sampleRate * 0.45;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(320, now);
    bandpass.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
    bandpass.frequency.exponentialRampToValueAtTime(480, now + 0.42);
    bandpass.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Thunderous impact sub-drop + golden mantra chord
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    const pitchBoost = 1 + Math.min(streak, 6) * 0.04;
    subOsc.frequency.setValueAtTime(160 * pitchBoost, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.32);

    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.36);

    // 3. Daanav pain grunt (low formant saw)
    const gruntOsc = ctx.createOscillator();
    const gruntFilter = ctx.createBiquadFilter();
    const gruntGain = ctx.createGain();

    gruntOsc.type = 'sawtooth';
    gruntOsc.frequency.setValueAtTime(115, now + 0.05);
    gruntOsc.frequency.linearRampToValueAtTime(78, now + 0.35);

    gruntFilter.type = 'bandpass';
    gruntFilter.frequency.setValueAtTime(520, now + 0.05);
    gruntFilter.Q.setValueAtTime(4.5, now + 0.05);

    gruntGain.gain.setValueAtTime(0.001, now);
    gruntGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gruntGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    gruntOsc.connect(gruntFilter);
    gruntFilter.connect(gruntGain);
    gruntGain.connect(ctx.destination);
    gruntOsc.start(now + 0.05);
    gruntOsc.stop(now + 0.4);

    // Ritual bell shimmer
    this.playTempleBell(0.06);
  }

  public playDaanavRoarAttack(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Heavy demonic roar (dual detuned low sawtooths through vowel formant filter)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const roarGain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(92, now);
    osc1.frequency.linearRampToValueAtTime(128, now + 0.14);
    osc1.frequency.exponentialRampToValueAtTime(52, now + 0.62);

    osc2.frequency.setValueAtTime(95.5, now);
    osc2.frequency.linearRampToValueAtTime(133, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(49, now + 0.62);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.6);
    filter.Q.setValueAtTime(6, now);

    roarGain.gain.setValueAtTime(0.001, now);
    roarGain.gain.linearRampToValueAtTime(0.26, now + 0.04);
    roarGain.gain.exponentialRampToValueAtTime(0.001, now + 0.64);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(roarGain);
    roarGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);

    // 2. Heavy screen thud sub-bass punch
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(110, now);
    thudOsc.frequency.exponentialRampToValueAtTime(28, now + 0.4);

    thudGain.gain.setValueAtTime(0.35, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.44);
  }

  public playTimerWarningTick(urgencyRatio: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 620 + (1 - urgencyRatio) * 380;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.045);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playVictoryFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [293.66, 369.99, 440.0, 587.33]; // D major modal triumph
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.95);
    });
    this.playTempleBell(0.09);
  }

  public playDefeatSting(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [196.0, 185.0, 146.83, 110.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.75);
    });
  }
}

export const audioEngine = new TantrikAudioEngine();
