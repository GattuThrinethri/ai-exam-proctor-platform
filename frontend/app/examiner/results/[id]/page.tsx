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
import { useLanguage } from "../../../../i18n";

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
  const { t } = useLanguage();
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
      <div className="py-24 text-center text-slate-400 text-sm">
        <div className="w-9 h-9 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="font-medium text-slate-300">{t("common.loading")}</p>
      </div>
    );
  }

  // Error State when sessionData couldn't be loaded
  if (error && !sessionData) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-6 bg-rose-950/40 text-rose-300 rounded-2xl border border-rose-800/80 text-sm space-y-3">
          <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-rose-200">{t("common.error")}</h3>
          <p className="text-xs text-rose-300">{error}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (sessionId) loadEvaluation(sessionId);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t("common.refresh")}
            </button>
            <Link
              href="/examiner/results"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B132B] border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("nav.examResults")}
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
        <div className="p-6 bg-amber-500/10 text-amber-300 rounded-2xl border border-amber-500/20 text-sm">
          <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="font-bold">No Evaluation Found</p>
          <p className="text-xs text-amber-400 mt-1">
            The requested examination session could not be found or has not been submitted yet.
          </p>
          <div className="mt-4">
            <Link
              href="/examiner/results"
              className="text-xs font-bold text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("nav.examResults")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link
            href="/examiner/results"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("nav.examResults")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("examiner.evaluate")}</h1>
            {sessionData.published ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t("examiner.evaluatedStatus")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> {t("common.evaluationPending")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-4 h-4" /> {t("examiner.submittedAt")}:{" "}
          {sessionData.submitted_at ? new Date(sessionData.submitted_at).toLocaleString() : "Auto-submitted"}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Candidate & Exam Metadata Banner */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-400" /> {t("examiner.candidateName")}
          </p>
          <p className="font-bold text-slate-100 text-base">{sessionData.student_name}</p>
          <p className="text-xs text-slate-400">{sessionData.student_email}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-teal-400" /> {t("examiner.examTitle")}
          </p>
          <p className="font-bold text-slate-100 text-base">{sessionData.exam_title}</p>
          <p className="text-xs text-slate-400">{sessionData.subject} • {sessionData.duration_minutes} Mins</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Objective Marks</p>
          <p className="text-xl font-extrabold text-slate-100">
            {(sessionData.objective_score || 0).toFixed(2)}{" "}
            <span className="text-xs font-medium text-slate-400">pts</span>
          </p>
          <p className="text-xs text-slate-500">Auto-evaluated</p>
        </div>

        <div className="space-y-1 bg-[#0B132B] p-3 rounded-xl border border-slate-800">
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> Computed Total
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-100">{computedTotalScore.toFixed(2)}</span>
            <span className="text-xs font-semibold text-slate-400">/ {sessionData.max_score} pts</span>
          </div>
          <p className="text-xs font-bold text-teal-400">{computedPercentage}% Overall</p>
        </div>
      </div>

      {/* Evaluation Form */}
      <form onSubmit={handleFinalize} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">{t("student.questions")} ({sessionData.questions?.length || 0})</h2>
        </div>

        {sessionData.questions?.length === 0 ? (
          <div className="p-12 text-center bg-[#131D33] rounded-2xl border border-slate-800 text-slate-400 text-sm">
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
                  className={`bg-[#131D33] rounded-2xl border p-6 shadow-sm space-y-4 transition-all ${
                    isSubjective
                      ? "border-teal-500/30 ring-1 ring-teal-500/10"
                      : "border-slate-800"
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 uppercase">
                        {displayType}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{t("student.difficulty")}: {q.difficulty}</span>
                      <span className="text-xs font-bold text-slate-300">{t("examiner.marks")}: {q.marks}</span>
                    </div>

                    <div>
                      {isSubjective ? (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {t("evaluation.manualEvaluationNotice")}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Auto Score: {q.auto_score ?? 0} / {q.marks}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-semibold text-slate-100 leading-relaxed">{q.question_text}</p>

                  {/* Candidate's Submitted Response */}
                  <div className="bg-[#0B132B] p-4 rounded-xl space-y-3 text-xs border border-slate-800">
                    <p className="font-semibold text-slate-400 uppercase tracking-wider">{t("examiner.studentAnswer")}:</p>

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
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200 font-medium"
                                  : wasSelected && !isCorrect
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                                  : isCorrect
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                  : "bg-[#131D33] border-slate-800 text-slate-300"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wasSelected ? "bg-teal-500 border-teal-500 text-slate-950" : "border-slate-600"}`}>
                                  {wasSelected && <Check className="w-2.5 h-2.5" />}
                                </span>
                                {opt.option_text}
                              </span>
                              <div className="flex items-center gap-2">
                                {wasSelected && (
                                  <span className="text-[10px] font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                                    {t("student.answered")}
                                  </span>
                                )}
                                {isCorrect && (
                                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    {t("examiner.isCorrect")}
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
                      <div className="p-3.5 bg-[#131D33] rounded-lg border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                        {q.student_answer_text}
                      </div>
                    )}

                    {/* Image Answer */}
                    {q.student_image_url && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-teal-400 font-semibold">
                          <ImageIcon className="w-4 h-4" /> {t("student.handwrittenUpload")}:
                        </div>
                        <img
                          src={q.student_image_url}
                          alt="Handwritten answer sheet"
                          className="max-h-80 rounded-lg border border-slate-800 object-contain bg-[#131D33]"
                        />
                        {q.ocr_extracted_text && (
                          <div className="p-3 bg-[#131D33] rounded-lg border border-slate-800 text-slate-300">
                            <span className="font-semibold text-slate-400 block mb-1">{t("student.ocrText")}:</span>
                            <p className="italic font-mono text-[11px]">{q.ocr_extracted_text}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {!q.student_answer_text && !q.student_image_url && (!q.student_selected_option_ids || q.student_selected_option_ids.length === 0) && (
                      <p className="text-slate-500 italic">{t("student.unanswered")}</p>
                    )}
                  </div>

                  {/* Expected Model Answer & Rubric for Subjective Questions */}
                  {(q.expected_answer || q.model_answer) && (
                    <div className="p-3.5 bg-[#0B132B] border border-slate-800 rounded-xl text-xs space-y-1">
                      <p className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-teal-400" /> {t("examiner.modelAnswer")}:
                      </p>
                      <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {q.model_answer || q.expected_answer}
                      </p>
                    </div>
                  )}

                  {/* AI Preliminary Scoring (if available) */}
                  {q.ai_score !== null && q.ai_score !== undefined && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs flex items-center justify-between text-purple-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>AI Preliminary Suggested Score:</span>
                      </div>
                      <span className="font-bold">{q.ai_score} / {q.marks} Marks</span>
                    </div>
                  )}

                  {/* Manual Grading Inputs for Subjective Questions */}
                  {isSubjective ? (
                    <div className="bg-[#0B132B] border border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label
                            htmlFor={`score-${q.question_id}`}
                            className="block text-xs font-bold text-slate-200 uppercase tracking-wider"
                          >
                            {t("examiner.awardedMarks")}:
                          </label>
                          <p className="text-[11px] text-slate-400">Enter marks awarded based on answer rubric (0 to {q.marks}).</p>
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
                            className="w-24 px-3 py-2 bg-[#131D33] border border-slate-700 rounded-xl text-sm font-bold text-teal-300 text-center focus:border-teal-500 focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-400">/ {q.marks} pts</span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`feedback-${q.question_id}`}
                          className="block text-xs font-semibold text-slate-300 mb-1"
                        >
                          {t("evaluation.examinerFeedback")}:
                        </label>
                        <textarea
                          id={`feedback-${q.question_id}`}
                          rows={2}
                          value={currentEval.feedback}
                          onChange={(e) => handleFeedbackChange(q.question_id, e.target.value)}
                          placeholder="Provide constructive feedback or marks justification..."
                          className="w-full px-3 py-2 bg-[#131D33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none resize-y"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                      <span>Objective question scored automatically.</span>
                      <span className="font-bold text-slate-200">Auto Score: {q.auto_score ?? 0} / {q.marks}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Controls Card */}
        <div className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm space-y-4 sticky bottom-4 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                id="publishResult"
                type="checkbox"
                checked={publishResult}
                onChange={(e) => setPublishResult(e.target.checked)}
                className="w-4 h-4 text-teal-500 rounded border-slate-700 focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="publishResult" className="text-xs font-semibold text-slate-200 cursor-pointer">
                Publish result immediately (candidate will be able to view their final score)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/examiner/results")}
                className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? t("evaluation.savingEvaluation") : t("evaluation.finalizeEvaluation")}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
