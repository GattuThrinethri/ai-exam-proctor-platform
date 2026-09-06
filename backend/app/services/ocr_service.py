import os
import uuid
import logging
from pathlib import Path
from typing import Tuple, Optional
from PIL import Image, UnidentifiedImageError
from app.config import settings

logger = logging.getLogger("ocr_service")

# Allowed image configuration
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

class BaseOCRService:
    def extract_text(self, file_path: str) -> str:
        raise NotImplementedError

class TesseractOCRService(BaseOCRService):
    def extract_text(self, file_path: str) -> str:
        """
        Extract text using Tesseract OCR if available on the system.
        If tesseract executable is not installed or accessible, falls back gracefully.
        """
        try:
            import pytesseract
            # Verify file exists
            if not os.path.exists(file_path):
                logger.error(f"Image file not found for OCR: {file_path}")
                return ""
            
            with Image.open(file_path) as img:
                # Preprocess: convert to RGB / grayscale for better OCR
                grayscale = img.convert("L")
                text = pytesseract.image_to_string(grayscale)
                return text.strip()
        except (ImportError, Exception) as exc:
            # Handles pytesseract.TesseractNotFoundError, FileNotFoundError, etc.
            logger.warning(
                f"Tesseract OCR engine unavailable or failed ({type(exc).__name__}: {exc}). "
                "Image preserved for manual examiner grading."
            )
            return ""

class FallbackOCRService(BaseOCRService):
    def extract_text(self, file_path: str) -> str:
        logger.info(f"Fallback OCR: Tesseract not configured. Image preserved at {file_path}")
        return ""

def get_ocr_service() -> BaseOCRService:
    if settings.OCR_PROVIDER.lower() == "tesseract":
        return TesseractOCRService()
    return FallbackOCRService()

def validate_image_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[bool, str, str]:
    """
    Validates file extension, MIME type, size, and genuine image integrity with PIL.
    Returns: (is_valid: bool, error_message: str, normalized_extension: str)
    """
    # 1. Size check
    if len(file_bytes) == 0:
        return False, "File is empty", ""
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        return False, f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB", ""

    # 2. Extension check
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}", ""

    # 3. MIME type check if provided
    if content_type and content_type.lower() not in ALLOWED_MIME_TYPES:
        return False, f"Unsupported MIME type '{content_type}'. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}", ""

    # 4. Content verification with PIL to prevent spoofing
    import io
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()
            fmt = (img.format or "").upper()
            if fmt not in ("JPEG", "PNG", "WEBP"):
                return False, f"Invalid image format detected: {fmt}", ""
    except (UnidentifiedImageError, Exception) as e:
        return False, f"Corrupted or invalid image file: {str(e)}", ""

    return True, "", ext

def save_uploaded_answer_image(
    file_bytes: bytes,
    session_id: int,
    question_id: int,
    extension: str
) -> Tuple[str, str]:
    """
    Saves image under settings.UPLOAD_DIR/answers/ with safe unique filename.
    Returns: (absolute_file_path, relative_url_path)
    """
    upload_base = Path(settings.UPLOAD_DIR).resolve()
    answers_dir = upload_base / "answers"
    answers_dir.mkdir(parents=True, exist_ok=True)

    # Generate safe random filename to prevent collisions and directory traversal
    safe_name = f"sess_{session_id}_q_{question_id}_{uuid.uuid4().hex[:12]}{extension}"
    target_path = answers_dir / safe_name

    # Write file securely
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    relative_url = f"/uploads/answers/{safe_name}"
    return str(target_path), relative_url
