/**
 * HeartDrop - organs.js
 * Renders stylized internal organs positioned relative to detected torso:
 * 🧠 Brain, 🫀 Heart, 🫁 Lungs, 🟤 Liver, Stomach, Kidneys.
 * Heart beats continuously and responds interactively to hand proximity.
 */

class OrganRenderer {
  constructor(options = {}) {
    this.options = Object.assign({
      heartColor: "rgba(255, 42, 95, 0.95)",
      lungColor: "rgba(100, 210, 255, 0.72)",
      brainColor: "rgba(230, 160, 255, 0.82)",
      liverColor: "rgba(215, 120, 60, 0.75)",
      stomachColor: "rgba(180, 110, 210, 0.75)",
      kidneyColor: "rgba(200, 60, 90, 0.75)"
    }, options);

    // Active hovered organ
    this.hoveredOrgan = null;

    // Organ bounding targets for interaction hit-testing
    this.organTargets = {};
  }

  /**
   * Main render loop for all organs.
   */
  render(ctx, p, time, width, height, opacity = 1.0, handPositions = []) {
    if (!p || !p[11] || !p[12]) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    const ls = p[11];
    const rs = p[12];
    const nose = p[0];
    const lh = p[23];
    const rh = p[24];

    const midX = (ls.x + rs.x) / 2;
    const midY = (ls.y + rs.y) / 2;
    const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);

    const hasHips = lh && rh && lh.vis > 0.3 && rh.vis > 0.3;
    const hipMidX = hasHips ? (lh.x + rh.x) / 2 : midX;
    const hipMidY = hasHips ? (lh.y + rh.y) / 2 : midY + span * 1.6;

    // Continuous heartbeat calculation for the anatomical heart
    const beatCycle = (time % 900) / 900;
    let heartScale = 1.0;
    if (beatCycle < 0.15) {
      heartScale = 1.0 + Math.sin((beatCycle / 0.15) * Math.PI) * 0.14;
    } else if (beatCycle > 0.25 && beatCycle < 0.38) {
      heartScale = 1.0 + Math.sin(((beatCycle - 0.25) / 0.13) * Math.PI) * 0.07;
    }

    // Gentle respiratory expansion for lungs
    const lungBreath = 1.0 + Math.sin(time * 0.0018) * 0.04;

    // Register organ spatial positions
    const headRadius = Math.max(18, span * 0.28);
    const headX = nose ? nose.x : midX;
    const headY = nose ? nose.y - headRadius * 0.15 : midY - span * 0.55;

    // Torso offsets
    const chestY = midY + span * 0.32;
    // Anatomical heart is slightly to the left of the midline (in mirrored view, slightly shifted toward left shoulder)
    const heartX = midX + (ls.x - rs.x) * 0.1;
    const heartY = chestY + span * 0.06;
    const heartRadius = Math.max(16, span * 0.16);

    const lungsY = chestY - span * 0.02;
    const lungW = span * 0.22;
    const lungH = span * 0.42;

    const liverX = midX - span * 0.16; // Right hypochondrium (mirrored)
    const liverY = midY + span * 0.65;
    const stomachX = midX + span * 0.18; // Left hypochondrium (mirrored)
    const stomachY = midY + span * 0.68;

    const kidneyY = midY + span * 0.95;

    this.organTargets = {
      brain: { name: "BRAIN", x: headX, y: headY - headRadius * 0.2, r: headRadius * 0.65 },
      lungs: { name: "LUNGS", x: midX, y: lungsY, r: span * 0.35 },
      heart: { name: "HEART", x: heartX, y: heartY, r: heartRadius * 1.35, isHeart: true },
      liver: { name: "LIVER", x: liverX, y: liverY, r: span * 0.16 },
      stomach: { name: "STOMACH", x: stomachX, y: stomachY, r: span * 0.15 },
      kidneys: { name: "KIDNEYS", x: midX, y: kidneyY, r: span * 0.25 }
    };

    // Check hand hover interaction
    this.updateHoverState(handPositions);

    // 1. Draw 🧠 Brain
    this.drawBrain(ctx, this.organTargets.brain, span);

    // 2. Draw 🫁 Lungs
    this.drawLungs(ctx, midX, lungsY, lungW, lungH, lungBreath, ls, rs, span);

    // 3. Draw 🟤 Liver
    this.drawLiver(ctx, this.organTargets.liver, span);

    // 4. Draw Stomach
    this.drawStomach(ctx, this.organTargets.stomach, span);

    // 5. Draw Kidneys
    this.drawKidneys(ctx, midX, kidneyY, span);

    // 6. Draw 🫀 Heart (PROMINENT, beating, glowing!)
    this.drawHeart(ctx, this.organTargets.heart, heartScale, span);

    // 7. Draw interactive hover label if hand is near any organ
    if (this.hoveredOrgan) {
      this.drawHoverBadge(ctx, this.hoveredOrgan);
    }

