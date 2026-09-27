import io
from PIL import Image
from app import app
from utils.database import get_heart_by_share_code

def create_test_image():
    file = io.BytesIO()
    image = Image.new('RGB', (100, 100), color=(255, 0, 80))
    image.save(file, 'PNG')
    file.seek(0)
    return file

def run_tests():
    client = app.test_client()

    print("1. Testing GET / ...")
    res = client.get("/")
    assert res.status_code == 200
    assert b"Something is waiting inside your heart." in res.data
    print("   [OK] Passed")

    print("2. Testing GET /create ...")
    res = client.get("/create")
    assert res.status_code == 200
    assert b"Seal a Surprise" in res.data
    print("   [OK] Passed")

    print("3. Testing POST /create with valid payload ...")
    img_data = create_test_image()
    res = client.post(
        "/create",
        data={
            "image": (img_data, "test_heart.png"),
            "message": "You make every beat count."
        },
        content_type="multipart/form-data",
        follow_redirects=False
    )
    assert res.status_code == 302
    redirect_url = res.headers["Location"]
    assert "/share/" in redirect_url
    share_code = redirect_url.split("/share/")[1]
    print(f"   [OK] Passed. Share code generated: {share_code}")

    print("4. Testing GET /share/<share_code> ...")
    res = client.get(f"/share/{share_code}")
    assert res.status_code == 200
    assert b"Your Heart Is Ready" in res.data
    assert share_code.encode() in res.data
    print("   [OK] Passed")

    print("5. Testing GET /h/<share_code> (Experience Page) ...")
    res = client.get(f"/h/{share_code}")
    assert res.status_code == 200
    assert b"camera-video" in res.data
    assert b"ar-canvas" in res.data
    assert share_code.encode() in res.data
    print("   [OK] Passed")

    print("6. Testing GET /reveal/<share_code> (Reveal Page) ...")
    res = client.get(f"/reveal/{share_code}")
    assert res.status_code == 200
    assert b"You make every beat count." in res.data
    print("   [OK] Passed")

    print("7. Testing GET /api/heart/<share_code> ...")
    res = client.get(f"/api/heart/{share_code}")
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["share_code"] == share_code
    assert json_data["message"] == "You make every beat count."
    assert "image_url" in json_data
    assert "id" not in json_data  # ID is NOT exposed!
    print("   [OK] Passed. API output verified without exposing internal IDs.")

    print("8. Testing validation on invalid file upload ...")
    invalid_file = io.BytesIO(b"malicious script")
    res = client.post(
        "/create",
        data={
            "image": (invalid_file, "script.exe"),
            "message": "Invalid"
        },
        content_type="multipart/form-data",
        follow_redirects=True
    )
    assert b"Invalid image format" in res.data
    print("   [OK] Passed. Malicious extensions blocked.")

    print("\nALL BACKEND UNIT TESTS PASSED!")

if __name__ == "__main__":
    run_tests()
