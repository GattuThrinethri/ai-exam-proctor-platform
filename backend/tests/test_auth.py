import pytest
import uuid
from httpx import AsyncClient
from app.auth.security import decode_access_token

@pytest.mark.asyncio
async def test_01_successful_registration(client: AsyncClient):
    """Test successful student registration."""
    unique_email = f"new_student_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Test Student",
        "email": unique_email,
        "password": "Password@123",
        "role": "student"
    }
    response = await client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == unique_email
    assert data["name"] == "Test Student"
    assert data["role"] == "student"
    assert data["is_active"] is True
    assert "id" in data
    # Verify password_hash is never returned
    assert "password_hash" not in data
    assert "password" not in data

@pytest.mark.asyncio
async def test_02_duplicate_email_rejection(client: AsyncClient):
    """Test that registering with an already existing email returns 400 Bad Request."""
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "User 1",
        "email": email,
        "password": "Password@123",
        "role": "student"
    }
    # First registration
    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    # Second registration with same email
    r2 = await client.post("/api/auth/register", json=payload)
    assert r2.status_code == 400
    assert "already exists" in r2.json()["detail"].lower()

@pytest.mark.asyncio
async def test_03_successful_login(client: AsyncClient):
    """Test successful login returns access_token and user info."""
    login_payload = {
        "email": "student@example.com",
        "password": "Student@123"
    }
    response = await client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "student"
    assert data["user"]["email"] == "student@example.com"
    # Verify password_hash is not returned in user payload
    assert "password_hash" not in data["user"]
    assert "password" not in data["user"]

@pytest.mark.asyncio
async def test_04_invalid_password_rejection(client: AsyncClient):
    """Test that incorrect credentials return 401 Unauthorized."""
    login_payload = {
        "email": "student@example.com",
        "password": "WrongPassword123"
    }
    response = await client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_05_jwt_validation(client: AsyncClient):
    """Test that generated JWT can be decoded and contains required claims."""
    login_payload = {
        "email": "admin@example.com",
        "password": "Admin@123"
    }
    res = await client.post("/api/auth/login", json=login_payload)
    token = res.json()["access_token"]

    payload = decode_access_token(token)
    assert "sub" in payload
    assert payload["role"] == "admin"
    assert "exp" in payload
    assert "iat" in payload

    # Test invalid token returns 401
    bad_headers = {"Authorization": "Bearer invalid.token.string"}
    res_bad = await client.get("/api/auth/me", headers=bad_headers)
    assert res_bad.status_code == 401

@pytest.mark.asyncio
async def test_06_get_current_user_me(client: AsyncClient):
    """Test /api/auth/me retrieves current authenticated user profile."""
    # Login as examiner
    login_res = await client.post("/api/auth/login", json={
        "email": "examiner@example.com",
        "password": "Examiner@123"
    })
    token = login_res.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "examiner@example.com"
    assert me_data["role"] == "examiner"
    assert "password_hash" not in me_data

@pytest.mark.asyncio
async def test_07_student_role_authorization(client: AsyncClient):
    """Test student can access student routes but is blocked from examiner/admin routes."""
    # Login as student
    login_res = await client.post("/api/auth/login", json={
        "email": "student@example.com",
        "password": "Student@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Access student route -> 200 OK
    res_student = await client.get("/api/auth/test-student", headers=headers)
    assert res_student.status_code == 200

    # Access examiner route -> 403 Forbidden
    res_examiner = await client.get("/api/auth/test-examiner", headers=headers)
    assert res_examiner.status_code == 403

    # Access admin route -> 403 Forbidden
    res_admin = await client.get("/api/auth/test-admin", headers=headers)
    assert res_admin.status_code == 403

@pytest.mark.asyncio
async def test_08_examiner_role_authorization(client: AsyncClient):
    """Test examiner can access examiner route but cannot access admin route."""
    login_res = await client.post("/api/auth/login", json={
        "email": "examiner@example.com",
        "password": "Examiner@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Access examiner route -> 200 OK
    res_examiner = await client.get("/api/auth/test-examiner", headers=headers)
    assert res_examiner.status_code == 200

    # Access admin route -> 403 Forbidden
    res_admin = await client.get("/api/auth/test-admin", headers=headers)
    assert res_admin.status_code == 403

@pytest.mark.asyncio
async def test_09_admin_role_authorization(client: AsyncClient):
    """Test admin can access admin route."""
    login_res = await client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "Admin@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_admin = await client.get("/api/auth/test-admin", headers=headers)
    assert res_admin.status_code == 200
    assert res_admin.json()["role"] == "admin"

@pytest.mark.asyncio
async def test_10_password_hash_never_exposed(client: AsyncClient):
    """Verify password_hash is never exposed in register, login, or me endpoints."""
    # Register
    reg = await client.post("/api/auth/register", json={
        "name": "Secret Test",
        "email": f"secret_{uuid.uuid4().hex[:6]}@example.com",
        "password": "SecretPassword@123",
        "role": "student"
    })
    assert "password_hash" not in reg.text
    assert "SecretPassword@123" not in reg.text

    # Login
    log = await client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "Admin@123"
    })
    assert "password_hash" not in log.text
    assert "Admin@123" not in log.text

    # Me
    token = log.json()["access_token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert "password_hash" not in me.text
