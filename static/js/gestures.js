/**
 * HeartDrop - gestures.js
 * Computer Vision processing using MediaPipe Pose and Hands.
 * Calculates chest center, detects hands-near-chest gesture (debounced 500ms),
 * hand-to-heart distance, grabbing interaction, and tap/pinch triggers.
 */

class GestureDetector {
  constructor(options = {}) {
    this.options = Object.assign({
      chestHoldDurationMs: 500, // 500ms required hold duration
      grabDistancePx: 75,       // Maximum pixel distance to grab heart
      pinchDistancePx: 45       // Maximum distance between thumb & index for pinch
    }, options);

    // Callbacks
    this.onChestGestureProgress = null; // (progress 0..1)
    this.onHeartActivated = null;       // ()
    this.onHeartGrabbed = null;         // (handPosition)
    this.onHeartMove = null;            // (handPosition)
    this.onHeartReleased = null;        // ()
    this.onHeartTapped = null;          // ()

    // State tracking
    this.poseDetector = null;
    this.handsDetector = null;
    this.isPoseReady = false;
    this.isHandsReady = false;

    this.chestCenter = null;
    this.shoulderSpan = null;
    this.handsNearChestTimer = 0;
    this.lastFrameTime = performance.now();

    this.isHeartActive = false;
    this.isHeartGrabbed = false;
    this.activeGrabHand = null;

    // Hand landmarks cache
    this.currentHands = [];
    this.currentPose = null;
  }

  /**
   * Initializes MediaPipe Pose and Hands detectors.
   */
  async init() {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.Pose === "undefined" || typeof window.Hands === "undefined") {
          console.warn("MediaPipe Pose or Hands not loaded on window.");
          resolve(false);
          return;
        }

