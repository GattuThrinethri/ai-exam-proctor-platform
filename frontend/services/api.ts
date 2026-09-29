/**
 * Centralized API Client
 * Provides typed endpoints for Question Bank, Exams, Results, and Proctoring.
 */

import { authService } from "./auth";

export interface QuestionOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
}

export interface Question {
  id: number;
  subject: string;
  question_text: string;
  question_type: "MCQ" | "MULTI_SELECT" | "SHORT_ANSWER" | "LONG_ANSWER" | "IMAGE_UPLOAD";
  difficulty: "EASY" | "MEDIUM" | "HARD" | "easy" | "medium" | "hard";
  marks: number;
  negative_marks: number;
  model_answer?: string | null;
  expected_answer?: string | null;
  image_url?: string | null;
  options?: QuestionOption[];
  created_at?: string;
  updated_at?: string;
}

export interface QuestionListResponse {
  items: Question[];
  total: number;
  page: number;
  page_size: number;
}

export interface ImportedOption {
  option_text: string;
  is_correct: boolean;
}

export interface ExtractedQuestion {
  temp_id: string;
  question_text: string;
  question_type: string;
  options: ImportedOption[];
  correct_answer?: string | null;
  subject?: string | null;
  difficulty: string;
  marks: number;
  negative_marks: number;
  model_answer?: string | null;
  expected_answer?: string | null;
  is_duplicate: boolean;
  duplicate_reason?: string | null;
}

export interface ImportPreviewResponse {
  filename: string;
  file_type: string;
  file_size: number;
  detected_subject?: string | null;
  total_extracted: number;
  duplicate_count: number;
  questions: ExtractedQuestion[];
}

export interface ImportConfirmRequest {
  questions: {
    question_text: string;
    question_type: string;
    options?: ImportedOption[];
    correct_answer?: string | null;
    subject?: string | null;
    difficulty?: string;
    marks?: number;
    negative_marks?: number;
    model_answer?: string | null;
    expected_answer?: string | null;
  }[];
  default_subject?: string | null;
}

export interface ImportConfirmResponse {
  imported_count: number;
  skipped_count: number;
  question_ids: number[];
}

export interface Exam {
  id: number;
  title: string;
  subject: string;
  description?: string | null;
  duration: number; // minutes
  question_count: number;
  start_time: string;
  end_time: string;
  randomization_enabled: boolean;
  negative_marking_enabled: boolean;
  proctoring_enabled: boolean;
  gaze_sensitivity: "low" | "medium" | "high";
  max_tab_switch_warnings: number;
  total_marks?: number;
  pass_marks?: number;
  questions?: Question[];
  created_at?: string;
}

export interface ExaminerStats {
  total_questions: number;
  total_exams: number;
  active_exams: number;
  completed_exams: number;
  pending_evaluations: number;
  flagged_sessions: number;
}

export interface ExaminerResult {
  id: number;
  session_id: number;
  exam_id: number;
  exam_title: string;
  subject?: string;
  student_id: number;
  student_name: string;
  student_email: string;
  total_score: number;
  objective_score: number;
  subjective_score: number;
  max_score?: number;
  percentage?: number;
  status: string;
  published: boolean;
  requires_evaluation: boolean;
  suspicion_score: number;
  submitted_at?: string | null;
  generated_at: string;
}

export interface ExaminerQuestionEvaluationItem {
  question_id: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  marks: number;
  student_answer_text?: string | null;
  student_selected_option_ids?: number[] | null;
  student_image_url?: string | null;
  ocr_extracted_text?: string | null;
  options?: { id: number; option_text: string; is_correct?: boolean | null }[] | null;
  expected_answer?: string | null;
  model_answer?: string | null;
  auto_score?: number | null;
  ai_score?: number | null;
  examiner_score?: number | null;
  examiner_feedback?: string | null;
}

export interface ExaminerEvaluationSessionResponse {
  session_id: number;
  exam_id: number;
  exam_title: string;
  subject: string;
  duration_minutes: number;
  student_id: number;
  student_name: string;
  student_email: string;
  status: string;
  published: boolean;
  submitted_at?: string | null;
  total_score: number;
  objective_score: number;
  subjective_score: number;
  max_score: number;
  questions: ExaminerQuestionEvaluationItem[];
}

export interface QuestionScoreInput {
  question_id: number;
  marks_awarded: number;
  feedback?: string | null;
}

