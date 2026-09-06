import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import jwt, JWTError
from app.config import settings

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    # Enforce 72-byte max for bcrypt compatibility
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Generate JWT access token containing subject, role, and expiry."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
    })
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid or expired token: {e}")

def create_exam_access_token(
    student_id: int,
    exam_id: int,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Generate a secure, single-student exam access token bound to exam_id."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=4))
    token_data = {
        "sub": str(student_id),
        "exam_id": exam_id,
        "token_type": "exam_access",
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(
        token_data,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

def decode_exam_access_token(token: str) -> dict[str, Any]:
    """Validate and decode secure exam access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("token_type") != "exam_access":
            raise ValueError("Token is not a valid exam access token")
        if "exam_id" not in payload or "sub" not in payload:
            raise ValueError("Malformed exam access token")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid or expired exam token: {e}")

