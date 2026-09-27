/**
 * HeartDrop - skeleton.js
 * Renders a stylized, glowing X-ray skeleton overlay.
 * Uses MediaPipe Pose landmarks for:
 * Skull, Spine, Clavicles, Ribcage, Pelvis, Arms (Humerus, Radius/Ulna),
 * and Legs (Femur, Tibia/Fibula).
 */

class SkeletonRenderer {
  constructor(options = {}) {
    this.options = Object.assign({
      boneColor: "rgba(224, 247, 250, 0.88)",
      jointColor: "rgba(178, 235, 242, 0.95)",
      glowColor: "rgba(77, 208, 225, 0.65)",
      shadowBlur: 14
    }, options);
  }

  /**
   * Main render method for skeleton overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} p - Smoothed screen coordinates of pose landmarks { 0..32: {x, y, vis} }
   * @param {number} width
   * @param {number} height
   * @param {number} opacity
   */
  render(ctx, p, width, height, opacity = 1.0) {
    if (!p || !p[11] || !p[12]) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = this.options.glowColor;
    ctx.shadowBlur = this.options.shadowBlur;

    const leftShoulder = p[11];
    const rightShoulder = p[12];
    const leftHip = p[23];
    const rightHip = p[24];

    // Reference dimensions
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderSpan = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);

    const hasHips = leftHip && rightHip && leftHip.vis > 0.3 && rightHip.vis > 0.3;
    const hipMidX = hasHips ? (leftHip.x + rightHip.x) / 2 : shoulderMidX;
    const hipMidY = hasHips ? (leftHip.y + rightHip.y) / 2 : shoulderMidY + shoulderSpan * 1.6;

    // 1. Skull / Cranium
    this.drawSkull(ctx, p, shoulderMidX, shoulderMidY, shoulderSpan);

    // 2. Spine & Ribcage
    this.drawSpineAndRibcage(ctx, shoulderMidX, shoulderMidY, hipMidX, hipMidY, leftShoulder, rightShoulder, shoulderSpan);

    // 3. Pelvis
    if (hasHips) {
      this.drawPelvis(ctx, leftHip, rightHip, hipMidX, hipMidY, shoulderSpan);
    }

    // 4. Arms
    this.drawArm(ctx, leftShoulder, p[13], p[15], shoulderSpan, "left");
    this.drawArm(ctx, rightShoulder, p[14], p[16], shoulderSpan, "right");

    // 5. Legs
    if (hasHips && p[25] && p[26]) {
      this.drawLeg(ctx, leftHip, p[25], p[27], shoulderSpan, "left");
      this.drawLeg(ctx, rightHip, p[26], p[28], shoulderSpan, "right");
    }

