/**
 * HeartDrop - segmentation.js
 * Handles person-vs-background segmentation for Anatomy Mode.
 * Renders a stylized semi-transparent X-ray body silhouette so the anatomical
 * layers appear naturally enclosed inside the user's body.
 */

class BodySegmentationRenderer {
  constructor() {
    this.maskCanvas = document.createElement("canvas");
    this.maskCtx = this.maskCanvas.getContext("2d");
  }

  /**
   * Applies the X-ray body silhouette over the user's detected body.
   * @param {CanvasRenderingContext2D} ctx - Main AR canvas context
   * @param {ImageBitmap|HTMLCanvasElement} segmentationMask - MediaPipe segmentation mask
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} opacity - Overlay opacity (0..1)
   */
  renderSilhouette(ctx, segmentationMask, width, height, opacity = 0.38) {
    if (!segmentationMask) return;

    if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
    }

    const mCtx = this.maskCtx;
    mCtx.clearRect(0, 0, width, height);

    // Draw the segmentation mask mirrored to match the selfie camera
    mCtx.save();
    mCtx.translate(width, 0);
    mCtx.scale(-1, 1);
    mCtx.drawImage(segmentationMask, 0, 0, width, height);

    // Apply composite tint inside the detected person
    mCtx.globalCompositeOperation = "source-in";
    const bodyGrad = mCtx.createLinearGradient(0, 0, 0, height);
    bodyGrad.addColorStop(0, "rgba(14, 30, 48, 0.55)");
    bodyGrad.addColorStop(0.5, "rgba(8, 20, 36, 0.45)");
    bodyGrad.addColorStop(1, "rgba(6, 14, 26, 0.6)");
    mCtx.fillStyle = bodyGrad;
    mCtx.fillRect(0, 0, width, height);
    mCtx.restore();

    // Draw silhouette onto main AR canvas
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.maskCanvas, 0, 0);

    // Subtle edge rim glow
    ctx.shadowColor = "rgba(128, 222, 234, 0.4)";
    ctx.shadowBlur = 12;
    ctx.drawImage(this.maskCanvas, 0, 0);
    ctx.restore();
  }
}

window.BodySegmentationRenderer = BodySegmentationRenderer;