        // Initialize Pose
        this.poseDetector = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        this.poseDetector.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35
        });

        this.poseDetector.onResults((results) => {
          this.handlePoseResults(results);
        });

        // Initialize Hands
        this.handsDetector = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.handsDetector.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.4,
          minTrackingConfidence: 0.4
        });

        this.handsDetector.onResults((results) => {
          this.handleHandsResults(results);
        });

        this.isPoseReady = true;
        this.isHandsReady = true;
        resolve(true);
      } catch (err) {
        console.error("Gesture detector init failed:", err);
        reject(err);
      }
    });
  }

  /**
   * Process a single video frame with Pose and Hands.
   */
  async send(videoElement) {
    if (!videoElement || videoElement.readyState < 2) return;
    try {
      if (this.poseDetector) {
        await this.poseDetector.send({ image: videoElement });
      }
      if (this.handsDetector) {
        await this.handsDetector.send({ image: videoElement });
      }
    } catch (e) {
      console.debug("CV frame notice:", e);
    }
  }

  /**
   * Processes Pose detection results.
   */
  handlePoseResults(results) {
    const now = performance.now();
    const deltaTime = Math.min(now - this.lastFrameTime, 100);
    this.lastFrameTime = now;

    if (!results.poseLandmarks) {
      this.currentPose = null;
      this.chestCenter = null;
      this.handsNearChestTimer = Math.max(0, this.handsNearChestTimer - deltaTime);
      if (this.onChestGestureProgress) this.onChestGestureProgress(0);
      return;
    }

    const landmarks = results.poseLandmarks;
    this.currentPose = landmarks;

    // Landmarks index reference:
    // 11: left_shoulder, 12: right_shoulder
    // 15: left_wrist, 16: right_wrist
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    // Check visibility / presence
    const shouldersVisible = (leftShoulder && rightShoulder &&
      (leftShoulder.visibility === undefined || (leftShoulder.visibility > 0.2 || rightShoulder.visibility > 0.2)));

    if (!shouldersVisible) {
      return;
    }

    // Mirroring adjustment:
    // Because the video element is mirrored horizontally (scaleX(-1)),
    // mirrored_x = 1 - landmark.x so visual coordinates match screen pixels.
    const lsX = 1 - leftShoulder.x;
    const lsY = leftShoulder.y;
    const rsX = 1 - rightShoulder.x;
    const rsY = rightShoulder.y;

    // Calculate shoulder span in normalized space
    const span = Math.hypot(rsX - lsX, rsY - lsY);
    this.shoulderSpan = span;

    // Calculate approximate chest center:
    // Midpoint between shoulders, shifted downward by ~30% of shoulder span
    const midX = (lsX + rsX) / 2;
    const midY = (lsY + rsY) / 2;
    const chestX = midX;
    const chestY = midY + span * 0.32;

    this.chestCenter = { x: chestX, y: chestY };

    // If heart is not yet activated, test both hands proximity to chest
    if (!this.isHeartActive && leftWrist && rightWrist) {
      const lwX = 1 - leftWrist.x;
      const lwY = leftWrist.y;
      const rwX = 1 - rightWrist.x;
      const rwY = rightWrist.y;

      const distLeft = Math.hypot(lwX - chestX, lwY - chestY);
      const distRight = Math.hypot(rwX - chestX, rwY - chestY);

      // Gesture trigger threshold is proportional to body size (approx 65% of shoulder width)
      const proximityThreshold = span * 0.7;
      const isBothNear = (distLeft < proximityThreshold && distRight < proximityThreshold);

      if (isBothNear) {
        this.handsNearChestTimer += deltaTime;
        const progress = Math.min(1, this.handsNearChestTimer / this.options.chestHoldDurationMs);
        if (this.onChestGestureProgress) this.onChestGestureProgress(progress);

        if (this.handsNearChestTimer >= this.options.chestHoldDurationMs) {
          this.isHeartActive = true;
          if (this.onHeartActivated) {
            this.onHeartActivated({ x: chestX, y: chestY });
          }
        }
      } else {
        this.handsNearChestTimer = Math.max(0, this.handsNearChestTimer - deltaTime * 1.5);
        const progress = Math.min(1, this.handsNearChestTimer / this.options.chestHoldDurationMs);
        if (this.onChestGestureProgress) this.onChestGestureProgress(progress);
      }
    }
  }

  /**
   * Processes Hands detection results.
   * Tracks fingers, detects grabbing distance to heart, and detects pinch/tap.
   */
  handleHandsResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.currentHands = [];
      if (this.isHeartGrabbed) {
        // Hand left the screen
        this.isHeartGrabbed = false;
        if (this.onHeartReleased) this.onHeartReleased();
      }
      return;
    }

    this.currentHands = results.multiHandLandmarks.map((hand) => {
      // Landmark 4: Thumb tip, 8: Index fingertip, 0: Wrist, 9: Middle knuckle
      const thumbTip = hand[4];
      const indexTip = hand[8];
      const wrist = hand[0];
      const middleKnuckle = hand[9];

      const mirroredIndex = { x: 1 - indexTip.x, y: indexTip.y };
      const mirroredThumb = { x: 1 - thumbTip.x, y: thumbTip.y };
      const mirroredPalm = { x: 1 - middleKnuckle.x, y: middleKnuckle.y };

      const pinchDistance = Math.hypot(mirroredIndex.x - mirroredThumb.x, mirroredIndex.y - mirroredThumb.y);

      return {
        raw: hand,
        indexTip: mirroredIndex,
        thumbTip: mirroredThumb,
        palmCenter: mirroredPalm,
        pinchDistance: pinchDistance
      };
    });
  }

  /**
   * Checks interaction between active hands and current heart screen coordinates.
   * @param {Object} heartScreenPos - { x, y, radius } in canvas pixel coordinates
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  updateInteraction(heartScreenPos, canvasWidth, canvasHeight) {
    if (!this.isHeartActive || !heartScreenPos) return;

    if (this.currentHands.length === 0) return;

    for (const hand of this.currentHands) {
      const indexPixel = {
        x: hand.indexTip.x * canvasWidth,
        y: hand.indexTip.y * canvasHeight
      };
      const palmPixel = {
        x: hand.palmCenter.x * canvasWidth,
        y: hand.palmCenter.y * canvasHeight
      };

      const distToIndex = Math.hypot(indexPixel.x - heartScreenPos.x, indexPixel.y - heartScreenPos.y);
      const distToPalm = Math.hypot(palmPixel.x - heartScreenPos.x, palmPixel.y - heartScreenPos.y);
      const minDist = Math.min(distToIndex, distToPalm);

      // Grab interaction threshold
      const grabRadius = Math.max(this.options.grabDistancePx, heartScreenPos.radius * 1.2);

      if (!this.isHeartGrabbed) {
        if (minDist < grabRadius) {
          this.isHeartGrabbed = true;
          this.activeGrabHand = hand;
          if (this.onHeartGrabbed) {
            this.onHeartGrabbed({ x: indexPixel.x, y: indexPixel.y });
          }
        }
      } else {
        // Already grabbed: heart follows hand
        if (this.onHeartMove) {
          this.onHeartMove({ x: indexPixel.x, y: indexPixel.y });
        }

        // Tap or pinch interaction:
        // Pinch detected when index tip and thumb tip get close
        const pinchDistancePx = hand.pinchDistance * Math.hypot(canvasWidth, canvasHeight);
        if (pinchDistancePx < this.options.pinchDistancePx) {
          if (this.onHeartTapped) {
            this.onHeartTapped();
          }
        }
      }
    }
  }

  triggerDirectTap() {
    if (this.onHeartTapped) {
      this.onHeartTapped();
    }
  }

  reset() {
    this.isHeartActive = false;
    this.isHeartGrabbed = false;
    this.handsNearChestTimer = 0;
    this.chestCenter = null;
  }
}

window.GestureDetector = GestureDetector;
