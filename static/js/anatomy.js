/**
 * HeartDrop - anatomy.js
 * Renders an ecorche anatomical X-ray body visualization directly inspired
 * by the reference anatomical model:
 * - Sculpted ivory skull and spine
 * - Slate-blue / steel musculature with anatomical fiber striations
 * - Luminous amber/gold thoracic heart organ that pulses with life
 * - Deep terracotta segmented abdominal core
 * - Precision object-fit camera projection onto the user's detected body
 */

class AnatomyManager {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = Object.assign({
      smoothing: 0.35,
      boneIvory: "#f0eae1",
      boneShade: "#4a423a",
      muscleSteel: "rgba(58, 96, 115, 0.82)",
      muscleSteelDark: "rgba(28, 48, 62, 0.9)",
      muscleFiber: "rgba(144, 185, 205, 0.45)",
      coreCrimson: "rgba(168, 54, 45, 0.85)",
      coreHighlight: "rgba(220, 95, 80, 0.5)",
      heartGold: "rgba(255, 183, 3, 0.95)",
      heartAmber: "rgba(251, 133, 0, 0.9)"
    }, options);

    this.mode = "normal"; // 'normal' | 'anatomy'
    this.smoothed = null;
    this.heartPos = null;
    this.isHeartHovered = false;
    this.onHeartSelected = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Projects normalized landmark (0..1) to actual canvas pixels taking
   * into account videoElement's object-fit: cover and scaleX(-1) selfie mirror.
   */
  project(lm, screenW, screenH, videoEl) {
    if (!lm) return null;
    const vW = videoEl && videoEl.videoWidth ? videoEl.videoWidth : 1280;
    const vH = videoEl && videoEl.videoHeight ? videoEl.videoHeight : 720;

    const vRatio = vW / vH;
    const sRatio = screenW / screenH;

    let rW, rH, offX, offY;
    if (sRatio > vRatio) {
      rW = screenW;
      rH = screenW / vRatio;
      offX = 0;
      offY = (screenH - rH) / 2;
    } else {
      rH = screenH;
      rW = screenH * vRatio;
      offX = (screenW - rW) / 2;
      offsetY = 0;
    }

    // Mirroring adjustment (scaleX(-1))
    const x = offX + (1 - lm.x) * rW;
    const y = offY + lm.y * rH;
    const vis = lm.visibility !== undefined ? lm.visibility : 1.0;
    return { x, y, vis };
  }

  smooth(rawLandmarks, screenW, screenH, videoEl) {
    if (!rawLandmarks || rawLandmarks.length === 0) return null;

    if (!this.smoothed) {
      this.smoothed = {};
      for (let i = 0; i < rawLandmarks.length; i++) {
        const p = this.project(rawLandmarks[i], screenW, screenH, videoEl);
        if (p) this.smoothed[i] = p;
      }
      return this.smoothed;
    }

    const a = this.options.smoothing;
    for (let i = 0; i < rawLandmarks.length; i++) {
      const target = this.project(rawLandmarks[i], screenW, screenH, videoEl);
      if (!target) continue;

      if (!this.smoothed[i]) {
        this.smoothed[i] = target;
      } else {
        const curr = this.smoothed[i];
        curr.x += (target.x - curr.x) * a;
        curr.y += (target.y - curr.y) * a;
        curr.vis = target.vis;
      }
    }
    return this.smoothed;
  }

  /**
   * Main render method for the reference ecorche body.
   */
  render(rawPoseLandmarks, videoEl, handLandmarks = [], time = performance.now()) {
    if (this.mode !== "anatomy") return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const p = this.smooth(rawPoseLandmarks, w, h, videoEl);
    if (!p || !p[11] || !p[12]) return;

    const ls = p[11];
    const rs = p[12];
    const nose = p[0];
    const lh = p[23];
    const rh = p[24];

    const midX = (ls.x + rs.x) / 2;
    const midY = (ls.y + rs.y) / 2;
    const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);

    const hasHips = lh && rh && lh.vis > 0.25 && rh.vis > 0.25;
    const hipMidX = hasHips ? (lh.x + rh.x) / 2 : midX;
    const hipMidY = hasHips ? (lh.y + rh.y) / 2 : midY + span * 1.6;

