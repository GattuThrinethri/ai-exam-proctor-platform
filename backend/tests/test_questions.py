import pytest
import uuid
from httpx import AsyncClient

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    """Helper to log in and return authorization headers."""
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_01_examiner_can_create_mcq(client: AsyncClient):
    """Test examiner creating a valid MCQ question."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Which normal form deals with multi-valued dependency?",
        "question_type": "MCQ",
        "difficulty": "medium",
        "marks": 2.0,
        "negative_marks": 0.5,
        "model_answer": "4NF deals with multi-valued dependencies.",
        "options": [
            {"option_text": "1NF", "is_correct": False},
            {"option_text": "2NF", "is_correct": False},
            {"option_text": "3NF", "is_correct": False},
            {"option_text": "4NF", "is_correct": True},
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["subject"] == "DBMS"
    assert data["question_type"] == "MCQ"
    assert len(data["options"]) == 4
    assert any(opt["is_correct"] for opt in data["options"])

@pytest.mark.asyncio
async def test_02_examiner_can_create_multi_select(client: AsyncClient):
    """Test examiner creating a valid multi-select question."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "Networks",
        "question_text": "Which of the following are transport layer protocols?",
        "question_type": "multi_select",
        "difficulty": "easy",
        "marks": 3.0,
        "negative_marks": 1.0,
        "options": [
            {"option_text": "TCP", "is_correct": True},
            {"option_text": "UDP", "is_correct": True},
            {"option_text": "IP", "is_correct": False},
            {"option_text": "HTTP", "is_correct": False},
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["question_type"] == "multi_select"
    correct_opts = [o for o in data["options"] if o["is_correct"]]
    assert len(correct_opts) == 2

@pytest.mark.asyncio
async def test_03_examiner_can_create_short_answer(client: AsyncClient):
    """Test examiner creating a short answer question."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "Operating Systems",
        "question_text": "Define process starvation in OS scheduling.",
        "question_type": "short_answer",
        "difficulty": "easy",
        "marks": 4.0,
        "negative_marks": 0.0,
        "model_answer": "Starvation is indefinite postponement where low-priority processes never get CPU.",
        "expected_answer": "Indefinite blocking or waiting due to scheduling priority."
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["question_type"] == "short_answer"
    assert data["marks"] == 4.0

@pytest.mark.asyncio
async def test_04_examiner_can_create_long_answer(client: AsyncClient):
    """Test examiner creating a long answer question."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "Software Engineering",
        "question_text": "Explain the SOLID principles with architectural examples.",
        "question_type": "long_answer",
        "difficulty": "hard",
        "marks": 10.0,
        "negative_marks": 0.0,
        "model_answer": "Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion."
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["question_type"] == "long_answer"
    assert data["marks"] == 10.0

@pytest.mark.asyncio
async def test_05_examiner_can_create_image_upload(client: AsyncClient):
    """Test examiner creating an image-upload question."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "Data Structures",
        "question_text": "Draw an AVL tree after inserting keys 10, 20, 30, 40, 50.",
        "question_type": "image_upload",
        "difficulty": "medium",
        "marks": 8.0,
        "negative_marks": 0.0,
        "model_answer": "Handwritten diagram showing balanced AVL rotations."
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["question_type"] == "image_upload"
    assert data["marks"] == 8.0

@pytest.mark.asyncio
async def test_06_mcq_with_zero_correct_rejected(client: AsyncClient):
    """Test MCQ with zero correct options is rejected with 422/400."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "No correct option test",
        "question_type": "MCQ",
        "marks": 2.0,
        "options": [
            {"option_text": "Opt A", "is_correct": False},
            {"option_text": "Opt B", "is_correct": False}
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_07_mcq_with_two_correct_rejected(client: AsyncClient):
    """Test MCQ with multiple correct options is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Two correct options test",
        "question_type": "MCQ",
        "marks": 2.0,
        "options": [
            {"option_text": "Opt A", "is_correct": True},
            {"option_text": "Opt B", "is_correct": True}
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_08_multi_select_with_zero_correct_rejected(client: AsyncClient):
    """Test multi-select with zero correct options is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Zero correct multi-select test",
        "question_type": "multi_select",
        "marks": 2.0,
        "options": [
            {"option_text": "Opt A", "is_correct": False},
            {"option_text": "Opt B", "is_correct": False}
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_09_invalid_marks_rejected(client: AsyncClient):
    """Test question with marks <= 0 is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Invalid marks test",
        "question_type": "short_answer",
        "marks": 0.0
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_10_invalid_negative_marks_rejected(client: AsyncClient):
    """Test question with negative marks < 0 is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Negative negative marks test",
        "question_type": "MCQ",
        "marks": 2.0,
        "negative_marks": -1.0,
        "options": [
            {"option_text": "Opt A", "is_correct": True},
            {"option_text": "Opt B", "is_correct": False}
        ]
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_11_student_cannot_create_questions(client: AsyncClient):
    """Test student role is forbidden from creating questions."""
    headers = await get_auth_headers(client, "student@example.com", "Student@123")
    payload = {
        "subject": "DBMS",
        "question_text": "Student unauthorized creation",
        "question_type": "short_answer",
        "marks": 2.0
    }
    res = await client.post("/api/questions", json=payload, headers=headers)
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_12_unauthenticated_cannot_create_questions(client: AsyncClient):
    """Test unauthenticated request cannot create questions."""
    payload = {
        "subject": "DBMS",
        "question_text": "Unauthenticated creation",
        "question_type": "short_answer",
        "marks": 2.0
    }
    res = await client.post("/api/questions", json=payload)
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_13_examiner_can_retrieve_questions(client: AsyncClient):
    """Test retrieving question list with pagination metadata."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    res = await client.get("/api/questions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1

@pytest.mark.asyncio
async def test_14_filtering_by_subject(client: AsyncClient):
    """Test filtering questions by subject."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    # Seed unique subject
    unique_subj = f"Subj_{uuid.uuid4().hex[:6]}"
    await client.post("/api/questions", headers=headers, json={
        "subject": unique_subj,
        "question_text": "Subject filter test question",
        "question_type": "short_answer",
        "marks": 5.0
    })

    res = await client.get(f"/api/questions?subject={unique_subj}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["subject"] == unique_subj

@pytest.mark.asyncio
async def test_15_filtering_by_difficulty(client: AsyncClient):
    """Test filtering questions by difficulty."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    res = await client.get("/api/questions?difficulty=hard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["difficulty"].lower() == "hard"

@pytest.mark.asyncio
async def test_16_filtering_by_question_type(client: AsyncClient):
    """Test filtering questions by question type."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    res = await client.get("/api/questions?question_type=image_upload", headers=headers)
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["question_type"] == "image_upload"

@pytest.mark.asyncio
async def test_17_examiner_can_update_question(client: AsyncClient):
    """Test updating question text, marks, and options."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    # Create question first
    create_res = await client.post("/api/questions", headers=headers, json={
        "subject": "Algorithms",
        "question_text": "Original text: Time complexity of merge sort?",
        "question_type": "MCQ",
        "marks": 2.0,
        "options": [
            {"option_text": "O(N)", "is_correct": False},
            {"option_text": "O(N log N)", "is_correct": True}
        ]
    })
    q_id = create_res.json()["id"]

    # Update question
    update_res = await client.put(f"/api/questions/{q_id}", headers=headers, json={
        "question_text": "Updated text: Time complexity of merge sort?",
        "marks": 3.0,
        "options": [
            {"option_text": "O(1)", "is_correct": False},
            {"option_text": "O(N log N)", "is_correct": True}
        ]
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert "Updated text" in updated_data["question_text"]
    assert updated_data["marks"] == 3.0
    assert len(updated_data["options"]) == 2

@pytest.mark.asyncio
async def test_18_examiner_can_delete_question(client: AsyncClient):
    """Test deleting a question from the question bank."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    # Create question to delete
    create_res = await client.post("/api/questions", headers=headers, json={
        "subject": "Compiler Design",
        "question_text": "Temporary question for deletion",
        "question_type": "short_answer",
        "marks": 1.0
    })
    q_id = create_res.json()["id"]

    # Delete
    del_res = await client.delete(f"/api/questions/{q_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == q_id

    # Verify not found
    get_res = await client.get(f"/api/questions/{q_id}", headers=headers)
    assert get_res.status_code == 404
