"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Check,
  Award,
  User,
  BookOpen,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  examinerApi,
  ExaminerEvaluationSessionResponse,
  ExaminerQuestionEvaluationItem,
  QuestionScoreInput,
} from "../../../../services/api";

interface PageProps {
  params?: { id?: string };
}

// Helper to normalize and detect question category
function normalizeQuestionType(type?: string): string {
  if (!type) return "";
  return type.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function isSubjectiveType(type?: string): boolean {
  const norm = normalizeQuestionType(type);
  return norm === "short_answer" || norm === "long_answer" || norm === "image_upload";
}

export default function ExaminerEvaluationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const routeParams = useParams();

  // Support both page prop params and client-side useParams()
  const rawId = (params?.id || (routeParams?.id as string) || "").trim();
  const sessionId = parseInt(rawId, 10);

  const [sessionData, setSessionData] = useState<ExaminerEvaluationSessionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for examiner scores and feedback per question: { [qid]: { marks: number, feedback: string } }
  const [evaluations, setEvaluations] = useState<Record<number, { marks: number; feedback: string }>>({});
  const [publishResult, setPublishResult] = useState<boolean>(true);

  const loadEvaluation = useCallback(async (sid: number) => {
    if (isNaN(sid) || sid <= 0) {
      setError("Invalid examination session ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await examinerApi.getEvaluationSession(sid);
      if (!data) {
        throw new Error("No evaluation data received from server.");
      }
      setSessionData(data);

      // Initialize evaluation state for subjective questions
      const initialEvals: Record<number, { marks: number; feedback: string }> = {};
      (data.questions || []).forEach((q: ExaminerQuestionEvaluationItem) => {
        if (isSubjectiveType(q.question_type)) {
          const currentScore =
            q.examiner_score !== null && q.examiner_score !== undefined
              ? Number(q.examiner_score)
              : q.ai_score !== null && q.ai_score !== undefined
              ? Number(q.ai_score)
              : 0;

          initialEvals[q.question_id] = {
            marks: currentScore,
            feedback: q.examiner_feedback || "",
          };
        }
      });
      setEvaluations(initialEvals);
    } catch (err: any) {
      console.error("Evaluation load error:", err);
      setError(err.message || "Failed to load candidate submission for evaluation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isNaN(sessionId) && sessionId > 0) {
      loadEvaluation(sessionId);
    } else if (rawId) {
      const parsed = parseInt(rawId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        loadEvaluation(parsed);
      }
    }
  }, [sessionId, rawId, loadEvaluation]);

  const handleScoreChange = (qid: number, maxMarks: number, val: string) => {
    const num = parseFloat(val);
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(maxMarks, num));
    setEvaluations((prev) => ({
      ...prev,
      [qid]: {
        ...prev[qid],
        marks: clamped,
      },
    }));
  };

  const handleFeedbackChange = (qid: number, text: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [qid]: {
        ...prev[qid],
        feedback: text,
      },
    }));
  };

  // Compute live subjective and total score
  const computedSubjectiveScore = Object.values(evaluations).reduce(
    (sum, item) => sum + (Number(item.marks) || 0),
    0
  );
  const computedTotalScore = (sessionData?.objective_score || 0) + computedSubjectiveScore;
  const maxMarks = sessionData?.max_score || 0;
  const computedPercentage = maxMarks > 0
    ? Math.round((computedTotalScore / maxMarks) * 1000) / 10
    : 0;

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionData) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload: QuestionScoreInput[] = Object.entries(evaluations).map(([qidStr, val]) => ({
      question_id: parseInt(qidStr, 10),
      marks_awarded: Number(val.marks) || 0,
      feedback: val.feedback || null,
    }));

    try {
      await examinerApi.finalizeEvaluation(sessionData.session_id, {
        evaluations: payload,
        publish_result: publishResult,
      });

      setSuccessMessage(
        publishResult
          ? "Evaluation successfully finalized! The result has been published and is now visible to the student."
          : "Evaluation draft saved successfully."
      );

      // Reload fresh state
      await loadEvaluation(sessionData.session_id);
    } catch (err: any) {
      setError(err.message || "Failed to finalize evaluation.");
    } finally {
      setSaving(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm">
        <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="font-medium text-slate-700">Loading candidate submission paper...</p>
        <p className="text-xs text-slate-400 mt-1">Retrieving candidate responses and question rubric</p>
      </div>
    );
  }

  // Error State when sessionData couldn't be loaded
  if (error && !sessionData) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-6 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm space-y-3">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-red-900">Unable to Load Evaluation</h3>
          <p className="text-xs text-red-700">{error}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (sessionId) loadEvaluation(sessionId);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
            <Link
              href="/examiner/results"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Results
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if sessionData is unexpectedly empty
  if (!sessionData) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-6 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-sm">
          <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="font-bold">No Evaluation Found</p>
          <p className="text-xs text-amber-700 mt-1">
            The requested examination session could not be found or has not been submitted yet.
          </p>
          <div className="mt-4">
            <Link
              href="/examiner/results"
              className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Candidate Results
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <Link
            href="/examiner/results"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Candidate Results
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manual Evaluation & Review</h1>
            {sessionData.published ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Result Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Evaluation Pending
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-4 h-4" /> Submitted:{" "}
          {sessionData.submitted_at ? new Date(sessionData.submitted_at).toLocaleString() : "Auto-submitted"}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Candidate & Exam Metadata Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Candidate
          </p>
          <p className="font-bold text-slate-900 text-base">{sessionData.student_name}</p>
          <p className="text-xs text-slate-500">{sessionData.student_email}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Examination
          </p>
          <p className="font-bold text-slate-900 text-base">{sessionData.exam_title}</p>
          <p className="text-xs text-slate-500">{sessionData.subject} • {sessionData.duration_minutes} Mins</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Objective Marks</p>
          <p className="text-xl font-extrabold text-slate-800">
            {(sessionData.objective_score || 0).toFixed(2)}{" "}
            <span className="text-xs font-medium text-slate-400">pts</span>
          </p>
          <p className="text-xs text-slate-400">Auto-evaluated</p>
        </div>

        <div className="space-y-1 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> Live Computed Total
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-900">{computedTotalScore.toFixed(2)}</span>
            <span className="text-xs font-semibold text-indigo-500">/ {sessionData.max_score} pts</span>
          </div>
          <p className="text-xs font-bold text-indigo-700">{computedPercentage}% Overall</p>
        </div>
      </div>

      {/* Evaluation Form */}
      <form onSubmit={handleFinalize} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Question Submissions & Scoring</h2>
          <span className="text-xs text-slate-500 font-medium">
            {sessionData.questions?.length || 0} Questions Total
          </span>
        </div>

        {sessionData.questions?.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
            No questions found for this examination submission.
          </div>
        ) : (
          <div className="space-y-5">
            {sessionData.questions.map((q, idx) => {
              const isSubjective = isSubjectiveType(q.question_type);
              const currentEval = evaluations[q.question_id] || { marks: 0, feedback: "" };
              const displayType = (q.question_type || "").replace(/_/g, " ").toUpperCase();

              return (
                <div
                  key={q.question_id}
                  className={`bg-white rounded-2xl border p-6 shadow-sm space-y-4 transition-all ${
                    isSubjective
                      ? "border-indigo-200 ring-1 ring-indigo-100/50"
                      : "border-slate-200"
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {displayType}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">Difficulty: {q.difficulty}</span>
                      <span className="text-xs font-bold text-slate-600">Maximum Marks: {q.marks}</span>
                    </div>

                    <div>
                      {isSubjective ? (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Manual Evaluation Required
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Auto Score: {q.auto_score ?? 0} / {q.marks}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question_text}</p>

                  {/* Candidate's Submitted Response */}
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3 text-xs border border-slate-100">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider">Student Answer:</p>

                    {/* MCQ / Multi-select Options */}
                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt) => {
                          const wasSelected = q.student_selected_option_ids?.includes(opt.id);
                          const isCorrect = opt.is_correct;

                          return (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                                wasSelected && isCorrect
                                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium"
                                  : wasSelected && !isCorrect
                                  ? "bg-red-50/80 border-red-300 text-red-900"
                                  : isCorrect
                                  ? "bg-emerald-50/30 border-emerald-200 text-emerald-800 font-medium"
                                  : "bg-white border-slate-200 text-slate-600"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wasSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                                  {wasSelected && <Check className="w-2.5 h-2.5" />}
                                </span>
                                {opt.option_text}
                              </span>
                              <div className="flex items-center gap-2">
                                {wasSelected && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-white/80 px-2 py-0.5 rounded">
                                    Selected by Student
                                  </span>
                                )}
                                {isCorrect && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                                    Correct Option
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Text Answer */}
                    {q.student_answer_text && (
                      <div className="p-3.5 bg-white rounded-lg border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                        {q.student_answer_text}
                      </div>
                    )}

                    {/* Image Answer */}
                    {q.student_image_url && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                          <ImageIcon className="w-4 h-4" /> Handwritten Answer Sheet Uploaded:
                        </div>
                        <img
                          src={q.student_image_url}
                          alt="Handwritten answer sheet"
                          className="max-h-80 rounded-lg border border-slate-200 object-contain bg-white"
                        />
                        {q.ocr_extracted_text && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700">
                            <span className="font-semibold text-slate-500 block mb-1">OCR Transcribed Text:</span>
                            <p className="italic font-mono text-[11px]">{q.ocr_extracted_text}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {!q.student_answer_text && !q.student_image_url && (!q.student_selected_option_ids || q.student_selected_option_ids.length === 0) && (
                      <p className="text-slate-400 italic">No answer submitted by candidate for this question.</p>
                    )}
                  </div>

                  {/* Expected Model Answer & Rubric for Subjective Questions */}
                  {(q.expected_answer || q.model_answer) && (
                    <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs space-y-1">
                      <p className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-500" /> Model Answer / Rubric:
                      </p>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {q.model_answer || q.expected_answer}
                      </p>
                    </div>
                  )}

                  {/* AI Preliminary Scoring (if available) */}
                  {q.ai_score !== null && q.ai_score !== undefined && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs flex items-center justify-between text-indigo-900">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>AI Preliminary Suggested Score:</span>
                      </div>
                      <span className="font-bold">{q.ai_score} / {q.marks} Marks</span>
                    </div>
                  )}

                  {/* Manual Grading Inputs for Subjective Questions */}
                  {isSubjective ? (
                    <div className="bg-indigo-50/30 border border-indigo-100 p-4 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label
                            htmlFor={`score-${q.question_id}`}
                            className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
                          >
                            Marks Awarded:
                          </label>
                          <p className="text-[11px] text-slate-500">Enter marks awarded based on answer rubric (0 to {q.marks}).</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            id={`score-${q.question_id}`}
                            type="number"
                            step="0.5"
                            min="0"
                            max={q.marks}
                            value={currentEval.marks}
                            onChange={(e) => handleScoreChange(q.question_id, q.marks, e.target.value)}
                            className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-indigo-700 text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-500">/ {q.marks} pts</span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`feedback-${q.question_id}`}
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Examiner Feedback:
                        </label>
                        <textarea
                          id={`feedback-${q.question_id}`}
                          rows={2}
                          value={currentEval.feedback}
                          onChange={(e) => handleFeedbackChange(q.question_id, e.target.value)}
                          placeholder="Provide constructive feedback or marks justification for this question..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                      <span>Objective question scored automatically.</span>
                      <span className="font-bold text-slate-700">Auto Score: {q.auto_score ?? 0} / {q.marks}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Controls Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 sticky bottom-4 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                id="publishResult"
                type="checkbox"
                checked={publishResult}
                onChange={(e) => setPublishResult(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="publishResult" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Publish result immediately (candidate will immediately be able to view their final score & solutions)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/examiner/results")}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Finalizing Evaluation..." : "Finalize Evaluation"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
