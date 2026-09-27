/**
 * HeartDrop - experience.js
 * Master orchestrator for the AR experience.
 * Coordinates Camera, MediaPipe detectors, Heart animations, guidance HUD,
 * and the reveal sequence for photos, videos, and heartfelt messages.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const shareCode = window.HEARTDROP_SHARE_CODE;
  if (!shareCode) {
    console.error("Missing share code.");
    return;
  }

  // DOM Elements
  const videoEl = document.getElementById("camera-video");
  const canvasEl = document.getElementById("ar-canvas");
  const guidanceBox = document.getElementById("guidance-box");
  const guidanceText = document.getElementById("guidance-text");
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingStatus = document.getElementById("loading-status");
  const audioToggleBtn = document.getElementById("audio-toggle");
  const audioIcon = document.getElementById("audio-icon");
  const directTapTrigger = document.getElementById("direct-tap-trigger");

  // Reveal Modal Elements
  const revealModal = document.getElementById("reveal-modal");
  const revealImage = document.getElementById("reveal-image");
  const revealMessage = document.getElementById("reveal-message");
  const btnPlayVideo = document.getElementById("btn-play-video");
  const btnReplay = document.getElementById("btn-replay");
  const videoModal = document.getElementById("video-modal");
  const videoPlayer = document.getElementById("video-player");
  const btnCloseVideo = document.getElementById("btn-close-video");

  // Anatomy Mode UI Elements
  const btnModeNormal = document.getElementById("btn-mode-normal");
  const btnModeAnatomy = document.getElementById("btn-mode-anatomy");

  // App State
  let heartData = null;
  let camera = null;
  let gestures = null;
  let heart = null;
  let anatomy = null;
  let isCvLoopRunning = false;
  let audioActive = true;
  let currentState = "INITIALIZING";

  function setGuidance(text) {
    if (guidanceText) {
      guidanceText.textContent = text;
    }
  }

  function resizeCanvas() {
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 1. Fetch Heart Data from Backend
  try {
    loadingStatus.textContent = "Loading heart surprise...";
    const res = await fetch(`/api/heart/${shareCode}`);
    if (!res.ok) throw new Error("Could not find this heart surprise.");
    heartData = await res.json();

    revealImage.src = heartData.image_url;
    revealMessage.textContent = heartData.message;

    if (heartData.video_url) {
      videoPlayer.src = heartData.video_url;
      btnPlayVideo.style.display = "inline-flex";
    } else {
      btnPlayVideo.style.display = "none";
    }
  } catch (err) {
    loadingStatus.textContent = "Error: " + err.message;
    return;
  }

  // 2. Initialize Heart Renderer
  heart = new HeartRenderer(canvasEl, {
    baseRadius: Math.min(canvasEl.width, canvasEl.height) * 0.055
  });

  // 2.1 Initialize Anatomy Manager
  anatomy = new AnatomyManager(canvasEl);

  // Wire Mode Selector [ Normal ] [ X-Ray Scan ]
  if (btnModeNormal && btnModeAnatomy) {
    btnModeNormal.addEventListener("click", () => {
      btnModeNormal.classList.add("active");
      btnModeAnatomy.classList.remove("active", "anatomy-active");
      anatomy.setMode("normal");
      if (currentState === "SEARCHING_HANDS") {
        setGuidance("Move both hands toward your chest.");
      }
    });

    btnModeAnatomy.addEventListener("click", () => {
      btnModeAnatomy.classList.add("active", "anatomy-active");
      btnModeNormal.classList.remove("active");
      anatomy.setMode("anatomy");
      if (currentState === "SEARCHING_HANDS") {
        setGuidance("X-Ray Scan: Reach out to the glowing heart.");
      }
    });
  }

  // Anatomy Heart Selection Handler
  anatomy.onHeartSelected = (heartPos) => {
    if (currentState !== "REVEALED" && currentState !== "REVEALING") {
      currentState = "HEART_BEATING";
      heart.activate(heartPos.x, heartPos.y);
      setGuidance("Heart selected! Bring hand closer to grab.");
      positionDirectTapTrigger(heartPos.x, heartPos.y, heartPos.radius + 15);
    }
  };

  // 3. Audio Toggle Setup
  audioToggleBtn.addEventListener("click", () => {
    audioActive = !audioActive;
    heart.toggleSound(audioActive);
    audioIcon.innerHTML = audioActive
      ? `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`
      : `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  });

  // 4. Initialize Gesture Detector
  gestures = new GestureDetector({
    chestHoldDurationMs: 500,
    grabDistancePx: 85
  });

  gestures.onChestGestureProgress = (progress) => {
    if (currentState === "SEARCHING_HANDS") {
      if (progress > 0) {
        setGuidance(`Holding hands to chest... ${Math.round(progress * 100)}%`);
      } else {
        setGuidance("Move both hands toward your chest.");
      }
    }
  };

  gestures.onHeartActivated = (chestPosNormalized) => {
    currentState = "HEART_BEATING";
    const pixelX = chestPosNormalized.x * canvasEl.width;
    const pixelY = chestPosNormalized.y * canvasEl.height;

    heart.activate(pixelX, pixelY);
    setGuidance("Bring your hand closer to the heart.");

    // Update direct tap fallback position
    positionDirectTapTrigger(pixelX, pixelY, heart.options.baseRadius * 1.6);
  };

  gestures.onHeartGrabbed = (handPos) => {
    if (currentState !== "REVEALED" && currentState !== "REVEALING") {
      currentState = "HEART_GRABBED";
      heart.setGrabTarget(handPos.x, handPos.y);
      setGuidance("Tap or pinch the heart to open.");
      positionDirectTapTrigger(handPos.x, handPos.y, heart.options.baseRadius * 2);
    }
  };

  gestures.onHeartMove = (handPos) => {
    if (currentState === "HEART_GRABBED") {
      heart.setGrabTarget(handPos.x, handPos.y);
      positionDirectTapTrigger(handPos.x, handPos.y, heart.options.baseRadius * 2);
    }
  };

  gestures.onHeartReleased = () => {
    if (currentState === "HEART_GRABBED") {
      currentState = "HEART_BEATING";
      heart.releaseGrab();
      setGuidance("Bring your hand closer to the heart.");
    }
  };

  gestures.onHeartTapped = () => {
    triggerReveal();
  };

  function positionDirectTapTrigger(x, y, radius) {
    directTapTrigger.style.left = `${x - radius}px`;
    directTapTrigger.style.top = `${y - radius}px`;
    directTapTrigger.style.width = `${radius * 2}px`;
    directTapTrigger.style.height = `${radius * 2}px`;
    directTapTrigger.style.display = "block";
  }

  // Direct canvas touch or click fallback
  directTapTrigger.addEventListener("click", () => {
    if (heart.state === "BEATING" || heart.state === "GRABBED") {
      triggerReveal();
    } else if (anatomy && anatomy.mode === "anatomy") {
      const heartPos = anatomy.getHeartPosition();
      if (heartPos) {
        anatomy.onHeartSelected(heartPos);
      }
    }
  });

  canvasEl.addEventListener("click", (e) => {
    if (anatomy && anatomy.mode === "anatomy" && heart.state === "HIDDEN") {
      const handled = anatomy.handleInteraction(e.clientX, e.clientY);
      if (handled) return;
    }

    if (heart.state === "BEATING" || heart.state === "GRABBED") {
      const hit = heart.getHitArea();
      const dist = Math.hypot(e.clientX - hit.x, e.clientY - hit.y);
      if (dist < hit.radius * 2.2) {
        triggerReveal();
      }
    }
  });

  function triggerReveal() {
    if (currentState === "REVEALING" || currentState === "REVEALED") return;
    currentState = "REVEALING";
    setGuidance("Opening heart...");
    directTapTrigger.style.display = "none";

    heart.startRevealAnimation(() => {
      currentState = "REVEALED";
      guidanceBox.style.display = "none";
      revealModal.classList.add("active");
    });
  }

  // 5. Initialize Camera
  camera = new CameraManager(videoEl);

  camera.onError = (err) => {
    loadingStatus.textContent = err.message;
    setGuidance(err.message);
  };

  camera.onStreamReady = async () => {
    loadingStatus.textContent = "Initializing gesture tracking...";
    try {
      await gestures.init();
      loadingOverlay.style.opacity = "0";
      setTimeout(() => {
        loadingOverlay.style.display = "none";
      }, 500);

      currentState = "SEARCHING_HANDS";
      setGuidance("Move both hands toward your chest.");

      startCVLoop();
    } catch (e) {
      loadingStatus.textContent = "Failed to load gesture engine. You can still tap to open.";
      loadingOverlay.style.opacity = "0";
      setTimeout(() => {
        loadingOverlay.style.display = "none";
      }, 500);
      // Fallback: spawn heart at center
      heart.activate(canvasEl.width / 2, canvasEl.height / 2);
      positionDirectTapTrigger(canvasEl.width / 2, canvasEl.height / 2, 70);
      setGuidance("Tap the glowing heart to open.");
    }
  };

  try {
    loadingStatus.textContent = "Requesting camera access...";
    await camera.start();
  } catch (err) {
    // Camera error already handled by camera.onError
  }

  // 6. Computer Vision Frame Processing & Render Loop
  let lastCvSend = 0;
  const cvIntervalMs = 65; // ~15 FPS for smooth CV inference without overloading CPU

  function startCVLoop() {
    isCvLoopRunning = true;

    function renderLoop(time) {
      // Clear AR canvas once per animation frame
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      // 1. Render Anatomy Layer if X-Ray Scan Mode is active
      if (anatomy && anatomy.mode === "anatomy") {
        anatomy.render(
          gestures.currentPose,
          videoEl,
          gestures.currentHands,
          time
        );
      }

      // 2. Render Heart & particle system (without re-clearing canvas)
      heart.updateAndRender(time, false);

      // Periodically feed frames to MediaPipe
      if (time - lastCvSend > cvIntervalMs && videoEl.readyState >= 2) {
        lastCvSend = time;
        gestures.send(videoEl).then(() => {
          if (heart.state === "BEATING" || heart.state === "GRABBED") {
            const hit = heart.getHitArea();
            gestures.updateInteraction(hit, canvasEl.width, canvasEl.height);
          } else if (anatomy && anatomy.mode === "anatomy" && heart.state === "HIDDEN") {
            // Check hand approach to glowing ecorche heart
            const heartPos = anatomy.getHeartPosition();
            if (heartPos) {
              positionDirectTapTrigger(heartPos.x, heartPos.y, heartPos.radius + 15);
              if (gestures.currentHands && gestures.currentHands.length > 0) {
                for (const hand of gestures.currentHands) {
                  const proj = anatomy.project(hand.indexTip, canvasEl.width, canvasEl.height, videoEl);
                  if (!proj) continue;

                  const dist = Math.hypot(proj.x - heartPos.x, proj.y - heartPos.y);
                  if (dist < heartPos.radius + 50) {
                    setGuidance("Hand near heart! Tap or pinch to awaken.");
                    const pinchPx = hand.pinchDistance * Math.hypot(canvasEl.width, canvasEl.height);
                    if (pinchPx < 50) {
                      anatomy.onHeartSelected(heartPos);
                    }
                    break;
                  }
                }
              }
            }
          }
        });
      }

      if (isCvLoopRunning) {
        requestAnimationFrame(renderLoop);
      }
    }

    requestAnimationFrame(renderLoop);
  }

  // 7. Video Modal Controls
  if (btnPlayVideo) {
    btnPlayVideo.addEventListener("click", () => {
      videoModal.classList.add("active");
      videoPlayer.currentTime = 0;
      videoPlayer.play();
    });
  }

  if (btnCloseVideo) {
    btnCloseVideo.addEventListener("click", () => {
      videoModal.classList.remove("active");
      videoPlayer.pause();
    });
  }

  // 8. Replay Experience
  btnReplay.addEventListener("click", () => {
    revealModal.classList.remove("active");
    guidanceBox.style.display = "flex";
    gestures.reset();
    currentState = "SEARCHING_HANDS";
    setGuidance("Move both hands toward your chest.");
  });
});