    // Check hand hover distance to heart
    this.updateHeartProximity(handLandmarks, w, h, videoEl);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Torso Base Shading (translucent ecorche silhouette)
    this.drawTorsoMass(ctx, ls, rs, midX, midY, hipMidX, hipMidY, span);

    // 2. Head & Sculpted Skull
    this.drawSkull(ctx, nose, midX, midY, span);

    // 3. Clavicles, Spine & Articulated Ribcage
    this.drawSpineAndRibcage(ctx, midX, midY, hipMidX, hipMidY, ls, rs, span);

    // 4. Steel-Blue Pectoral & Shoulder Muscles
    this.drawUpperBodyMusculature(ctx, ls, rs, midX, midY, span);

    // 5. Segmented Terracotta Abdominal Core (6-pack)
    this.drawAbdominalCore(ctx, midX, midY, hipMidX, hipMidY, span);

    // 6. Arms (Biceps, Forearms, Joints)
    this.drawArmAnatomy(ctx, ls, p[13], p[15], span, "left");
    this.drawArmAnatomy(ctx, rs, p[14], p[16], span, "right");

    // 7. Glowing Amber/Gold Thoracic Heart Organ (prominent, beating, just like reference image!)
    this.drawIlluminatedHeart(ctx, midX, midY, ls, rs, span, time);

    // 8. Pelvis & Legs if visible
    if (hasHips) {
      this.drawPelvicGirdle(ctx, lh, rh, hipMidX, hipMidY, span);
      if (p[25] && p[26]) {
        this.drawLegAnatomy(ctx, lh, p[25], p[27], span, "left");
        this.drawLegAnatomy(ctx, rh, p[26], p[28], span, "right");
      }
    }

    // 9. Floating Organ Tag when hovered
    if (this.isHeartHovered && this.heartPos) {
      this.drawHeartTag(ctx, this.heartPos.x, this.heartPos.y, this.heartPos.radius);
    }

