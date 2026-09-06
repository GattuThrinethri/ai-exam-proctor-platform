import pytest
import time
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def examiner_token(client):
    ts = int(time.time() * 1000)
    email = f"exam_admin_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Exam Admin", "role": "examiner"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.fixture
async def student_token(client):
    ts = int(time.time() * 1000)
    email = f"exam_stu_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Exam Student", "role": "student"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_01_examiner_can_get_dashboard_stats(client, examiner_token):
    res = await client.get(
        "/api/examiner/dashboard-stats",
        headers={"Authorization": f"Bearer {examiner_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_questions" in data
    assert "total_exams" in data
    assert "active_exams" in data
    assert "completed_exams" in data
    assert "pending_evaluations" in data
    assert "flagged_sessions" in data
    assert isinstance(data["total_questions"], int)
    assert isinstance(data["total_exams"], int)


@pytest.mark.asyncio
async def test_02_student_cannot_access_dashboard_stats(client, student_token):
    res = await client.get(
        "/api/examiner/dashboard-stats",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert res.status_code == 403
    assert "Access forbidden" in res.json().get("detail", "") or "Forbidden" in res.text


@pytest.mark.asyncio
async def test_03_examiner_can_list_results(client, examiner_token):
    res = await client.get(
        "/api/examiner/results",
        headers={"Authorization": f"Bearer {examiner_token}"}
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_04_student_cannot_list_results(client, student_token):
    res = await client.get(
        "/api/examiner/results",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_05_examiner_can_list_proctoring_sessions(client, examiner_token):
    res = await client.get(
        "/api/examiner/proctoring-sessions",
        headers={"Authorization": f"Bearer {examiner_token}"}
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_06_student_cannot_list_proctoring_sessions(client, student_token):
    res = await client.get(
        "/api/examiner/proctoring-sessions",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_07_unauthenticated_cannot_access_examiner_endpoints(client):
    r1 = await client.get("/api/examiner/dashboard-stats")
    assert r1.status_code == 401

    r2 = await client.get("/api/examiner/results")
    assert r2.status_code == 401

    r3 = await client.get("/api/examiner/proctoring-sessions")
    assert r3.status_code == 401
