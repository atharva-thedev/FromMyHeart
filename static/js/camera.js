/**
 * HeartDrop - camera.js
 * Handles webcam initialization, stream lifecycle, video element binding,
 * and user permission error management.
 */

class CameraManager {
  constructor(videoElement, options = {}) {
    this.videoElement = videoElement;
    this.stream = null;
    this.isPlaying = false;
    this.options = Object.assign({
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }, options);

    this.onStreamReady = null;
    this.onError = null;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error("Camera API is not supported in this browser.");
      if (this.onError) this.onError(err);
      throw err;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.options.facingMode,
          width: this.options.width,
          height: this.options.height
        },
        audio: false
      });

      this.videoElement.srcObject = this.stream;
      
      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          this.isPlaying = true;
          if (this.onStreamReady) {
            this.onStreamReady(this.videoElement);
          }
          resolve(this.videoElement);
        };
      });
    } catch (error) {
      console.error("Camera access failed:", error);
      let userFriendlyMsg = "Camera access is required for the experience.";
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        userFriendlyMsg = "Camera permission was denied. Please allow camera access in your browser settings to proceed.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        userFriendlyMsg = "No camera found on this device. Please connect a camera.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        userFriendlyMsg = "Camera is already in use by another application.";
      }
      
      const customError = new Error(userFriendlyMsg);
      customError.original = error;
      if (this.onError) this.onError(customError);
      throw customError;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.isPlaying = false;
  }

  getVideoSize() {
    return {
      width: this.videoElement ? this.videoElement.videoWidth || 1280 : 1280,
      height: this.videoElement ? this.videoElement.videoHeight || 720 : 720
    };
  }
}

window.CameraManager = CameraManager;
