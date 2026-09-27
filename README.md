# HeartDrop 🫀✨

> *"Something is waiting inside your heart."*

HeartDrop is a playful, intimate AR-style digital surprise web application. A sender encapsulates a photo, optional video, and a personal message into a private beating heart. When the recipient opens the link and places both hands over their chest, browser-based computer vision detects the gesture, breathes life into a glowing heart, lets them reach out and grab it, and reveals the secret memory with radiant particles.

---

## 🌟 Demo Flow

1. **Sender Creates a Surprise**:
   - Uploads an image (JPG, PNG, WEBP up to 10 MB).
   - Optionally attaches a video (MP4, WEBM up to 50 MB).
   - Writes a personal heartfelt message.
   - Generates a cryptographically secure random link: `/h/<share_code>`.

2. **Receiver Opens the Experience**:
   - Opens `/h/<share_code>` on their desktop or mobile browser.
   - Grants local camera access (frames are processed 100% locally in-browser).
   - Places both hands near their chest for ~500ms.
   - A glowing, pulsing heart appears over their sternum with a realistic cardiac rhythm and subtle heartbeat audio.
   - Moving a hand toward the heart allows grabbing it with organic spring physics.
   - Tapping or pinching the heart splits it open into a burst of sparkling embers, revealing the sender's photo, personal message, and optional video.

---

## 🚀 Features

- **Local Computer Vision**: Uses Google MediaPipe Pose and MediaPipe Hands in pure client-side JavaScript. No video frames or camera streams ever touch the backend.
- **Chest Proximity Detection**: Detects left/right shoulders to calculate true anatomical chest center and scale-invariant proximity zones. Debounced for ~500ms to prevent accidental triggers.
- **Realistic Cardiac Simulation**: Dual-beat cardiac rhythm (scale `1.0` &rarr; `1.12` &rarr; `1.0` &rarr; `1.06` &rarr; `1.0`), blooming radial halo, floating embers, and synthetic low-frequency heartbeat audio via the Web Audio API.
- **Organic Spring Physics**: Grabbing the heart smoothly tracks hand position with spring tension and velocity damping.
- **Dramatic Particle Burst**: Splitting heart animation with glowing multi-phase particles and smooth modal emergence.
- **Privacy & Security First**:
  - Secure random tokens (`secrets.token_urlsafe(8)`).
  - No database sequential IDs exposed to the frontend.
  - Comprehensive server-side file integrity validation (PIL verification, MIME checking, size bounds, safe UUID renaming).
  - SQLite backend with optional expiration timestamps.
- **X-Ray Anatomy Mode**: Optional real-time AR internal body visualization overlay with selectable layers:
  - 🦴 **Skeleton**: Glowing bone structures (skull, spine, ribcage, clavicles, arms, pelvis, and legs) with lerp smoothing.
  - 💪 **Muscles**: Stylized major muscle groups (deltoids, pectorals, biceps, forearms, 6-pack abs, quads, calves).
  - 🫀 **Organs**: Anatomical organs (brain, lungs, liver, stomach, kidneys) and a continuously beating, prominent glowing heart with hand hover interaction.
  - 🩸 **Veins**: Arterial and venous vascular circulatory tree with rhythmic pulse animations.
  - ✨ **Full Body**: Integrated composite with body segmentation silhouette.
  - **Organ Hand Interaction**: Moving hand toward the heart highlights it and allows direct grabbing/tapping to launch the HeartDrop surprise reveal!
- **Accessible Progressive Enhancement**: In addition to AR hand tracking, interactive tap indicators allow full accessibility on touchscreens and devices without full body tracking.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Vanilla CSS3 (Custom Dark Romantic Theme), Modern Vanilla JavaScript (ES6+), Canvas API, Web Audio API |
| **Computer Vision** | Google MediaPipe Pose (`@mediapipe/pose`), Google MediaPipe Hands (`@mediapipe/hands`), Person Segmentation |
| **Backend** | Python 3.10+, Flask, SQLite3, Pillow (PIL), Werkzeug |
| **Architecture** | Client-side inference, RESTful API, Zero heavy JS framework dependencies |

---

## 📐 Project Architecture