    ctx.restore();
  }

  updateHoverState(handPositions) {
    this.hoveredOrgan = null;
    if (!handPositions || handPositions.length === 0) return;

    let closestDist = Infinity;
    let closestOrgan = null;

    for (const key of Object.keys(this.organTargets)) {
      const target = this.organTargets[key];
      for (const hand of handPositions) {
        const d = Math.hypot(hand.x - target.x, hand.y - target.y);
        const threshold = target.r + 35;
        if (d < threshold && d < closestDist) {
          closestDist = d;
          closestOrgan = Object.assign({ key }, target);
        }
      }
    }

    this.hoveredOrgan = closestOrgan;
  }

  drawBrain(ctx, target, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "brain";
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = isHovered ? "rgba(240, 180, 255, 0.95)" : this.options.brainColor;
    ctx.shadowColor = "#e040fb";
    ctx.shadowBlur = isHovered ? 20 : 10;

    const r = target.r * 0.85;
    // Cerebral hemispheres
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, 0, r * 0.55, r * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.35, 0, r * 0.55, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sulci / Folds
    ctx.strokeStyle = "rgba(100, 20, 140, 0.5)";
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * r * 0.22, 0, r * 0.35, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLungs(ctx, mx, my, w, h, breath, ls, rs, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "lungs";
    ctx.save();
    ctx.fillStyle = isHovered ? "rgba(160, 235, 255, 0.9)" : this.options.lungColor;
    ctx.strokeStyle = "rgba(220, 250, 255, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = isHovered ? 22 : 12;

    // Left Lung (mirrored: on right side of screen)
    ctx.save();
    ctx.translate(mx + w * 0.7, my);
    ctx.scale(breath, breath);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.45, h * 0.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right Lung (mirrored: on left side of screen)
    ctx.save();
    ctx.translate(mx - w * 0.7, my);
    ctx.scale(breath, breath);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.45, h * 0.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawLiver(ctx, target, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "liver";
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = isHovered ? "rgba(255, 160, 80, 0.92)" : this.options.liverColor;
    ctx.shadowColor = "#ff6d00";
    ctx.shadowBlur = isHovered ? 18 : 8;

    const r = target.r;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.7, r * 0.9, 0);
    ctx.quadraticCurveTo(r * 0.6, r * 0.6, -r * 0.5, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawStomach(ctx, target, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "stomach";
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = isHovered ? "rgba(220, 150, 255, 0.92)" : this.options.stomachColor;
    ctx.shadowColor = "#aa00ff";
    ctx.shadowBlur = isHovered ? 18 : 8;

    const r = target.r;
    // C-shaped gastric curvature
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.7, r * 0.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawKidneys(ctx, mx, my, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "kidneys";
    ctx.save();
    ctx.fillStyle = isHovered ? "rgba(255, 90, 130, 0.92)" : this.options.kidneyColor;
    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = isHovered ? 16 : 8;

    const kW = span * 0.08;
    const kH = span * 0.12;
    const kOffset = span * 0.24;

    // Left kidney
    ctx.beginPath();
    ctx.ellipse(mx - kOffset, my, kW, kH, 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Right kidney
    ctx.beginPath();
    ctx.ellipse(mx + kOffset, my, kW, kH, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawHeart(ctx, target, scale, span) {
    const isHovered = this.hoveredOrgan && this.hoveredOrgan.key === "heart";
    ctx.save();
    ctx.translate(target.x, target.y);

    const activeScale = scale * (isHovered ? 1.25 : 1.0);
    ctx.scale(activeScale, activeScale);

    const r = target.r * 0.5;

    // Glowing cardiac aura
    const auraGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 3.2);
    auraGrad.addColorStop(0, isHovered ? "rgba(255, 42, 95, 0.75)" : "rgba(255, 42, 95, 0.45)");
    auraGrad.addColorStop(0.5, isHovered ? "rgba(255, 42, 95, 0.3)" : "rgba(255, 42, 95, 0.15)");
    auraGrad.addColorStop(1, "rgba(255, 42, 95, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Aorta arch & Vena Cava trunks
    ctx.fillStyle = "#ff3366";
    ctx.beginPath();
    ctx.roundRect(-r * 0.35, -r * 1.2, r * 0.25, r * 0.7, 4);
    ctx.roundRect(r * 0.05, -r * 1.3, r * 0.3, r * 0.8, 5);
    ctx.fill();

    // Anatomical Ventricles / Cardiac muscle mass
    const heartGrad = ctx.createLinearGradient(0, -r, 0, r * 1.3);
    heartGrad.addColorStop(0, isHovered ? "#ff6584" : "#ff2a5f");
    heartGrad.addColorStop(0.6, isHovered ? "#ff1744" : "#e6004c");
    heartGrad.addColorStop(1, "#8a0026");

    ctx.fillStyle = heartGrad;
    ctx.shadowColor = "#ff2a5f";
    ctx.shadowBlur = isHovered ? 30 : 18;

    // Anatomical cardiac shape tilted ~20 deg toward apex
    ctx.save();
    ctx.rotate(-0.15);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.bezierCurveTo(-r * 0.9, -r * 0.8, -r * 1.1, r * 0.4, 0, r * 1.25);
    ctx.bezierCurveTo(r * 1.0, r * 0.4, r * 0.8, -r * 0.8, 0, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Coronary arteries & veins
    ctx.strokeStyle = "rgba(255, 230, 240, 0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.2, -r * 0.1, r * 0.8);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  drawHoverBadge(ctx, organ) {
    ctx.save();
    ctx.translate(organ.x, organ.y - organ.r - 28);

    const text = organ.name;
    ctx.font = "bold 13px 'Outfit', sans-serif";
    const textW = ctx.measureText(text).width;
    const badgeW = textW + 28;
    const badgeH = 26;

    // Background pill
    ctx.fillStyle = "rgba(10, 8, 14, 0.88)";
    ctx.strokeStyle = organ.isHeart ? "#ff2a5f" : "#00e5ff";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = organ.isHeart ? "rgba(255, 42, 95, 0.7)" : "rgba(0, 229, 255, 0.7)";
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 13);
    ctx.fill();
    ctx.stroke();

    // Label text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  getHeartPosition() {
    return this.organTargets.heart ? {
      x: this.organTargets.heart.x,
      y: this.organTargets.heart.y,
      radius: this.organTargets.heart.r
    } : null;
  }
}

window.OrganRenderer = OrganRenderer;