export interface ExaminerFinalizeEvaluationRequest {
  evaluations: QuestionScoreInput[];
  publish_result?: boolean;
}

export interface ProctoringSession {
  session_id: number;
  exam_id: number;
  exam_title: string;
  subject?: string;
  student_id: number;
  student_name: string;
  student_email: string;
  suspicion_score: number;
  event_count: number;
  tab_switch_count?: number;
  gaze_deviation_count?: number;
  face_not_visible_count?: number;
  multiple_faces_count?: number;
  status: string;
  started_at: string;
  submitted_at?: string | null;
  has_evidence_snapshot: boolean;
}

export interface ProctorEvent {
  id: number;
  session_id: number;
  event_type: "FACE_ABSENT" | "MULTIPLE_FACES" | "GAZE_AWAY" | "TAB_SWITCH" | "WINDOW_BLUR" | string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  suspicion_increment: number;
  details?: string | null;
  metadata_json?: Record<string, any> | null;
  webcam_snapshot_url?: string | null;
  snapshot_url?: string | null;
}

const API_BASE = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : "").replace(/\/$/, "");

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error("Network error: Unable to connect to the server. Please verify the backend service is running.");
  }

  if (response.status === 401) {
    authService.clearAuth();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=1";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const err = await response.json();
      if (Array.isArray(err.detail)) {
        errorDetail = err.detail.map((d: any) => `${d.loc?.join(".") || "field"}: ${d.msg}`).join("; ");
      } else if (err.detail) {
        errorDetail = err.detail;
      } else if (err.message) {
        errorDetail = err.message;
      }
    } catch {
      errorDetail = `Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const questionsApi = {
  list(params?: {
    subject?: string;
    difficulty?: string;
    question_type?: string;
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<QuestionListResponse> {
    const q = new URLSearchParams();
    if (params?.subject) q.set("subject", params.subject);
    if (params?.difficulty) q.set("difficulty", params.difficulty);
    if (params?.question_type) q.set("question_type", params.question_type);
    if (params?.page) q.set("page", String(params.page));
    if (params?.page_size) q.set("page_size", String(params.page_size));
    if (params?.search) q.set("search", params.search);

    const qs = q.toString();
    return request<QuestionListResponse>(`/api/questions${qs ? `?${qs}` : ""}`);
  },

  get(id: number): Promise<Question> {
    return request<Question>(`/api/questions/${id}`);
  },

  create(data: Partial<Question>): Promise<Question> {
    return request<Question>("/api/questions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: Partial<Question>): Promise<Question> {
    return request<Question>(`/api/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/questions/${id}`, {
      method: "DELETE",
    });
  },

  importDocument(file: File): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return request<ImportPreviewResponse>("/api/questions/import", {
      method: "POST",
      body: formData,
    });
  },

  confirmImport(data: ImportConfirmRequest): Promise<ImportConfirmResponse> {
    return request<ImportConfirmResponse>("/api/questions/import/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const examsApi = {
  list(params?: { subject?: string }): Promise<Exam[]> {
    const q = new URLSearchParams();
    if (params?.subject) q.set("subject", params.subject);
    const qs = q.toString();
    return request<Exam[]>(`/api/exams${qs ? `?${qs}` : ""}`);
  },

  get(id: number): Promise<Exam> {
    return request<Exam>(`/api/exams/${id}`);
  },

  create(data: any): Promise<Exam> {
    return request<Exam>("/api/exams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(id: number, data: any): Promise<Exam> {
    return request<Exam>(`/api/exams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/exams/${id}`, {
      method: "DELETE",
    });
  },
};

export const examinerApi = {
  getDashboardStats(): Promise<ExaminerStats> {
    return request<ExaminerStats>("/api/examiner/dashboard-stats");
  },

  getResults(params?: { exam_id?: number; search?: string }): Promise<ExaminerResult[]> {
    const q = new URLSearchParams();
    if (params?.exam_id) q.set("exam_id", String(params.exam_id));
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return request<ExaminerResult[]>(`/api/examiner/results${qs ? `?${qs}` : ""}`);
  },

  getProctoringSessions(params?: {
    exam_id?: number;
    min_suspicion?: number;
  }): Promise<ProctoringSession[]> {
    const q = new URLSearchParams();
    if (params?.exam_id) q.set("exam_id", String(params.exam_id));
    if (params?.min_suspicion !== undefined) q.set("min_suspicion", String(params.min_suspicion));
    const qs = q.toString();
    return request<ProctoringSession[]>(`/api/examiner/proctoring-sessions${qs ? `?${qs}` : ""}`);
  },

  getEvaluationSession(sessionId: number): Promise<ExaminerEvaluationSessionResponse> {
    return request<ExaminerEvaluationSessionResponse>(`/api/examiner/evaluations/${sessionId}`);
  },

  finalizeEvaluation(sessionId: number, payload: ExaminerFinalizeEvaluationRequest): Promise<any> {
    return request<any>(`/api/examiner/evaluations/${sessionId}/finalize`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const proctoringApi = {
  getEvents(sessionId: number): Promise<ProctorEvent[]> {
    return request<ProctorEvent[]>(`/api/exam-sessions/${sessionId}/proctor-events`);
  },
};

// ==========================================
// Phase 8: Student & Admin Types and APIs (with Examiner Approval Extensions)
// ==========================================

export interface StudentResultSummary {
  id: number;
  session_id: number;
  exam_id: number;
  exam_title: string;
  subject: string;
  total_score: number | null;
  max_score: number;
  objective_score?: number | null;
  subjective_score?: number | null;
  percentage: number | null;
  percentile: number | null;
  status: string;
  published: boolean;
  requires_manual_evaluation?: boolean;
  submitted_at: string | null;
  generated_at: string;
}

export interface QuestionReview {
  question_id: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  marks: number;
  awarded_score: number | null;
  student_selected_option_ids: number[] | null;
  student_answer_text: string | null;
  student_image_url: string | null;
  ocr_extracted_text: string | null;
  options?: { id: number; option_text: string; is_correct?: boolean | null }[] | null;
  correct_option_ids?: number[] | null;
  correct_options_text?: string[] | null;
  model_answer?: string | null;
  ai_justification?: string | null;
  ai_feedback?: any;
}

export interface StudentResultDetail {
  id: number;
  session_id: number;
  exam_id: number;
  exam_title: string;
  subject: string;
  total_score: number | null;
  max_score: number;
  objective_score?: number | null;
  subjective_score?: number | null;
  percentage: number | null;
  percentile: number | null;
  suspicion_score?: number;
  status: string;
  published: boolean;
  requires_manual_evaluation?: boolean;
  submitted_at: string | null;
  generated_at: string;
  question_reviews: QuestionReview[];
}

export interface StudentPaperOption {
  id: number;
  option_text: string;
}

export interface StudentPaperQuestion {
  id: number;
  question_text: string;
  question_type: "MCQ" | "MULTI_SELECT" | "SHORT_ANSWER" | "LONG_ANSWER" | "IMAGE_UPLOAD";
  difficulty: string;
  marks: number;
  options: StudentPaperOption[];
  image_url?: string | null;
}

export interface StudentExamPaper {
  session_id: number;
  exam_id: number;
  title: string;
  subject: string;
  description?: string | null;
  duration_minutes: number;
  started_at: string;
  server_time: string;
  remaining_seconds: number;
  proctoring_enabled: boolean;
  questions: StudentPaperQuestion[];
}

export interface StudentExamSession {
  id: number;
  exam_id: number;
  student_id: number;
  session_token: string;
  started_at: string;
  submitted_at?: string | null;
  status: string;
  duration_minutes: number;
  server_time: string;
  remaining_seconds: number;
  is_timed_out: boolean;
}

export interface AdminPlatformStats {
  total_users: number;
  total_students: number;
  total_examiners: number;
  total_admins: number;
  total_exams: number;
  active_exams: number;
  total_sessions: number;
  completed_sessions: number;
  flagged_sessions: number;
  average_score: number;
  pending_examiner_approvals?: number;
  total_questions?: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  approval_status: "pending" | "approved" | "rejected" | string;
  is_active: boolean;
  created_at: string;
  session_count: number;
}

export interface AdminExam {
  id: number;
  title: string;
  subject: string;
  duration: number;
  question_count: number;
  creator_id: number;
  creator_name: string;
  creator_email: string;
  start_time: string;
  end_time: string;
  proctoring_enabled: boolean;
  candidate_count: number;
  is_active: boolean;
}

export interface AdminAuditLog {
  id: number;
  user_id: number | null;
  user_name: string;
  user_email: string | null;
  user_role: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export const studentApi = {
  getMyResults(): Promise<StudentResultSummary[]> {
    return request<StudentResultSummary[]>("/api/results/my-results");
  },

  getSessionResult(sessionId: number): Promise<StudentResultDetail> {
    return request<StudentResultDetail>(`/api/results/session/${sessionId}`);
  },

  getAvailableExams(params?: { subject?: string }): Promise<Exam[]> {
    const q = new URLSearchParams();
    if (params?.subject) q.set("subject", params.subject);
    const qs = q.toString();
    return request<Exam[]>(`/api/exams${qs ? `?${qs}` : ""}`);
  },

  generateExamToken(examId: number): Promise<{ access_token: string }> {
    return request<{ access_token: string }>(`/api/exams/${examId}/token`, {
      method: "POST",
    });
  },

  enterExam(examId: number, examToken?: string): Promise<StudentExamSession> {
    return request<StudentExamSession>("/api/exam-sessions/enter", {
      method: "POST",
      body: JSON.stringify({ exam_id: examId, exam_token: examToken || null }),
    });
  },

  getExamPaper(sessionId: number): Promise<StudentExamPaper> {
    return request<StudentExamPaper>(`/api/exam-sessions/${sessionId}/paper`);
  },

  getSession(sessionId: number): Promise<StudentExamSession> {
    return request<StudentExamSession>(`/api/exam-sessions/${sessionId}`);
  },

  saveAnswer(
    sessionId: number,
    data: {
      question_id: number;
      selected_option_ids?: number[];
      answer_text?: string;
      image_url?: string;
    }
  ): Promise<any> {
    return request(`/api/exam-sessions/${sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async uploadAnswerImage(
    sessionId: number,
    questionId: number,
    file: File
  ): Promise<{ image_url: string; ocr_text?: string; filename: string }> {
    const token = authService.getToken();
    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/exam-sessions/${sessionId}/answers/${questionId}/image`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Image upload failed" }));
      throw new Error(err.detail || "Image upload failed");
    }

    return await res.json();
  },

  submitExam(sessionId: number): Promise<StudentExamSession> {
    return request<StudentExamSession>(`/api/exam-sessions/${sessionId}/submit`, {
      method: "POST",
    });
  },
};

export const adminApi = {
  getStats(): Promise<AdminPlatformStats> {
    return request<AdminPlatformStats>("/api/admin/stats");
  },

  getUsers(params?: {
    role?: string;
    search?: string;
    is_active?: boolean;
    approval_status?: string;
  }): Promise<AdminUser[]> {
    const q = new URLSearchParams();
    if (params?.role) q.set("role", params.role);
    if (params?.search) q.set("search", params.search);
    if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
    if (params?.approval_status) q.set("approval_status", params.approval_status);
    const qs = q.toString();
    return request<AdminUser[]>(`/api/admin/users${qs ? `?${qs}` : ""}`);
  },

  getPendingExaminers(): Promise<AdminUser[]> {
    return request<AdminUser[]>("/api/admin/users/pending-examiners");
  },

  approveExaminer(userId: number): Promise<AdminUser> {
    return request<AdminUser>(`/api/admin/users/${userId}/approve`, {
      method: "POST",
    });
  },

  rejectExaminer(userId: number): Promise<AdminUser> {
    return request<AdminUser>(`/api/admin/users/${userId}/reject`, {
      method: "POST",
    });
  },

  createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<AdminUser> {
    return request<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateUserRole(userId: number, role: string): Promise<any> {
    return request(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  updateUserStatus(userId: number, is_active: boolean): Promise<any> {
    return request(`/api/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active }),
    });
  },

  getExams(params?: { search?: string; subject?: string }): Promise<AdminExam[]> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.subject) q.set("subject", params.subject);
    const qs = q.toString();
    return request<AdminExam[]>(`/api/admin/exams${qs ? `?${qs}` : ""}`);
  },

  getGlobalExams(): Promise<AdminExam[]> {
    return request<AdminExam[]>("/api/admin/exams");
  },

  deleteExam(examId: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/admin/exams/${examId}`, {
      method: "DELETE",
    });
  },

  getAuditLogs(params?: {
    action?: string;
    user_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLog[]> {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.user_id) q.set("user_id", String(params.user_id));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<AdminAuditLog[]>(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
