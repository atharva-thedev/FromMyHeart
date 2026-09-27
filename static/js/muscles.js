/**
 * HeartDrop - muscles.js
 * Renders stylized anatomical muscle groups aligned to body landmarks:
 * Deltoids, Pectorals, Biceps/Triceps, Forearms, Abdomen (Rectus Abdominis & Obliques),
 * Quadriceps, and Calves.
 */

class MuscleRenderer {
  constructor(options = {}) {
    this.options = Object.assign({
      musclePrimary: "rgba(215, 38, 70, 0.42)",
      muscleSecondary: "rgba(145, 18, 45, 0.52)",
      fiberColor: "rgba(255, 130, 155, 0.35)",
      glowColor: "rgba(255, 42, 95, 0.3)"
    }, options);
  }

  render(ctx, p, width, height, opacity = 0.85) {
    if (!p || !p[11] || !p[12]) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.shadowColor = this.options.glowColor;
    ctx.shadowBlur = 10;

    const ls = p[11];
    const rs = p[12];
    const lh = p[23];
    const rh = p[24];

    const midX = (ls.x + rs.x) / 2;
    const midY = (ls.y + rs.y) / 2;
    const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);

    const hasHips = lh && rh && lh.vis > 0.3 && rh.vis > 0.3;
    const hipMidX = hasHips ? (lh.x + rh.x) / 2 : midX;
    const hipMidY = hasHips ? (lh.y + rh.y) / 2 : midY + span * 1.6;

    // 1. Shoulders / Deltoids
    this.drawDeltoid(ctx, ls, p[13], span, "left");
    this.drawDeltoid(ctx, rs, p[14], span, "right");

    // 2. Chest / Pectoralis Major
    this.drawPectorals(ctx, ls, rs, midX, midY, span);

    // 3. Abdomen / Core (Rectus Abdominis & Obliques)
    this.drawAbdomen(ctx, midX, midY, hipMidX, hipMidY, span);

    // 4. Arms (Biceps & Forearms)
    this.drawArmMuscles(ctx, ls, p[13], p[15], span, "left");
    this.drawArmMuscles(ctx, rs, p[14], p[16], span, "right");

    // 5. Legs (Quadriceps & Calves)
    if (hasHips && p[25] && p[26]) {
      this.drawLegMuscles(ctx, lh, p[25], p[27], span, "left");
      this.drawLegMuscles(ctx, rh, p[26], p[28], span, "right");
    }

    ctx.restore();
  }

  drawDeltoid(ctx, shoulder, elbow, span, side) {
    if (!shoulder) return;
    const r = Math.max(14, span * 0.22);
    ctx.fillStyle = this.options.musclePrimary;
    ctx.strokeStyle = this.options.fiberColor;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(shoulder.x, shoulder.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Muscle striations
    for (let a = -0.5; a <= 0.5; a += 0.35) {
      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y - r * 0.4);
      ctx.quadraticCurveTo(
        shoulder.x + Math.sin(a) * r,
        shoulder.y,
        shoulder.x + Math.sin(a) * r * 0.8,
        shoulder.y + r * 0.8
      );
      ctx.stroke();
    }
  }

  drawPectorals(ctx, ls, rs, mx, my, span) {
    const pecHeight = span * 0.45;
    const pecWidth = span * 0.42;

    ctx.fillStyle = this.options.musclePrimary;
    ctx.strokeStyle = this.options.fiberColor;
    ctx.lineWidth = 1.2;

    // Left Pectoral
    ctx.beginPath();
    ctx.moveTo(mx - 2, my + span * 0.08);
    ctx.lineTo(ls.x, ls.y);
    ctx.quadraticCurveTo(ls.x - pecWidth * 0.3, my + pecHeight, mx - 2, my + pecHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Pectoral
    ctx.beginPath();
    ctx.moveTo(mx + 2, my + span * 0.08);
    ctx.lineTo(rs.x, rs.y);
    ctx.quadraticCurveTo(rs.x + pecWidth * 0.3, my + pecHeight, mx + 2, my + pecHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawAbdomen(ctx, sx, sy, hx, hy, span) {
    const startY = sy + span * 0.48;
    const totalH = Math.max(span * 0.7, hy - startY);
    const rowCount = 3;
    const rowH = totalH / rowCount;
    const packW = span * 0.16;

    ctx.fillStyle = this.options.muscleSecondary;
    ctx.strokeStyle = this.options.fiberColor;
    ctx.lineWidth = 1.0;

    // 6-pack abdominal grid
    for (let r = 0; r < rowCount; r++) {
      const cy = startY + r * rowH + rowH * 0.45;
      const w = packW * (1 - r * 0.08);

      // Left pack
      ctx.beginPath();
      ctx.roundRect(sx - w - 4, cy - rowH * 0.38, w, rowH * 0.76, 5);
      ctx.fill();
      ctx.stroke();

      // Right pack
      ctx.beginPath();
      ctx.roundRect(sx + 4, cy - rowH * 0.38, w, rowH * 0.76, 5);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawArmMuscles(ctx, shoulder, elbow, wrist, span, side) {
    if (!shoulder || !elbow || elbow.vis < 0.3) return;

    // Biceps / Triceps segment
    const bicepMidX = (shoulder.x + elbow.x) / 2;
    const bicepMidY = (shoulder.y + elbow.y) / 2;
    const bicepRadius = Math.max(9, span * 0.12);

    ctx.fillStyle = this.options.musclePrimary;
    ctx.beginPath();
    ctx.ellipse(
      bicepMidX,
      bicepMidY,
      bicepRadius,
      Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y) * 0.42,
      Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x) - Math.PI / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Forearm muscle mass
    if (wrist && wrist.vis > 0.3) {
      const forearmMidX = (elbow.x * 0.65 + wrist.x * 0.35);
      const forearmMidY = (elbow.y * 0.65 + wrist.y * 0.35);
      const forearmRadius = Math.max(7, span * 0.09);

      ctx.beginPath();
      ctx.ellipse(
        forearmMidX,
        forearmMidY,
        forearmRadius,
        Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) * 0.38,
        Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) - Math.PI / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  drawLegMuscles(ctx, hip, knee, ankle, span, side) {
    if (!hip || !knee || knee.vis < 0.3) return;

    // Quadriceps
    const thighMidX = (hip.x + knee.x) / 2;
    const thighMidY = (hip.y + knee.y) / 2;
    const quadRadius = Math.max(12, span * 0.16);

    ctx.fillStyle = this.options.musclePrimary;
    ctx.beginPath();
    ctx.ellipse(
      thighMidX,
      thighMidY,
      quadRadius,
      Math.hypot(knee.x - hip.x, knee.y - hip.y) * 0.44,
      Math.atan2(knee.y - hip.y, knee.x - hip.x) - Math.PI / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Calves (Gastrocnemius)
    if (ankle && ankle.vis > 0.3) {
      const calfMidX = (knee.x * 0.65 + ankle.x * 0.35);
      const calfMidY = (knee.y * 0.65 + ankle.y * 0.35);
      const calfRadius = Math.max(9, span * 0.11);

      ctx.beginPath();
      ctx.ellipse(
        calfMidX,
        calfMidY,
        calfRadius,
        Math.hypot(ankle.x - knee.x, ankle.y - knee.y) * 0.38,
        Math.atan2(ankle.y - knee.y, ankle.x - knee.x) - Math.PI / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

window.MuscleRenderer = MuscleRenderer;
