import pytest
import time
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.percentile_service import compute_single_percentile


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def examiner_token(client):
    ts = int(time.time() * 1000)
    email = f"exam_res_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Results Examiner", "role": "examiner"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.fixture
async def student1_token(client):
    ts = int(time.time() * 1000)
    email = f"stu1_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Student One", "role": "student"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.fixture
async def student2_token(client):
    ts = int(time.time() * 1000)
    email = f"stu2_{ts}@example.com"
    pwd = "Password123!"
    reg = await client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Student Two", "role": "student"},
    )
    assert reg.status_code == 201
    login = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    return login.json()["access_token"]


@pytest.mark.asyncio
async def test_01_student_can_fetch_my_results(client, student1_token):
    res = await client.get(
        "/api/results/my-results",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_02_student_cannot_access_examiner_or_admin_apis(client, student1_token):
    # Examiner endpoint
    ex_res = await client.get(
        "/api/examiner/dashboard-stats",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert ex_res.status_code == 403

    # Admin endpoint
    adm_res = await client.get(
        "/api/admin/stats",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert adm_res.status_code == 403


@pytest.mark.asyncio
async def test_03_full_exam_submission_results_and_privacy_flow(client, examiner_token, student1_token, student2_token):
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(minutes=5)
    end_time = now + timedelta(hours=2)

    # 1. Examiner creates MCQ question
    q_res = await client.post(
        "/api/questions",
        headers={"Authorization": f"Bearer {examiner_token}"},
        json={
            "subject": "Computer Networks",
            "question_text": "What is the standard port for HTTPS?",
            "question_type": "MCQ",
            "difficulty": "EASY",
            "marks": 5.0,
            "negative_marks": 1.0,
            "options": [
                {"option_text": "443", "is_correct": True},
                {"option_text": "80", "is_correct": False},
                {"option_text": "22", "is_correct": False},
            ],
        },
    )
    assert q_res.status_code == 201
    q_data = q_res.json()
    q_id = q_data["id"]
    correct_opt_id = [opt["id"] for opt in q_data["options"] if opt["is_correct"]][0]

    # 2. Examiner creates exam
    exam_res = await client.post(
        "/api/exams",
        headers={"Authorization": f"Bearer {examiner_token}"},
        json={
            "title": "Networks Midterm",
            "subject": "Computer Networks",
            "duration": 30,
            "question_count": 1,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "question_ids": [q_id],
        },
    )
    assert exam_res.status_code == 201
    exam_id = exam_res.json()["id"]

    # 3. Student 1 enters and takes exam
    tok_res = await client.post(
        f"/api/exams/{exam_id}/token",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert tok_res.status_code == 200
    access_tok = tok_res.json()["access_token"]

    enter_res = await client.post(
        "/api/exam-sessions/enter",
        headers={"Authorization": f"Bearer {student1_token}"},
        json={"exam_id": exam_id, "exam_token": access_tok}
    )
    assert enter_res.status_code == 200
    s1_session_id = enter_res.json()["id"]

    # Student 1 submits correct answer
    ans_res = await client.post(
        f"/api/exam-sessions/{s1_session_id}/answers",
        headers={"Authorization": f"Bearer {student1_token}"},
        json={"question_id": q_id, "selected_option_ids": [correct_opt_id]}
    )
    assert ans_res.status_code == 200

    # Student 1 finishes exam
    sub_res = await client.post(
        f"/api/exam-sessions/{s1_session_id}/submit",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert sub_res.status_code == 200

    # 4. Student 1 views result details (before publishing)
    res_detail = await client.get(
        f"/api/results/session/{s1_session_id}",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert res_detail.status_code == 200
    r_data = res_detail.json()
    assert r_data["total_score"] == 5.0
    assert r_data["percentile"] == 100.0  # Single candidate initially returns 100.0%
    assert r_data["published"] is False

    # Solution review security: When published is False, student cannot see correct options
    for q_rev in r_data["question_reviews"]:
        assert q_rev["correct_option_ids"] is None
        assert q_rev["model_answer"] is None

    # 5. Student 2 cannot access Student 1's results (returns 403)
    p_viol = await client.get(
        f"/api/results/session/{s1_session_id}",
        headers={"Authorization": f"Bearer {student2_token}"}
    )
    assert p_viol.status_code == 403

    # 6. Examiner publishes the result
    result_id = r_data["id"]
    pub_res = await client.put(
        f"/api/results/{result_id}/publish",
        headers={"Authorization": f"Bearer {examiner_token}"},
        json={"published": True}
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["published"] is True

    # 7. Student 1 views published result: now solutions and options are exposed
    pub_detail = await client.get(
        f"/api/results/session/{s1_session_id}",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert pub_detail.status_code == 200
    pub_data = pub_detail.json()
    assert pub_data["published"] is True
    assert pub_data["question_reviews"][0]["correct_option_ids"] == [correct_opt_id]


@pytest.mark.asyncio
async def test_04_percentile_calculation_rules():
    # Test single candidate returns 100.0%
    assert compute_single_percentile(85.0, [85.0]) == 100.0

    # Test distinct distribution: [40, 60, 80, 100]
    # Score 40: 1/4 = 25.0%
    # Score 60: 2/4 = 50.0%
    # Score 80: 3/4 = 75.0%
    # Score 100: 4/4 = 100.0%
    scores = [40.0, 60.0, 80.0, 100.0]
    assert compute_single_percentile(40.0, scores) == 25.0
    assert compute_single_percentile(60.0, scores) == 50.0
    assert compute_single_percentile(80.0, scores) == 75.0
    assert compute_single_percentile(100.0, scores) == 100.0

    # Test ties: [50, 50, 80, 90]
    # Score 50: 2/4 = 50.0%
    tie_scores = [50.0, 50.0, 80.0, 90.0]
    assert compute_single_percentile(50.0, tie_scores) == 50.0
