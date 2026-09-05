/**
 * Procedural Web Audio API Sound Generator
 * Zero external asset dependencies, crystal clear audio feedback.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15, pitchBend = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchBend !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchBend), now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  playPick() {
    this.playTone(380, 'sine', 0.08, 0.08, 60);
  }

  playPlace() {
    this.playTone(220, 'triangle', 0.12, 0.18, -40);
  }

  /**
   * Deep sub-bass punch layer for heavy impact moments (Quad merge & Chain 3+)
   */
  playImpactBass(intensity = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Fast pitch drop from punchy low-mid down to sub-bass
      const startFreq = Math.min(130, 90 * Math.max(0.8, intensity));
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);

      const peakGain = Math.min(0.35, 0.22 * intensity);
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn('Audio bass punch error', e);
    }
  }

  playDirectMerge() {
    // Crisp ascending two-tone chime
    this.playTone(440, 'sine', 0.12, 0.14, 60);
    setTimeout(() => {
      this.playTone(660, 'sine', 0.15, 0.14, 40);
    }, 50);
  }

  playGroupMerge(count, value, chainLevel = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const baseFreq = 261.63; // Middle C
    const logVal = Math.log2(Math.max(2, value)) - 1; // 2->0, 4->1, 8->2, 16->3, etc.
    const semitones = ((logVal % 12) + (chainLevel - 1) * 2) % 16;
    const root = baseFreq * Math.pow(1.05946, semitones);

    if (count <= 2) {
      // Normal Pair Merge: soft, clear, comfortable two-tone chime (no fatigue)
      this.playTone(root, 'sine', 0.16, 0.12, 15);
      setTimeout(() => {
        this.playTone(root * 1.4983, 'sine', 0.18, 0.10, 10);
      }, 45);
    } else if (count === 3) {
      // Triple Merge: Bright 3-note harmonic triad
      const intervals = [0, 4, 7];
      intervals.forEach((semi, idx) => {
        setTimeout(() => {
          const f = root * Math.pow(1.05946, semi);
          this.playTone(f, 'sine', 0.22, 0.13, 15);
        }, idx * 35);
      });
    } else {
      // Quad+ Merge: 4-note chord + deep sub-bass impact thump!
      const intervals = [0, 4, 7, 12];
      intervals.forEach((semi, idx) => {
        setTimeout(() => {
          const f = root * Math.pow(1.05946, semi);
          this.playTone(f, 'triangle', 0.26, 0.15, 20);
        }, idx * 30);
      });
      // Layer deep physical impact bass thump
      this.playImpactBass(1.0);
    }
  }

  playChain(chainLevel) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (chainLevel === 2) {
      // Chain x2: Snappy upbeat two-note combo
      const base = 523.25; // C5
      this.playTone(base, 'sine', 0.18, 0.15, 40);
      setTimeout(() => {
        this.playTone(base * 1.3348, 'triangle', 0.22, 0.16, 50);
      }, 50);
    } else if (chainLevel === 3) {
      // Chain x3: Triumphant 3-note fanfare + bass punch
      const base = 587.33; // D5
      [0, 4, 7].forEach((semi, idx) => {
        setTimeout(() => {
          this.playTone(base * Math.pow(1.05946, semi), 'triangle', 0.25, 0.16, 20);
        }, idx * 40);
      });
      this.playImpactBass(1.1);
    } else {
      // Chain x4+: High-energy combo climax + heavy bass punch
      const base = 659.25; // E5
      [0, 4, 7, 12].forEach((semi, idx) => {
        setTimeout(() => {
          this.playTone(base * Math.pow(1.05946, semi), 'triangle', 0.3, 0.18, 25);
        }, idx * 35);
      });
      this.playImpactBass(1.4);
    }
  }

  playMegaMerge() {
    this.playGroupMerge(4, 16, 1);
  }

  playInvalid() {
    this.playTone(130, 'sawtooth', 0.12, 0.1, -20);
  }

  /**
   * Magical sparkling arpeggio chime for Wildcard Star merge
   */
  playWildcardMerge() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Magical twinkle notes (E5 -> G#5 -> B5 -> E6)
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.12, 15);
      }, idx * 45);
    });
  }

  /**
   * Powerful double-hit punch for 2x Booster merge
   */
  playBoosterMerge() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.playImpactBass(1.3);
    // Double ding chime
    this.playTone(523.25, 'triangle', 0.18, 0.16, 30);
    setTimeout(() => {
      this.playTone(1046.50, 'triangle', 0.22, 0.18, 20);
    }, 60);
  }

  /**
   * Section 39.15: Harmonic tier-up fanfare chime
   */
  playTierUnlock() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Triumphant ascending arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.28, 0.16, 20);
      }, idx * 60);
    });
    this.playImpactBass(1.2);
  }

  /**
   * Section 39.15: Crisp sweep / dissolve sound for board relief
   */
  playTierPurge() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio purge error', e);
    }
  }

  playGameOver() {
    [329.63, 293.66, 261.63, 196.00].forEach((f, idx) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.4, 0.15, -20);
      }, idx * 160);
    });
  }
}

window.soundSystem = new SoundSystem();

// Auto-unlock Web Audio API on first mobile user interaction
const unlockAudioContext = () => {
  if (window.soundSystem) {
    window.soundSystem.init();
  }
  ['pointerdown', 'touchstart', 'touchend', 'click'].forEach(evt => {
    document.removeEventListener(evt, unlockAudioContext, true);
  });
};
['pointerdown', 'touchstart', 'touchend', 'click'].forEach(evt => {
  document.addEventListener(evt, unlockAudioContext, { once: true, passive: true, capture: true });
});