```
HeartDrop/
├── app.py                     # Flask backend, routing, security & upload controls
├── requirements.txt           # Python dependencies (Flask, Pillow)
├── test_app.py                # Automated integration & unit tests
├── sample_heart.png           # Verification graphic asset
├── README.md                  # Complete project documentation
├── .gitignore                 # Environment & upload ignore rules
├── database/
│   └── heartdrop.db           # SQLite database for storing heart metadata
├── uploads/                   # Secure storage for uploaded images & videos
├── templates/
│   ├── index.html             # Cinematic landing page
│   ├── create.html            # Surprise creator page (dropzone & previews)
│   ├── share.html             # "Your Heart Is Ready" link distribution page
│   ├── experience.html        # Fullscreen AR camera + MediaPipe experience
│   └── reveal.html            # Direct view / fallback reveal page
├── static/
│   ├── css/
│   │   └── style.css          # Romantic, dark, minimal aesthetic styling
│   └── js/
│       ├── camera.js          # Webcam lifecycle & permission manager
│       ├── segmentation.js    # Body silhouette segmentation mask renderer
│       ├── skeleton.js        # Stylized glowing X-ray bone renderer
│       ├── muscles.js         # Anatomical muscle groups renderer
│       ├── organs.js          # Beating heart & internal organs renderer
│       ├── veins.js           # Pulsating circulatory network renderer
│       ├── anatomy.js         # Anatomy mode manager & layer compositor
│       ├── gestures.js        # MediaPipe Pose & Hands calculation engine
│       ├── heart.js           # Canvas heart renderer, physics, & audio synth
│       └── experience.js      # State machine & experience orchestrator
└── utils/
    └── database.py            # SQLite helper methods & schema setup
```

---

## 🖐️ Gesture Detection System

The computer vision engine coordinates two models in parallel:

1. **Chest Center Calculation**:
   - Shoulder landmarks: Left Shoulder (`11`), Right Shoulder (`12`).
   - $\text{Span} = \sqrt{(x_{rs} - x_{ls})^2 + (y_{rs} - y_{ls})^2}$
   - $\text{Chest}_x = \frac{x_{ls} + x_{rs}}{2}$
   - $\text{Chest}_y = \frac{y_{ls} + y_{rs}}{2} + 0.32 \times \text{Span}$
2. **Two-Hand Proximity Check**:
   - Left Wrist (`15`) and Right Wrist (`16`).
   - If $\text{Distance}(\text{Wrist}_L, \text{Chest}) < 0.70 \times \text{Span}$ and $\text{Distance}(\text{Wrist}_R, \text{Chest}) < 0.70 \times \text{Span}$ continuously for $\ge 500\text{ ms}$, the heart awakens.
3. **Hand Grabbing**:
   - Index Fingertip (`8`) and Palm Knuckle (`9`) proximity to Heart $< 85\text{ px}$.
4. **Pinch / Tap Interaction**:
   - Distance between Index Tip (`8`) and Thumb Tip (`4`) $< 45\text{ px}$ triggers the particle burst and reveal.

---

## 🔒 Privacy & Security

- **Zero Camera Data Transmission**: Video frames remain in device RAM and are never uploaded, logged, or serialized.
- **Cryptographic Identifiers**: Share links use unguessable random tokens.
- **Upload Hardening**: File contents are validated through byte-level inspection and Pillow verification, saved to sanitized filenames with random UUIDs.

---

## 💻 Installation & Quickstart

### Prerequisites
- Python 3.10+ installed on your system.
- A modern web browser with webcam access (Chrome, Edge, Firefox, Safari).

### Setup

1. **Clone or Navigate to the Repository**:
   ```bash
   cd HeartDrop
   ```

2. **Create and Activate a Virtual Environment**:
   - On Windows:
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run Unit & Integration Tests**:
   ```bash
   python test_app.py
   ```

5. **Start the HeartDrop Server**:
   ```bash
   python app.py
   ```

6. **Open in Browser**:
   Navigate to `http://127.0.0.1:5000` in your web browser.

---

## 🔮 Future Improvements

- Custom heart skin personalization (colors, floral accents, custom sound pulses).
- WebGL / Three.js 3D dimensional heart mode.
- Progressive Web App (PWA) offline installation.
- Self-destructing secret links after first reveal.
