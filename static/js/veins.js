/**
 * HeartDrop - veins.js
 * Renders a stylized circulatory vascular network:
 * Major vessels in arms, legs, and torso (Aorta, Vena Cava, Carotids, Femoral).
 * Features animated flowing luminous blood pulse.
 */

class VeinRenderer {
  constructor(options = {}) {
    this.options = Object.assign({
      arteryColor: "rgba(255, 42, 95, 0.8)",
      veinColor: "rgba(0, 229, 255, 0.75)",
      glowColor: "rgba(255, 23, 68, 0.5)",
      lineWidth: 2.0
    }, options);
  }

  render(ctx, p, time, width, height, opacity = 0.8) {
    if (!p || !p[11] || !p[12]) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = this.options.glowColor;
    ctx.shadowBlur = 12;

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

    const pulsePhase = (time % 1200) / 1200;

    // 1. Torso Central Vascular Trunks (Aorta & Vena Cava)
    this.drawTorsoVessels(ctx, midX, midY, hipMidX, hipMidY, span, pulsePhase);

    // 2. Head & Neck Carotid Vessels
    if (nose) {
      this.drawNeckCarotids(ctx, midX, midY, nose.x, nose.y, span);
    }

    // 3. Arm Vessels (Subclavian, Brachial, Cephalic)
    this.drawArmVessels(ctx, ls, p[13], p[15], span, "left", pulsePhase);
    this.drawArmVessels(ctx, rs, p[14], p[16], span, "right", pulsePhase);

    // 4. Leg Vessels (Iliac, Femoral, Saphenous)
    if (hasHips && p[25] && p[26]) {
      this.drawLegVessels(ctx, lh, p[25], p[27], span, "left", pulsePhase);
      this.drawLegVessels(ctx, rh, p[26], p[28], span, "right", pulsePhase);
    }

    ctx.restore();
  }

  drawTorsoVessels(ctx, mx, my, hx, hy, span, pulse) {
    const chestY = my + span * 0.32;

    // Descending Aorta (Artery - Red)
    ctx.strokeStyle = this.options.arteryColor;
    ctx.lineWidth = Math.max(2.8, span * 0.035);
    ctx.beginPath();
    ctx.moveTo(mx - 4, chestY);
    ctx.bezierCurveTo(mx - 8, my + span * 0.6, mx - 6, my + span * 0.9, hx - 6, hy);
    ctx.stroke();

    // Inferior Vena Cava (Vein - Cyan/Blue)
    ctx.strokeStyle = this.options.veinColor;
    ctx.lineWidth = Math.max(2.8, span * 0.035);
    ctx.beginPath();
    ctx.moveTo(mx + 4, chestY);
    ctx.bezierCurveTo(mx + 8, my + span * 0.6, mx + 6, my + span * 0.9, hx + 6, hy);
    ctx.stroke();

    // Intercostal capillary branches
    ctx.lineWidth = 1.0;
    for (let i = 1; i <= 4; i++) {
      const branchY = my + span * (0.25 + i * 0.12);
      const branchW = span * 0.28;

      ctx.strokeStyle = this.options.arteryColor;
      ctx.beginPath();
      ctx.moveTo(mx - 4, branchY);
      ctx.quadraticCurveTo(mx - branchW * 0.5, branchY - 4, mx - branchW, branchY + 6);
      ctx.stroke();

      ctx.strokeStyle = this.options.veinColor;
      ctx.beginPath();
      ctx.moveTo(mx + 4, branchY + 3);
      ctx.quadraticCurveTo(mx + branchW * 0.5, branchY - 1, mx + branchW, branchY + 9);
      ctx.stroke();
    }
  }

  drawNeckCarotids(ctx, mx, my, nx, ny, span) {
    ctx.lineWidth = Math.max(1.8, span * 0.022);

    // Left Carotid
    ctx.strokeStyle = this.options.arteryColor;
    ctx.beginPath();
    ctx.moveTo(mx - span * 0.05, my + span * 0.1);
    ctx.lineTo(nx - span * 0.06, ny + span * 0.1);
    ctx.stroke();

    // Right Jugular
    ctx.strokeStyle = this.options.veinColor;
    ctx.beginPath();
    ctx.moveTo(mx + span * 0.05, my + span * 0.1);
    ctx.lineTo(nx + span * 0.06, ny + span * 0.1);
    ctx.stroke();
  }

  drawArmVessels(ctx, shoulder, elbow, wrist, span, side, pulse) {
    if (!shoulder || !elbow || elbow.vis < 0.3) return;

    ctx.lineWidth = Math.max(1.8, span * 0.024);

    // Brachial Artery (Red)
    ctx.strokeStyle = this.options.arteryColor;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - 3, shoulder.y);
    ctx.quadraticCurveTo(
      (shoulder.x + elbow.x) / 2 - 6,
      (shoulder.y + elbow.y) / 2,
      elbow.x - 3,
      elbow.y
    );
    ctx.stroke();

    // Cephalic Vein (Cyan)
    ctx.strokeStyle = this.options.veinColor;
    ctx.beginPath();
    ctx.moveTo(shoulder.x + 3, shoulder.y);
    ctx.quadraticCurveTo(
      (shoulder.x + elbow.x) / 2 + 6,
      (shoulder.y + elbow.y) / 2,
      elbow.x + 3,
      elbow.y
    );
    ctx.stroke();

    // Forearm vessels
    if (wrist && wrist.vis > 0.3) {
      // Radial Artery
      ctx.strokeStyle = this.options.arteryColor;
      ctx.beginPath();
      ctx.moveTo(elbow.x - 3, elbow.y);
      ctx.lineTo(wrist.x - 2, wrist.y);
      ctx.stroke();

      // Ulnar Vein
      ctx.strokeStyle = this.options.veinColor;
      ctx.beginPath();
      ctx.moveTo(elbow.x + 3, elbow.y);
      ctx.lineTo(wrist.x + 2, wrist.y);
      ctx.stroke();
    }
  }

  drawLegVessels(ctx, hip, knee, ankle, span, side, pulse) {
    if (!hip || !knee || knee.vis < 0.3) return;

    ctx.lineWidth = Math.max(2.2, span * 0.028);

    // Femoral Artery
    ctx.strokeStyle = this.options.arteryColor;
    ctx.beginPath();
    ctx.moveTo(hip.x - 3, hip.y);
    ctx.quadraticCurveTo(
      (hip.x + knee.x) / 2 - 5,
      (hip.y + knee.y) / 2,
      knee.x - 2,
      knee.y
    );
    ctx.stroke();

    // Saphenous Vein
    ctx.strokeStyle = this.options.veinColor;
    ctx.beginPath();
    ctx.moveTo(hip.x + 3, hip.y);
    ctx.quadraticCurveTo(
      (hip.x + knee.x) / 2 + 5,
      (hip.y + knee.y) / 2,
      knee.x + 2,
      knee.y
    );
    ctx.stroke();

    // Lower Leg
    if (ankle && ankle.vis > 0.3) {
      ctx.strokeStyle = this.options.arteryColor;
      ctx.beginPath();
      ctx.moveTo(knee.x - 2, knee.y);
      ctx.lineTo(ankle.x - 2, ankle.y);
      ctx.stroke();

      ctx.strokeStyle = this.options.veinColor;
      ctx.beginPath();
      ctx.moveTo(knee.x + 2, knee.y);
      ctx.lineTo(ankle.x + 2, ankle.y);
      ctx.stroke();
    }
  }
}

window.VeinRenderer = VeinRenderer;