    ctx.restore();
  }

  drawSkull(ctx, p, midShoulderX, midShoulderY, span) {
    const nose = p[0];
    const headRadius = Math.max(18, span * 0.28);
    const headCenterX = nose ? nose.x : midShoulderX;
    const headCenterY = nose ? nose.y - headRadius * 0.15 : midShoulderY - span * 0.55;

    // Cranium
    ctx.strokeStyle = this.options.boneColor;
    ctx.lineWidth = Math.max(3, span * 0.04);
    ctx.fillStyle = "rgba(10, 30, 48, 0.4)";

    ctx.beginPath();
    ctx.ellipse(headCenterX, headCenterY, headRadius * 0.85, headRadius * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mandible / Jaw
    const jawY = headCenterY + headRadius * 0.9;
    ctx.beginPath();
    ctx.moveTo(headCenterX - headRadius * 0.5, headCenterY + headRadius * 0.4);
    ctx.lineTo(headCenterX - headRadius * 0.35, jawY);
    ctx.lineTo(headCenterX + headRadius * 0.35, jawY);
    ctx.lineTo(headCenterX + headRadius * 0.5, headCenterY + headRadius * 0.4);
    ctx.lineWidth = Math.max(2, span * 0.03);
    ctx.stroke();

    // Eye sockets
    ctx.fillStyle = "rgba(4, 12, 22, 0.8)";
    const eyeOffsetX = headRadius * 0.32;
    const eyeOffsetY = headRadius * 0.1;
    const eyeSize = headRadius * 0.22;

    ctx.beginPath();
    ctx.ellipse(headCenterX - eyeOffsetX, headCenterY + eyeOffsetY, eyeSize, eyeSize * 0.85, 0, 0, Math.PI * 2);
    ctx.ellipse(headCenterX + eyeOffsetX, headCenterY + eyeOffsetY, eyeSize, eyeSize * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSpineAndRibcage(ctx, sx, sy, hx, hy, ls, rs, span) {
    // Clavicles (collarbones)
    ctx.strokeStyle = this.options.boneColor;
    ctx.lineWidth = Math.max(3.5, span * 0.04);

    ctx.beginPath();
    ctx.moveTo(ls.x, ls.y);
    ctx.quadraticCurveTo(sx, sy + span * 0.05, rs.x, rs.y);
    ctx.stroke();

    // Sternum
    const sternumTopY = sy + span * 0.05;
    const sternumBottomY = sy + span * 0.65;
    ctx.lineWidth = Math.max(5, span * 0.06);
    ctx.beginPath();
    ctx.moveTo(sx, sternumTopY);
    ctx.lineTo(sx, sternumBottomY);
    ctx.stroke();

    // Vertebral Column (Spine)
    ctx.lineWidth = Math.max(4, span * 0.05);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(sx, sy - span * 0.1);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ribs (6 bilateral curved thoracic cage ribs)
    const ribCount = 6;
    ctx.lineWidth = Math.max(2, span * 0.024);
    for (let i = 0; i < ribCount; i++) {
      const t = (i + 1) / (ribCount + 1);
      const spineY = sy + (hy - sy) * 0.12 + t * (span * 0.75);
      const sternY = sternumTopY + t * (sternumBottomY - sternumTopY) * 0.95;
      const ribSpread = (span * 0.38) * Math.sin(t * Math.PI * 0.85 + 0.3);

      // Left rib
      ctx.beginPath();
      ctx.moveTo(sx, spineY);
      ctx.bezierCurveTo(
        sx - ribSpread * 1.1, spineY + span * 0.04,
        sx - ribSpread, sternY + span * 0.02,
        sx - Math.max(2, span * 0.03), sternY
      );
      ctx.stroke();

      // Right rib
      ctx.beginPath();
      ctx.moveTo(sx, spineY);
      ctx.bezierCurveTo(
        sx + ribSpread * 1.1, spineY + span * 0.04,
        sx + ribSpread, sternY + span * 0.02,
        sx + Math.max(2, span * 0.03), sternY
      );
      ctx.stroke();
    }
  }

  drawPelvis(ctx, lh, rh, hx, hy, span) {
    ctx.strokeStyle = this.options.boneColor;
    ctx.lineWidth = Math.max(4, span * 0.045);
    const pelvisRadius = Math.max(12, span * 0.22);

    // Left Iliac Wing
    ctx.beginPath();
    ctx.ellipse(lh.x, lh.y - pelvisRadius * 0.15, pelvisRadius * 0.7, pelvisRadius * 0.9, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Right Iliac Wing
    ctx.beginPath();
    ctx.ellipse(rh.x, rh.y - pelvisRadius * 0.15, pelvisRadius * 0.7, pelvisRadius * 0.9, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Sacrum triangle
    ctx.beginPath();
    ctx.moveTo(hx - span * 0.08, hy - span * 0.1);
    ctx.lineTo(hx + span * 0.08, hy - span * 0.1);
    ctx.lineTo(hx, hy + span * 0.15);
    ctx.closePath();
    ctx.stroke();
  }

  drawArm(ctx, shoulder, elbow, wrist, span, side) {
    if (!shoulder || !elbow || elbow.vis < 0.3) return;

    const boneWidth = Math.max(3.5, span * 0.04);

    // Humerus (Upper arm)
    this.drawBoneSegment(ctx, shoulder.x, shoulder.y, elbow.x, elbow.y, boneWidth);
    this.drawJoint(ctx, elbow.x, elbow.y, boneWidth * 1.25);

    // Forearm (Radius & Ulna)
    if (wrist && wrist.vis > 0.3) {
      // Parallel dual bones for forearm
      const dx = wrist.x - elbow.x;
      const dy = wrist.y - elbow.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (boneWidth * 0.6);
      const ny = (dx / len) * (boneWidth * 0.6);

      // Radius
      this.drawBoneSegment(ctx, elbow.x + nx, elbow.y + ny, wrist.x + nx, wrist.y + ny, boneWidth * 0.65);
      // Ulna
      this.drawBoneSegment(ctx, elbow.x - nx, elbow.y - ny, wrist.x - nx, wrist.y - ny, boneWidth * 0.65);

      this.drawJoint(ctx, wrist.x, wrist.y, boneWidth * 1.15);
    }
  }

  drawLeg(ctx, hip, knee, ankle, span, side) {
    if (!hip || !knee || knee.vis < 0.3) return;

    const boneWidth = Math.max(4.5, span * 0.05);

    // Femur (Thigh)
    this.drawBoneSegment(ctx, hip.x, hip.y, knee.x, knee.y, boneWidth);

    // Patella (Knee cap joint)
    this.drawJoint(ctx, knee.x, knee.y, boneWidth * 1.35);

    // Lower Leg (Tibia & Fibula)
    if (ankle && ankle.vis > 0.3) {
      const dx = ankle.x - knee.x;
      const dy = ankle.y - knee.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (boneWidth * 0.55);
      const ny = (dx / len) * (boneWidth * 0.55);

      // Tibia (main shin bone)
      this.drawBoneSegment(ctx, knee.x, knee.y, ankle.x, ankle.y, boneWidth * 0.8);
      // Fibula (lateral thin bone)
      const fibulaSide = side === "left" ? 1 : -1;
      this.drawBoneSegment(
        ctx,
        knee.x + nx * fibulaSide, knee.y + ny * fibulaSide,
        ankle.x + nx * fibulaSide, ankle.y + ny * fibulaSide,
        boneWidth * 0.4
      );

      this.drawJoint(ctx, ankle.x, ankle.y, boneWidth * 1.15);
    }
  }

  drawBoneSegment(ctx, x1, y1, x2, y2, width) {
    ctx.strokeStyle = this.options.boneColor;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawJoint(ctx, x, y, radius) {
    ctx.fillStyle = this.options.jointColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

window.SkeletonRenderer = SkeletonRenderer;
