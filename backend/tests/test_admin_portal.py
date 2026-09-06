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
async def admin_token(client):
    ts = int(time.time() * 1000)
    email = f"platform_adm_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Super Admin", "role": "admin"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"], email


@pytest.fixture
async def examiner_token(client):
    ts = int(time.time() * 1000)
    email = f"adm_test_ex_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Tester Examiner", "role": "examiner"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.fixture
async def student_token(client):
    ts = int(time.time() * 1000)
    email = f"adm_test_stu_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Tester Student", "role": "student"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_01_admin_stats_retrieval(client, admin_token):
    tok, _ = admin_token
    res = await client.get(
        "/api/admin/stats",
        headers={"Authorization": f"Bearer {tok}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "total_students" in data
    assert "total_examiners" in data
    assert "total_admins" in data
    assert "total_exams" in data
    assert "active_exams" in data
    assert "total_sessions" in data
    assert "completed_sessions" in data
    assert "flagged_sessions" in data
    assert "average_score" in data


@pytest.mark.asyncio
async def test_02_admin_can_list_users_with_filters(client, admin_token):
    tok, _ = admin_token
    res = await client.get(
        "/api/admin/users?role=student",
        headers={"Authorization": f"Bearer {tok}"}
    )
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    for u in users:
        assert u["role"] == "student"


@pytest.mark.asyncio
async def test_03_admin_user_provisioning_and_role_lifecycle(client, admin_token):
    tok, admin_email = admin_token
    ts = int(time.time() * 1000)
    new_email = f"prov_{ts}@example.com"

    # 1. Admin creates user
    create_res = await client.post(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "name": "Provisioned User",
            "email": new_email,
            "password": "Password123!",
            "role": "student"
        }
    )
    assert create_res.status_code == 201
    created = create_res.json()
    user_id = created["id"]
    assert created["role"] == "student"

    # 2. Admin promotes user to examiner
    role_res = await client.put(
        f"/api/admin/users/{user_id}/role",
        headers={"Authorization": f"Bearer {tok}"},
        json={"role": "examiner"}
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "examiner"

    # 3. Admin toggles status to inactive
    status_res = await client.put(
        f"/api/admin/users/{user_id}/status",
        headers={"Authorization": f"Bearer {tok}"},
        json={"is_active": False}
    )
    assert status_res.status_code == 200
    assert status_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_04_last_admin_protection_enforcement(client, admin_token):
    tok, _ = admin_token

    # Find the current admin user's ID
    users_res = await client.get(
        "/api/admin/users?role=admin",
        headers={"Authorization": f"Bearer {tok}"}
    )
    assert users_res.status_code == 200
    admins = users_res.json()

    # If there is only 1 active admin, test that demoting or deactivating fails with 400
    if len(admins) == 1:
        target_admin_id = admins[0]["id"]

        # Attempt demoting last admin
        demote_res = await client.put(
            f"/api/admin/users/{target_admin_id}/role",
            headers={"Authorization": f"Bearer {tok}"},
            json={"role": "examiner"}
        )
        assert demote_res.status_code == 400
        assert "Cannot demote the last active administrator" in demote_res.json()["detail"]

        # Attempt deactivating last admin
        deactivate_res = await client.put(
            f"/api/admin/users/{target_admin_id}/status",
            headers={"Authorization": f"Bearer {tok}"},
            json={"is_active": False}
        )
        assert deactivate_res.status_code == 400
        assert "Cannot deactivate the last active administrator" in deactivate_res.json()["detail"]


@pytest.mark.asyncio
async def test_05_admin_can_list_global_exams_and_audit_logs(client, admin_token):
    tok, _ = admin_token

    # Global exams oversight
    exams_res = await client.get(
        "/api/admin/exams",
        headers={"Authorization": f"Bearer {tok}"}
    )
    assert exams_res.status_code == 200
    assert isinstance(exams_res.json(), list)

    # Audit logs
    audit_res = await client.get(
        "/api/admin/audit-logs",
        headers={"Authorization": f"Bearer {tok}"}
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert isinstance(logs, list)


@pytest.mark.asyncio
async def test_06_unauthorized_users_cannot_access_admin_portal(client, student_token, examiner_token):
    # Student cannot access admin
    stu_res = await client.get(
        "/api/admin/stats",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert stu_res.status_code == 403

    # Examiner cannot access admin
    ex_res = await client.get(
        "/api/admin/stats",
        headers={"Authorization": f"Bearer {examiner_token}"}
    )
    assert ex_res.status_code == 403
