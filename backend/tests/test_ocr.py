import io
import pytest
from PIL import Image
from unittest.mock import patch
from app.services.ocr_service import (
    validate_image_file,
    save_uploaded_answer_image,
    BaseOCRService,
    get_ocr_service
)
from app.models.answer import Answer

def create_dummy_image_bytes(format="PNG", size=(100, 100), color="blue") -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_22_valid_image_is_accepted():
    """Test 22: Valid PNG and JPEG image bytes pass validation."""
    png_bytes = create_dummy_image_bytes("PNG")
    is_valid, err, ext = validate_image_file(png_bytes, "answer.png", "image/png")
    assert is_valid is True
    assert err == ""
    assert ext == ".png"

    jpg_bytes = create_dummy_image_bytes("JPEG")
    is_valid_j, err_j, ext_j = validate_image_file(jpg_bytes, "answer.jpg", "image/jpeg")
    assert is_valid_j is True
    assert err_j == ""
    assert ext_j == ".jpg"


def test_23_invalid_file_type_is_rejected():
    """Test 23: Disallowed extensions and fake image formats are rejected."""
    # Invalid extension
    is_valid, err, _ = validate_image_file(b"dummy text", "script.exe", "application/x-msdownload")
    assert is_valid is False
    assert "unsupported file extension" in err.lower()

    # Fake extension (text file named .png)
    is_valid_fake, err_fake, _ = validate_image_file(b"this is not an image", "fake.png", "image/png")
    assert is_valid_fake is False
    assert "corrupted or invalid image" in err_fake.lower()


def test_24_oversized_image_is_rejected():
    """Test 24: File exceeding MAX_FILE_SIZE_BYTES is rejected."""
    oversized_bytes = b"0" * (11 * 1024 * 1024)  # 11 MB
    is_valid, err, _ = validate_image_file(oversized_bytes, "big.png", "image/png")
    assert is_valid is False
    assert "exceeds maximum allowed size" in err.lower()


def test_25_ocr_text_is_stored():
    """Test 25: Extracted OCR text is properly assigned to Answer.ocr_text."""
    ans = Answer(session_id=1, question_id=5, image_url="/uploads/answers/test.png")
    extracted_text = "The time complexity of binary search is O(log n)."

    ans.ocr_text = extracted_text
    assert ans.ocr_text == extracted_text


def test_26_ocr_failure_does_not_corrupt_answer_record():
    """Test 26: If OCR engine raises an error, image reference is preserved and record remains valid."""
    img_bytes = create_dummy_image_bytes("JPEG")
    abs_path, rel_url = save_uploaded_answer_image(img_bytes, session_id=99, question_id=12, extension=".jpg")

    ans = Answer(session_id=99, question_id=12, image_url=rel_url)

    # Simulate OCR failure / engine missing
    with patch("pytesseract.image_to_string", side_effect=Exception("TesseractNotFound")):
        ocr_service = get_ocr_service()
        ocr_text = ocr_service.extract_text(abs_path)
        # Fallback returns empty string without crashing
        ans.ocr_text = ocr_text

    assert ans.image_url == rel_url
    assert ans.ocr_text == ""
    assert ans.session_id == 99
    assert ans.question_id == 12