    ctx.restore();
  }

  drawTorsoMass(ctx, ls, rs, mx, my, hx, hy, span) {
    ctx.save();
    const grad = ctx.createLinearGradient(mx, my, mx, hy);
    grad.addColorStop(0, "rgba(25, 42, 54, 0.45)");
    grad.addColorStop(0.5, "rgba(18, 30, 40, 0.55)");
    grad.addColorStop(1, "rgba(12, 22, 30, 0.65)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ls.x, ls.y);
    ctx.quadraticCurveTo(ls.x - span * 0.15, my + span * 0.8, hx - span * 0.35, hy);
    ctx.lineTo(hx + span * 0.35, hy);
    ctx.quadraticCurveTo(rs.x + span * 0.15, my + span * 0.8, rs.x, rs.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawSkull(ctx, nose, mx, my, span) {
    const headRadius = Math.max(22, span * 0.3);
    const hx = nose ? nose.x : mx;
    const hy = nose ? nose.y - headRadius * 0.2 : my - span * 0.55;

    ctx.save();
    // Cranium
    ctx.fillStyle = this.options.boneIvory;
    ctx.shadowColor = "rgba(240, 234, 225, 0.4)";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.ellipse(hx, hy - headRadius * 0.2, headRadius * 0.85, headRadius * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mandible / Jaw
    ctx.fillStyle = "#ded6ca";
    ctx.beginPath();
    ctx.moveTo(hx - headRadius * 0.5, hy + headRadius * 0.3);
    ctx.lineTo(hx - headRadius * 0.3, hy + headRadius * 0.95);
    ctx.lineTo(hx + headRadius * 0.3, hy + headRadius * 0.95);
    ctx.lineTo(hx + headRadius * 0.5, hy + headRadius * 0.3);
    ctx.closePath();
    ctx.fill();

    // Darkened Eye Sockets & Nasal Aperture
    ctx.fillStyle = "#1e1a17";
    ctx.shadowBlur = 0;
    const eyeOff = headRadius * 0.32;
    const eyeR = headRadius * 0.22;

    // Left orbit
    ctx.beginPath();
    ctx.ellipse(hx - eyeOff, hy, eyeR, eyeR * 0.85, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Right orbit
    ctx.beginPath();
    ctx.ellipse(hx + eyeOff, hy, eyeR, eyeR * 0.85, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Nasal piriform cavity
    ctx.beginPath();
    ctx.moveTo(hx, hy + headRadius * 0.2);
    ctx.lineTo(hx - headRadius * 0.1, hy + headRadius * 0.48);
    ctx.lineTo(hx + headRadius * 0.1, hy + headRadius * 0.48);
    ctx.closePath();
    ctx.fill();

    // Teeth hints
    ctx.strokeStyle = "#4a423a";
    ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i * (headRadius * 0.08), hy + headRadius * 0.75);
      ctx.lineTo(hx + i * (headRadius * 0.08), hy + headRadius * 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSpineAndRibcage(ctx, mx, my, hx, hy, ls, rs, span) {
    ctx.save();
    // Clavicles (Collarbones)
    ctx.strokeStyle = this.options.boneIvory;
    ctx.lineWidth = Math.max(3.5, span * 0.04);
    ctx.shadowColor = "rgba(240, 234, 225, 0.4)";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(ls.x, ls.y);
    ctx.quadraticCurveTo(mx, my + span * 0.06, rs.x, rs.y);
    ctx.stroke();

    // Articulated Vertebral Column (Spine)
    const spineStartY = my - span * 0.08;
    const spineEndY = hy;
    const vertebraeCount = 12;
    const vertStep = (spineEndY - spineStartY) / vertebraeCount;

    ctx.fillStyle = this.options.boneIvory;
    ctx.strokeStyle = this.options.boneShade;
    ctx.lineWidth = 1.2;

    for (let i = 0; i < vertebraeCount; i++) {
      const vy = spineStartY + i * vertStep;
      const vw = Math.max(10, span * 0.08 * (1 - i * 0.02));
      const vh = vertStep * 0.65;

      ctx.beginPath();
      ctx.roundRect(mx - vw / 2, vy, vw, vh, 3);
      ctx.fill();
      ctx.stroke();
    }

    // Ribcage (Costal arches)
    ctx.strokeStyle = "rgba(240, 234, 225, 0.75)";
    ctx.lineWidth = Math.max(2.2, span * 0.026);
    const ribCount = 5;
    for (let r = 0; r < ribCount; r++) {
      const ry = my + span * (0.16 + r * 0.1);
      const rSpread = span * (0.28 + r * 0.035);

      // Left rib
      ctx.beginPath();
      ctx.moveTo(mx - 6, ry);
      ctx.quadraticCurveTo(mx - rSpread, ry + span * 0.08, mx - 8, ry + span * 0.14);
      ctx.stroke();

      // Right rib
      ctx.beginPath();
      ctx.moveTo(mx + 6, ry);
      ctx.quadraticCurveTo(mx + rSpread, ry + span * 0.08, mx + 8, ry + span * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawUpperBodyMusculature(ctx, ls, rs, mx, my, span) {
    ctx.save();
    // Deltoids (Shoulders) - Steel-blue mass
    const deltoidR = Math.max(16, span * 0.22);
    ctx.fillStyle = this.options.muscleSteel;
    ctx.strokeStyle = this.options.muscleFiber;
    ctx.lineWidth = 1.2;

    // Left Deltoid
    ctx.beginPath();
    ctx.arc(ls.x, ls.y, deltoidR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right Deltoid
    ctx.beginPath();
    ctx.arc(rs.x, rs.y, deltoidR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pectoral Muscle on Left Side (anatomical left chest)
    const pecH = span * 0.42;
    const pecW = span * 0.4;
    ctx.fillStyle = this.options.muscleSteel;
    ctx.beginPath();
    ctx.moveTo(mx + 4, my + span * 0.08);
    ctx.lineTo(rs.x, rs.y);
    ctx.quadraticCurveTo(rs.x + pecW * 0.25, my + pecH, mx + 4, my + pecH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Muscle fiber fan lines
    for (let f = 0.2; f <= 0.8; f += 0.2) {
      ctx.beginPath();
      ctx.moveTo(rs.x, rs.y);
      ctx.quadraticCurveTo(mx + pecW * 0.4, my + pecH * f, mx + 6, my + pecH * f);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAbdominalCore(ctx, mx, my, hx, hy, span) {
    ctx.save();
    // Segmented deep crimson/terracotta abdominal core (six-pack)
    const coreStartY = my + span * 0.48;
    const coreEndY = hy - span * 0.15;
    const totalH = Math.max(span * 0.6, coreEndY - coreStartY);
    const rows = 3;
    const rowH = totalH / rows;
    const packW = span * 0.16;

    ctx.fillStyle = this.options.coreCrimson;
    ctx.strokeStyle = this.options.coreHighlight;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "rgba(168, 54, 45, 0.4)";
    ctx.shadowBlur = 8;

    for (let r = 0; r < rows; r++) {
      const cy = coreStartY + r * rowH + rowH * 0.1;
      const w = packW * (1 - r * 0.06);

      // Left block
      ctx.beginPath();
      ctx.roundRect(mx - w - 4, cy, w, rowH * 0.8, 5);
      ctx.fill();
      ctx.stroke();

      // Right block
      ctx.beginPath();
      ctx.roundRect(mx + 4, cy, w, rowH * 0.8, 5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawArmAnatomy(ctx, shoulder, elbow, wrist, span, side) {
    if (!shoulder || !elbow || elbow.vis < 0.25) return;

    ctx.save();
    const boneW = Math.max(4, span * 0.04);
    const muscleR = Math.max(10, span * 0.13);

    // Biceps / Triceps muscle mass
    const bMidX = (shoulder.x + elbow.x) / 2;
    const bMidY = (shoulder.y + elbow.y) / 2;
    const armAngle = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x);

    ctx.fillStyle = this.options.muscleSteel;
    ctx.strokeStyle = this.options.muscleFiber;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.ellipse(bMidX, bMidY, muscleR, Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y) * 0.42, armAngle - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ivory Elbow joint
    ctx.fillStyle = this.options.boneIvory;
    ctx.beginPath();
    ctx.arc(elbow.x, elbow.y, boneW * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Forearm muscle & bones
    if (wrist && wrist.vis > 0.25) {
      const fMidX = (elbow.x * 0.6 + wrist.x * 0.4);
      const fMidY = (elbow.y * 0.6 + wrist.y * 0.4);
      const fAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

      ctx.fillStyle = this.options.muscleSteel;
      ctx.beginPath();
      ctx.ellipse(fMidX, fMidY, muscleR * 0.8, Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) * 0.38, fAngle - Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wrist joint
      ctx.fillStyle = this.options.boneIvory;
      ctx.beginPath();
      ctx.arc(wrist.x, wrist.y, boneW * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPelvicGirdle(ctx, lh, rh, hx, hy, span) {
    ctx.save();
    ctx.strokeStyle = this.options.boneIvory;
    ctx.lineWidth = Math.max(4, span * 0.045);
    ctx.shadowColor = "rgba(240, 234, 225, 0.4)";
    ctx.shadowBlur = 10;

    const pr = Math.max(14, span * 0.22);
    // Left iliac wing
    ctx.beginPath();
    ctx.ellipse(lh.x, lh.y - pr * 0.1, pr * 0.7, pr * 0.85, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Right iliac wing
    ctx.beginPath();
    ctx.ellipse(rh.x, rh.y - pr * 0.1, pr * 0.7, pr * 0.85, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawLegAnatomy(ctx, hip, knee, ankle, span, side) {
    if (!hip || !knee || knee.vis < 0.25) return;

    ctx.save();
    const muscleR = Math.max(12, span * 0.16);
    const thMidX = (hip.x + knee.x) / 2;
    const thMidY = (hip.y + knee.y) / 2;
    const thAngle = Math.atan2(knee.y - hip.y, knee.x - hip.x);

    // Quadriceps
    ctx.fillStyle = this.options.muscleSteel;
    ctx.beginPath();
    ctx.ellipse(thMidX, thMidY, muscleR, Math.hypot(knee.x - hip.x, knee.y - hip.y) * 0.44, thAngle - Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();

    // Patella / Knee joint
    ctx.fillStyle = this.options.boneIvory;
    ctx.beginPath();
    ctx.arc(knee.x, knee.y, span * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Calves
    if (ankle && ankle.vis > 0.25) {
      const cMidX = (knee.x * 0.6 + ankle.x * 0.4);
      const cMidY = (knee.y * 0.6 + ankle.y * 0.4);
      const cAngle = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);

      ctx.fillStyle = this.options.muscleSteel;
      ctx.beginPath();
      ctx.ellipse(cMidX, cMidY, muscleR * 0.75, Math.hypot(ankle.x - knee.x, ankle.y - knee.y) * 0.4, cAngle - Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();

      // Ankle joint
      ctx.fillStyle = this.options.boneIvory;
      ctx.beginPath();
      ctx.arc(ankle.x, ankle.y, span * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Prominent, glowing amber/gold illuminated thoracic heart organ.
   * Matches the warm illuminated chest mass from the user's reference image!
   */
  drawIlluminatedHeart(ctx, mx, my, ls, rs, span, time) {
    ctx.save();
    // Heart placed on anatomical right side of user's chest (mirrored view)
    const hx = mx - span * 0.16;
    const hy = my + span * 0.28;
    const baseR = Math.max(20, span * 0.18);

    // Realistic cardiac beat calculation
    const cycle = (time % 950) / 950;
    let pulse = 1.0;
    if (cycle < 0.15) {
      pulse = 1.0 + Math.sin((cycle / 0.15) * Math.PI) * 0.18;
    } else if (cycle > 0.25 && cycle < 0.38) {
      pulse = 1.0 + Math.sin(((cycle - 0.25) / 0.13) * Math.PI) * 0.08;
    }

    const isHovered = this.isHeartHovered;
    const r = baseR * pulse * (isHovered ? 1.25 : 1.0);

    this.heartPos = { x: hx, y: hy, radius: r };

    // Radial gold/amber aura
    const aura = ctx.createRadialGradient(hx, hy, r * 0.2, hx, hy, r * 2.8);
    aura.addColorStop(0, isHovered ? "rgba(255, 214, 10, 0.95)" : "rgba(255, 183, 3, 0.85)");
    aura.addColorStop(0.5, isHovered ? "rgba(251, 133, 0, 0.45)" : "rgba(251, 133, 0, 0.25)");
    aura.addColorStop(1, "rgba(251, 133, 0, 0)");

    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Anatomical Visceral Heart Mass (Warm amber/golden ecorche organ)
    const heartGrad = ctx.createLinearGradient(hx - r, hy - r, hx + r, hy + r);
    heartGrad.addColorStop(0, isHovered ? "#fff3b0" : "#ffd166");
    heartGrad.addColorStop(0.5, isHovered ? "#ffb703" : "#fb8500");
    heartGrad.addColorStop(1, "#d90429");

    ctx.fillStyle = heartGrad;
    ctx.shadowColor = isHovered ? "#ffd166" : "#fb8500";
    ctx.shadowBlur = isHovered ? 32 : 18;

    ctx.beginPath();
    ctx.moveTo(hx, hy - r * 0.7);
    ctx.bezierCurveTo(hx - r * 1.1, hy - r * 1.1, hx - r * 1.3, hy + r * 0.5, hx, hy + r * 1.2);
    ctx.bezierCurveTo(hx + r * 1.2, hy + r * 0.5, hx + r * 1.1, hy - r * 1.1, hx, hy - r * 0.7);
    ctx.closePath();
    ctx.fill();

    // Visceral striation contours
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.2, hy - r * 0.5);
    ctx.quadraticCurveTo(hx - r * 0.4, hy, hx, hy + r * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  updateHeartProximity(handLandmarks, screenW, screenH, videoEl) {
    this.isHeartHovered = false;
    if (!this.heartPos || !handLandmarks || handLandmarks.length === 0) return;

    for (const hand of handLandmarks) {
      const indexProj = this.project(hand.indexTip, screenW, screenH, videoEl);
      if (!indexProj) continue;

      const d = Math.hypot(indexProj.x - this.heartPos.x, indexProj.y - this.heartPos.y);
      if (d < this.heartPos.radius + 50) {
        this.isHeartHovered = true;
        break;
      }
    }
  }

  drawHeartTag(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y - radius - 26);

    const text = "🫀 HEART";
    ctx.font = "bold 13px 'Outfit', sans-serif";
    const tw = ctx.measureText(text).width;
    const bw = tw + 28;
    const bh = 26;

    ctx.fillStyle = "rgba(12, 10, 16, 0.88)";
    ctx.strokeStyle = "#ffb703";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255, 183, 3, 0.8)";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 13);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  getHeartPosition() {
    return this.heartPos;
  }

  handleInteraction(x, y) {
    if (this.mode !== "anatomy" || !this.heartPos) return false;
    const d = Math.hypot(x - this.heartPos.x, y - this.heartPos.y);
    if (d < this.heartPos.radius + 40) {
      if (this.onHeartSelected) {
        this.onHeartSelected(this.heartPos);
        return true;
      }
    }
    return false;
  }
}

window.AnatomyManager = AnatomyManager;
