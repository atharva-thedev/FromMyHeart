/**
 * HeartDrop - heart.js
 * Renders the glowing AR heart on canvas.
 * Implements realistic dual-beat cardiac rhythm (scale 1 -> 1.12 -> 1 -> 1.06 -> 1),
 * subtle particle emission, spring-physics hand tracking,
 * and dramatic split/burst reveal animation. Includes Web Audio heartbeat synthesis.
 */

class HeartRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = Object.assign({
      baseRadius: 42,
      soundEnabled: true
    }, options);

    // Position & Physics
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.springFactor = 0.16;
    this.damping = 0.82;

    // States: 'HIDDEN', 'BEATING', 'GRABBED', 'OPENING', 'SPLIT'
    this.state = 'HIDDEN';
    this.scale = 1.0;
    this.baseScale = 1.0;
    this.rotation = 0.0;
    this.opacity = 0.0;
    this.splitOffset = 0.0; // Distance left & right half separate during reveal

    // Rhythm timer
    this.beatPhase = 0; // 0..1 in rhythm cycle
    this.beatCycleDuration = 950; // ms per heartbeat cycle (~63 bpm)
    this.lastBeatTime = performance.now();
    this.soundPlayedThisCycle = false;

    // Particles system
    this.particles = [];
    this.maxAmbientParticles = 30;

    // Audio context
    this.audioCtx = null;
    this.isMuted = false;
  }

  /**
   * Initialize Web Audio API synthesizer for the heartbeat.
   */
  initAudio() {
    if (this.audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      console.warn("Web Audio not available:", e);
    }
  }

  playHeartbeatSound() {
    if (this.isMuted || !this.audioCtx || this.audioCtx.state === 'suspended') return;

    try {
      const now = this.audioCtx.currentTime;

      // Primary "Lub"
      this._playTone(55, 35, now, 0.14, 0.32);

      // Secondary "Dub" (approx 220ms later, slightly softer)
      this._playTone(48, 30, now + 0.22, 0.11, 0.22);
    } catch (e) {
      // Audio playback can occasionally be throttled by browser
    }
  }

  _playTone(startFreq, endFreq, startTime, duration, volume) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  toggleSound(enabled) {
    this.isMuted = !enabled;
    if (enabled && this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Activates heart at a specified normalized or pixel position.
   */
  activate(pixelX, pixelY) {
    this.x = pixelX;
    this.y = pixelY;
    this.targetX = pixelX;
    this.targetY = pixelY;
    this.state = 'BEATING';
    this.opacity = 1.0;
    this.baseScale = 1.0;
    this.splitOffset = 0;
    this.lastBeatTime = performance.now();
    this.initAudio();
  }

  setGrabTarget(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
    if (this.state !== 'OPENING' && this.state !== 'SPLIT') {
      this.state = 'GRABBED';
    }
  }

  releaseGrab() {
    if (this.state === 'GRABBED') {
      this.state = 'BEATING';
    }
  }

  /**
   * Starts opening & split animation on tap.
   */
  startRevealAnimation(onComplete) {
    if (this.state === 'OPENING' || this.state === 'SPLIT') return;

    this.state = 'OPENING';
    const startTime = performance.now();
    const animDuration = 900; // ms

    // Burst 60 luminous particles
    this.emitBurst(this.x, this.y, 60);

    const animateSplit = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / animDuration);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.scale = 1.0 + ease * 0.45; // Enlarge
      this.rotation = Math.sin(progress * Math.PI) * 0.12; // Wobble slightly
      this.splitOffset = ease * 70; // Left & right halves move apart
      this.opacity = Math.max(0, 1 - progress * 1.1); // Fade heart out as content emerges

      if (progress < 1) {
        requestAnimationFrame(animateSplit);
      } else {
        this.state = 'SPLIT';
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateSplit);
  }

  /**
   * Add ambient dust / sparkle particles.
   */
  emitAmbient() {
    if (this.particles.length >= this.maxAmbientParticles || this.opacity <= 0.1) return;
    const angle = Math.random() * Math.PI * 2;
    const distance = (this.options.baseRadius * 0.6) + Math.random() * 20;
    this.particles.push({
      x: this.x + Math.cos(angle) * distance,
      y: this.y + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.4 - Math.random() * 0.8,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.8,
      decay: 0.012 + Math.random() * 0.015,
      color: Math.random() > 0.4 ? 'rgba(255, 77, 109, ' : 'rgba(244, 208, 111, '
    });
  }

  /**
   * Add explosive sparkle burst on heart tap/reveal.
   */
  emitBurst(bx, by, count = 50) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.5;
      this.particles.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        size: 2.0 + Math.random() * 3.5,
        alpha: 1.0,
        decay: 0.01 + Math.random() * 0.018,
        color: Math.random() > 0.3 ? 'rgba(255, 65, 113, ' : 'rgba(255, 230, 150, '
      });
    }
  }

  /**
   * Animation & render loop update.
   */
  updateAndRender(currentTime, shouldClear = true) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear overlay canvas if requested
    if (shouldClear) {
      ctx.clearRect(0, 0, w, h);
    }

    if (this.state === 'HIDDEN' || this.opacity <= 0.005) {
      this.updateParticles(ctx);
      return;
    }

    // 1. Spring-like motion interpolation when following hand
    const ax = (this.targetX - this.x) * this.springFactor;
    const ay = (this.targetY - this.y) * this.springFactor;
    this.vx = (this.vx + ax) * this.damping;
    this.vy = (this.vy + ay) * this.damping;
    this.x += this.vx;
    this.y += this.vy;

    // 2. Realistic Cardiac Rhythm (Scale: 1 -> 1.12 -> 1 -> 1.06 -> 1)
    if (this.state === 'BEATING' || this.state === 'GRABBED') {
      const cycleElapsed = (currentTime - this.lastBeatTime) % this.beatCycleDuration;
      const phase = cycleElapsed / this.beatCycleDuration;

      // Lub-Dub timing curve:
      // 0.00 - 0.14: First beat expands to 1.12
      // 0.14 - 0.28: Returns to 1.00
      // 0.28 - 0.40: Second softer beat expands to 1.06
      // 0.40 - 0.52: Returns to 1.00
      // 0.52 - 1.00: Diastolic resting pause
      let dynamicScale = 1.0;

      if (phase < 0.14) {
        const p = phase / 0.14;
        dynamicScale = 1.0 + Math.sin(p * Math.PI) * 0.12;
        if (!this.soundPlayedThisCycle) {
          this.playHeartbeatSound();
          this.soundPlayedThisCycle = true;
        }
      } else if (phase < 0.28) {
        dynamicScale = 1.0;
      } else if (phase < 0.42) {
        const p = (phase - 0.28) / 0.14;
        dynamicScale = 1.0 + Math.sin(p * Math.PI) * 0.06;
      } else {
        dynamicScale = 1.0;
        if (phase > 0.85) {
          this.soundPlayedThisCycle = false;
        }
      }

      this.scale = this.baseScale * dynamicScale;

      // Slight floating motion when resting
      if (this.state === 'BEATING') {
        this.emitAmbient();
      }
    }

    // 3. Render Particles
    this.updateParticles(ctx);

    // 4. Render Heart
    this.drawHeart(ctx);
  }

  updateParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.shadowColor = 'rgba(255, 65, 113, 0.8)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHeart(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    const r = this.options.baseRadius;

    // Glowing Radial Halo
    const glowGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.5);
    glowGrad.addColorStop(0, 'rgba(255, 42, 95, 0.4)');
    glowGrad.addColorStop(0.5, 'rgba(255, 42, 95, 0.12)');
    glowGrad.addColorStop(1, 'rgba(255, 42, 95, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Heart gradient fill
    const heartGrad = ctx.createLinearGradient(0, -r, 0, r * 1.2);
    heartGrad.addColorStop(0, '#ff4d6d');
    heartGrad.addColorStop(0.6, '#ff0a54');
    heartGrad.addColorStop(1, '#a70032');

    // Split rendering for reveal animation
    if (this.splitOffset > 0) {
      // Left lobe
      ctx.save();
      ctx.translate(-this.splitOffset, 0);
      this.drawHalfHeart(ctx, r, heartGrad, 'left');
      ctx.restore();

      // Right lobe
      ctx.save();
      ctx.translate(this.splitOffset, 0);
      this.drawHalfHeart(ctx, r, heartGrad, 'right');
      ctx.restore();
    } else {
      // Normal single connected heart
      ctx.shadowColor = '#ff2a5f';
      ctx.shadowBlur = 24;
      ctx.fillStyle = heartGrad;
      this.drawCompleteHeartPath(ctx, r);
      ctx.fill();

      // Inner subtle shimmer / specular highlight
      const innerShine = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 2, -r * 0.35, -r * 0.35, r * 0.6);
      innerShine.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      innerShine.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = innerShine;
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.35, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCompleteHeartPath(ctx, r) {
    ctx.beginPath();
    const topCurveHeight = r * 0.55;
    ctx.moveTo(0, topCurveHeight);
    // Left half
    ctx.bezierCurveTo(
      0, 0,
      -r, -r * 0.6,
      -r, topCurveHeight
    );
    ctx.bezierCurveTo(
      -r, r * 0.9,
      -r * 0.3, r * 1.2,
      0, r * 1.55
    );
    // Right half
    ctx.bezierCurveTo(
      r * 0.3, r * 1.2,
      r, r * 0.9,
      r, topCurveHeight
    );
    ctx.bezierCurveTo(
      r, -r * 0.6,
      0, 0,
      0, topCurveHeight
    );
    ctx.closePath();
  }

  drawHalfHeart(ctx, r, fillStyle, side) {
    ctx.save();
    ctx.shadowColor = '#ff2a5f';
    ctx.shadowBlur = 18;
    ctx.fillStyle = fillStyle;

    ctx.beginPath();
    const topCurveHeight = r * 0.55;
    ctx.moveTo(0, topCurveHeight);

    if (side === 'left') {
      ctx.bezierCurveTo(0, 0, -r, -r * 0.6, -r, topCurveHeight);
      ctx.bezierCurveTo(-r, r * 0.9, -r * 0.3, r * 1.2, 0, r * 1.55);
      ctx.lineTo(0, topCurveHeight);
    } else {
      ctx.bezierCurveTo(0, 0, r, -r * 0.6, r, topCurveHeight);
      ctx.bezierCurveTo(r, r * 0.9, r * 0.3, r * 1.2, 0, r * 1.55);
      ctx.lineTo(0, topCurveHeight);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  getHitArea() {
    return {
      x: this.x,
      y: this.y,
      radius: this.options.baseRadius * this.scale
    };
  }
}

window.HeartRenderer = HeartRenderer;
