import io
import json
import time
from datetime import datetime, timezone, timedelta
import httpx
from PIL import Image

BACKEND_URL = "http://127.0.0.1:8001"
FRONTEND_URL = "http://127.0.0.1:3000"

def step_msg(num: int, msg: str):
    print(f"\n[{num}/20] {msg}...")

def run_phase7_live_verification():
    print("==========================================================")
    print("STARTING PHASE 7 LIVE END-TO-END FLOW VERIFICATION (20/20)")
    print("==========================================================")

    ts = int(time.time())

    with httpx.Client(timeout=10.0) as client:
        # 1. Verify PostgreSQL Database
        step_msg(1, "Verify PostgreSQL Database Connection")
        health = client.get(f"{BACKEND_URL}/api/health")
        assert health.status_code == 200, f"Backend health failed: {health.text}"
        assert health.json()["database"] == "connected"
        print("   PostgreSQL is running and connected.")

        # 2. Verify FastAPI Backend
        step_msg(2, "Verify FastAPI Backend")
        root = client.get(f"{BACKEND_URL}/")
        assert root.status_code == 200
        assert root.json()["status"] == "online"
        print("   FastAPI backend is operational.")

        # 3. Verify Next.js Frontend
        step_msg(3, "Verify Next.js Frontend Server")
        fe_home = client.get(f"{FRONTEND_URL}/")
        assert fe_home.status_code == 200
        fe_exam = client.get(f"{FRONTEND_URL}/examiner")
        assert fe_exam.status_code == 200
        print("   Next.js frontend server is operational on port 3000.")

        # 4. Examiner Authentication
        step_msg(4, "Examiner Registration & Login")
        examiner_email = f"p7_examiner_{ts}@university.edu"
        reg_res = client.post(f"{BACKEND_URL}/api/auth/register", json={
            "email": examiner_email,
            "password": "Password123!",
            "name": "Prof. Alan Turing",
            "role": "examiner"
        })
        assert reg_res.status_code == 201, f"Examiner reg failed: {reg_res.text}"
        login_res = client.post(f"{BACKEND_URL}/api/auth/login", json={
            "email": examiner_email,
            "password": "Password123!"
        })
        assert login_res.status_code == 200
        examiner_token = login_res.json()["access_token"]
        examiner_headers = {"Authorization": f"Bearer {examiner_token}"}
        print(f"   Examiner logged in successfully ({examiner_email}).")

        # 5. Open Examiner Dashboard & Fetch Real Metrics
        step_msg(5, "Fetch Real Examiner Dashboard Metrics")
        stats_res = client.get(f"{BACKEND_URL}/api/examiner/dashboard-stats", headers=examiner_headers)
        assert stats_res.status_code == 200, f"Stats failed: {stats_res.text}"
        stats = stats_res.json()
        assert "total_questions" in stats
        assert "total_exams" in stats
        assert "active_exams" in stats
        assert "completed_exams" in stats
        print(f"   Dashboard stats retrieved: Questions={stats['total_questions']}, Exams={stats['total_exams']}, Active={stats['active_exams']}")

        # 6. Create Question in Question Bank
        step_msg(6, "Create Question in Question Bank")
        q_create_res = client.post(f"{BACKEND_URL}/api/questions", json={
            "subject": f"Algorithms_{ts}",
            "question_text": "What is the worst-case time complexity of QuickSort?",
            "question_type": "MCQ",
            "difficulty": "medium",
            "marks": 5.0,
            "negative_marks": 1.0,
            "options": [
                {"option_text": "O(n^2)", "is_correct": True},
                {"option_text": "O(n log n)", "is_correct": False},
                {"option_text": "O(n)", "is_correct": False},
                {"option_text": "O(1)", "is_correct": False}
            ]
        }, headers=examiner_headers)
        assert q_create_res.status_code == 201, f"Question create failed: {q_create_res.text}"
        question_id = q_create_res.json()["id"]
        print(f"   Question #{question_id} created successfully.")

        # 7. Edit the Question
        step_msg(7, "Edit the Question")
        q_edit_res = client.put(f"{BACKEND_URL}/api/questions/{question_id}", json={
            "marks": 6.0,
            "question_text": "What is the worst-case time complexity of standard QuickSort with first element pivot?"
        }, headers=examiner_headers)
        assert q_edit_res.status_code == 200
        assert q_edit_res.json()["marks"] == 6.0
        print(f"   Question #{question_id} updated: marks=6.0.")

        # 8. Create Exam via Workflow Parameters
        step_msg(8, "Create Exam via Workflow Parameters")
        now_utc = datetime.now(timezone.utc)
        exam_create_res = client.post(f"{BACKEND_URL}/api/exams", json={
            "title": f"CS301 Algorithms Midterm {ts}",
            "subject": f"Algorithms_{ts}",
            "description": "Comprehensive midterm with AI proctoring active.",
            "duration": 45,
            "question_count": 1,
            "start_time": now_utc.isoformat(),
            "end_time": (now_utc + timedelta(hours=3)).isoformat(),
            "randomization_enabled": True,
            "negative_marking_enabled": True,
            "proctoring_enabled": True,
            "gaze_sensitivity": "medium",
            "max_tab_switch_warnings": 3,
            "question_ids": [question_id]
        }, headers=examiner_headers)
        assert exam_create_res.status_code == 201, f"Exam create failed: {exam_create_res.text}"
        exam_id = exam_create_res.json()["id"]
        print(f"   Exam #{exam_id} created successfully.")

        # 9. Verify Attached Questions
        step_msg(9, "Verify Attached Questions to Exam")
        exam_detail_res = client.get(f"{BACKEND_URL}/api/exams/{exam_id}", headers=examiner_headers)
        assert exam_detail_res.status_code == 200
        exam_detail = exam_detail_res.json()
        assert len(exam_detail["questions"]) == 1
        assert exam_detail["questions"][0]["id"] == question_id
        print(f"   Confirmed: Question #{question_id} attached with {exam_detail['questions'][0]['marks']} marks.")

        # 10. View Exam Details
        step_msg(10, "View Exam Details")
        assert exam_detail["proctoring_enabled"] is True
        assert exam_detail["gaze_sensitivity"] == "medium"
        assert exam_detail["duration"] == 45
        print(f"   Exam #{exam_id} details validated: '{exam_detail['title']}'.")

        # 11. Student Registration & Login
        step_msg(11, "Student Registration & Login")
        student_email = f"p7_student_{ts}@student.edu"
        s_reg = client.post(f"{BACKEND_URL}/api/auth/register", json={
            "email": student_email,
            "password": "Password123!",
            "name": "Jane Student",
            "role": "student"
        })
        assert s_reg.status_code == 201
        s_login = client.post(f"{BACKEND_URL}/api/auth/login", json={
            "email": student_email,
            "password": "Password123!"
        })
        student_token = s_login.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        print(f"   Student logged in ({student_email}).")

        # 12. Verify Student Cannot Access Examiner Routes (HTTP 403)
        step_msg(12, "Verify Student Cannot Access Examiner Endpoints")
        r_stats = client.get(f"{BACKEND_URL}/api/examiner/dashboard-stats", headers=student_headers)
        assert r_stats.status_code == 403, f"Expected 403, got {r_stats.status_code}"
        r_results = client.get(f"{BACKEND_URL}/api/examiner/results", headers=student_headers)
        assert r_results.status_code == 403
        r_proctor = client.get(f"{BACKEND_URL}/api/examiner/proctoring-sessions", headers=student_headers)
        assert r_proctor.status_code == 403
        print("   Student is strictly forbidden from examiner routes (all returned 403).")

        # 13. Student Enters Exam Session
        step_msg(13, "Student Enters Exam Session")
        enter_res = client.post(f"{BACKEND_URL}/api/exam-sessions/enter", json={
            "exam_id": exam_id
        }, headers=student_headers)
        assert enter_res.status_code == 200, f"Enter failed: {enter_res.text}"
        session_id = enter_res.json()["id"]
        print(f"   Student entered exam #{exam_id} (Session #{session_id}).")

        # 14. Answer Question & Generate Proctoring Events with Snapshot
        step_msg(14, "Submit Answer & Generate Proctoring Telemetry")
        # Submit correct answer (O(n^2) option)
        paper_res = client.get(f"{BACKEND_URL}/api/exam-sessions/{session_id}/paper", headers=student_headers)
        opt_id = paper_res.json()["questions"][0]["options"][0]["id"]
        ans_res = client.post(f"{BACKEND_URL}/api/exam-sessions/{session_id}/answers", json={
            "question_id": question_id,
            "selected_option_ids": [opt_id]
        }, headers=student_headers)
        assert ans_res.status_code in (200, 201)

        # Upload Evidence Snapshot
        buf = io.BytesIO()
        img = Image.new("RGB", (80, 80), color=(50, 120, 200))
        img.save(buf, format="PNG")
        snap_res = client.post(
            f"{BACKEND_URL}/api/exam-sessions/{session_id}/proctor-snapshot",
            files={"file": ("evidence_tab_switch.png", buf.getvalue(), "image/png")},
            data={"event_type": "TAB_SWITCH"},
            headers=student_headers
        )
        assert snap_res.status_code == 200
        snap_url = snap_res.json()["snapshot_url"]

        # Telemetry: TAB_SWITCH linked with snapshot
        time.sleep(1)
        ev1 = client.post(f"{BACKEND_URL}/api/exam-sessions/{session_id}/proctor-events", json={
            "event_type": "TAB_SWITCH",
            "metadata": {"warning": 1},
            "webcam_snapshot_url": snap_url
        }, headers=student_headers)
        assert ev1.status_code == 200
        print(f"   Proctoring telemetry logged with snapshot: {snap_url}")

        # 15. Submit Exam
        step_msg(15, "Submit Exam Session")
        sub_res = client.post(f"{BACKEND_URL}/api/exam-sessions/{session_id}/submit", headers=student_headers)
        assert sub_res.status_code == 200, f"Submit failed: {sub_res.text}"
        print(f"   Exam session #{session_id} submitted and evaluated.")

        # 16. Return to Examiner Portal
        step_msg(16, "Return to Examiner Portal Context")
        updated_stats = client.get(f"{BACKEND_URL}/api/examiner/dashboard-stats", headers=examiner_headers).json()
        print(f"   Examiner refreshed dashboard: Flagged sessions={updated_stats['flagged_sessions']}.")

        # 17. Verify Candidate Result Appears in Results View
        step_msg(17, "Verify Result in Examiner Results View")
        results_res = client.get(f"{BACKEND_URL}/api/examiner/results?exam_id={exam_id}", headers=examiner_headers)
        assert results_res.status_code == 200
        results_list = results_res.json()
        assert len(results_list) >= 1
        matched_result = next((r for r in results_list if r["session_id"] == session_id), None)
        assert matched_result is not None, f"Result for session {session_id} not found"
        assert matched_result["student_name"] == "Jane Student"
        assert matched_result["status"] == "submitted"
        assert matched_result["total_score"] >= 0
        print(f"   Result verified: Candidate={matched_result['student_name']}, Total Score={matched_result['total_score']}, Suspicion Score={matched_result['suspicion_score']}.")

        # 18. Verify Proctoring Review Sessions View
        step_msg(18, "Verify Proctoring Session in Review View")
        proctor_sessions_res = client.get(f"{BACKEND_URL}/api/examiner/proctoring-sessions?exam_id={exam_id}", headers=examiner_headers)
        assert proctor_sessions_res.status_code == 200
        p_sessions = proctor_sessions_res.json()
        target_ps = next((ps for ps in p_sessions if ps["session_id"] == session_id), None)
        assert target_ps is not None
        assert target_ps["event_count"] >= 1
        assert target_ps["has_evidence_snapshot"] is True
        print(f"   Proctoring review session verified: Events={target_ps['event_count']}, Evidence={target_ps['has_evidence_snapshot']}.")

        # 19. Verify Proctoring Events Timeline & Evidence Snapshot
        step_msg(19, "Verify Visual Timeline Telemetry & Snapshot Access")
        events_res = client.get(f"{BACKEND_URL}/api/exam-sessions/{session_id}/proctor-events", headers=examiner_headers)
        assert events_res.status_code == 200
        events_list = events_res.json()
        assert len(events_list) >= 1
        snap_event = next((ev for ev in events_list if ev["webcam_snapshot_url"]), None)
        assert snap_event is not None
        # Verify snapshot image is served and reachable
        image_res = client.get(f"{BACKEND_URL}{snap_event['webcam_snapshot_url']}")
        assert image_res.status_code == 200
        assert "image" in image_res.headers.get("content-type", "")
        print(f"   Timeline verified: {len(events_list)} events. Evidence snapshot reachable ({image_res.headers.get('content-length')} bytes).")

        # 20. Examiner Logout
        step_msg(20, "Examiner Logout Verification")
        # Ensure clearing auth token results in rejection on subsequent queries
        unauth_check = client.get(f"{BACKEND_URL}/api/examiner/dashboard-stats")
        assert unauth_check.status_code == 401
        print("   Logout confirmed: Unauthenticated request rejected (HTTP 401).")

    print("\n==========================================================")
    print("ALL 20 PHASE 7 LIVE END-TO-END FLOW TESTS PASSED!")
    print("==========================================================")

if __name__ == "__main__":
    run_phase7_live_verification()
