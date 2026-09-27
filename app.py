import os
import secrets
import uuid
from pathlib import Path
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    jsonify,
    send_from_directory,
    abort,
    flash,
)
from werkzeug.utils import secure_filename
from PIL import Image

from utils.database import init_db, create_heart, get_heart_by_share_code

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))

# Limits: overall request up to 65MB
app.config["MAX_CONTENT_LENGTH"] = 65 * 1024 * 1024

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "webm"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024   # 50 MB

# Initialize database
init_db()

def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""

def is_valid_image(file_storage) -> bool:
    try:
        # Check PIL readability
        img = Image.open(file_storage.stream)
        img.verify()
        file_storage.stream.seek(0)
        return True
    except Exception:
        file_storage.stream.seek(0)
        return False

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/create", methods=["GET", "POST"])
def create():
    if request.method == "GET":
        return render_template("create.html")

    # POST handling
    message = request.form.get("message", "").strip()
    if not message:
        flash("Please enter a heartfelt personal message.", "error")
        return redirect(url_for("create"))

    if len(message) > 1000:
        flash("Message must be under 1000 characters.", "error")
        return redirect(url_for("create"))

    # Image validation
    if "image" not in request.files or not request.files["image"].filename:
        flash("Please upload an image.", "error")
        return redirect(url_for("create"))

    image_file = request.files["image"]
    image_ext = get_file_extension(image_file.filename)
    if image_ext not in ALLOWED_IMAGE_EXTENSIONS:
        flash("Invalid image format. Allowed: JPG, PNG, WEBP.", "error")
        return redirect(url_for("create"))

    # Check image size
    image_file.seek(0, os.SEEK_END)
    img_size = image_file.tell()
    image_file.seek(0)
    if img_size > MAX_IMAGE_SIZE:
        flash("Image exceeds maximum size of 10 MB.", "error")
        return redirect(url_for("create"))

    if not is_valid_image(image_file):
        flash("Uploaded image is corrupted or invalid.", "error")
        return redirect(url_for("create"))

    # Save image with secure unique name
    image_filename = f"img_{uuid.uuid4().hex}.{image_ext}"
    image_dest = UPLOAD_DIR / image_filename
    image_file.save(str(image_dest))

    # Optional video validation
    video_filename = None
    if "video" in request.files and request.files["video"].filename:
        video_file = request.files["video"]
        video_ext = get_file_extension(video_file.filename)
        if video_ext not in ALLOWED_VIDEO_EXTENSIONS:
            # Clean up saved image
            if image_dest.exists():
                image_dest.unlink()
            flash("Invalid video format. Allowed: MP4, WEBM.", "error")
            return redirect(url_for("create"))

        video_file.seek(0, os.SEEK_END)
        vid_size = video_file.tell()
        video_file.seek(0)
        if vid_size > MAX_VIDEO_SIZE:
            if image_dest.exists():
                image_dest.unlink()
            flash("Video exceeds maximum size of 50 MB.", "error")
            return redirect(url_for("create"))

        video_filename = f"vid_{uuid.uuid4().hex}.{video_ext}"
        video_dest = UPLOAD_DIR / video_filename
        video_file.save(str(video_dest))

    # Generate cryptographically secure random share code (e.g. 10 chars urlsafe)
    share_code = secrets.token_urlsafe(8)

    # Save to database
    create_heart(
        share_code=share_code,
        image_path=image_filename,
        video_path=video_filename,
        message=message
    )

    return redirect(url_for("share_confirmation", share_code=share_code))

@app.route("/share/<share_code>")
def share_confirmation(share_code):
    heart = get_heart_by_share_code(share_code)
    if not heart:
        abort(404)
    experience_url = url_for("experience", share_code=share_code, _external=True)
    return render_template(
        "share.html",
        share_code=share_code,
        experience_url=experience_url
    )

@app.route("/h/<share_code>")
def experience(share_code):
    heart = get_heart_by_share_code(share_code)
    if not heart:
        abort(404)
    return render_template("experience.html", share_code=share_code)

@app.route("/reveal/<share_code>")
def reveal_direct(share_code):
    heart = get_heart_by_share_code(share_code)
    if not heart:
        abort(404)
    return render_template(
        "reveal.html",
        share_code=share_code,
        image_url=url_for("uploaded_file", filename=heart["image_path"]),
        video_url=url_for("uploaded_file", filename=heart["video_path"]) if heart["video_path"] else None,
        message=heart["message"]
    )

@app.route("/api/heart/<share_code>")
def api_heart(share_code):
    heart = get_heart_by_share_code(share_code)
    if not heart:
        return jsonify({"error": "Heart not found"}), 404

    # Never expose internal database id
    return jsonify({
        "share_code": heart["share_code"],
        "image_url": url_for("uploaded_file", filename=heart["image_path"]),
        "video_url": url_for("uploaded_file", filename=heart["video_path"]) if heart["video_path"] else None,
        "message": heart["message"],
        "created_at": heart["created_at"]
    })

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    # Only serve safe filenames from UPLOAD_DIR
    filename = secure_filename(filename)
    return send_from_directory(str(UPLOAD_DIR), filename)

@app.errorhandler(404)
def page_not_found(e):
    return render_template("index.html", error="The requested heart does not exist or has expired."), 404

@app.errorhandler(413)
def request_entity_too_large(e):
    flash("Uploaded file is too large. Maximum image: 10MB, video: 50MB.", "error")
    return redirect(url_for("create"))

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
