"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Award,
  Clock,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  FileText,
  Sparkles,
  Image as ImageIcon
} from "lucide-react";
import { studentApi, StudentResultDetail } from "@/services/api";
import { useLanguage } from "@/i18n";

export default function StudentResultDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const sessionId = Number(params.id);

  const [result, setResult] = useState<StudentResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSessionResult();
    }
  }, [sessionId]);

  async function loadSessionResult() {
    setLoading(true);
    setError(null);
    try {
      const data = await studentApi.getSessionResult(sessionId);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to load result analysis");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Loading candidate performance analysis...
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || "Result not found"}
        </div>
        <Link href="/student/results" className="text-sm text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to My Results
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/student/results"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Results
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{result.exam_title}</h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {result.subject}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-4 h-4" /> Submitted: {new Date(result.submitted_at || result.generated_at).toLocaleString()}
        </div>
      </div>

      {/* Primary Analytics Scorecard / Status Banner */}
      {!result.published ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-50/80 border border-amber-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-200/80 text-amber-900">
                    <Clock className="w-3.5 h-3.5" /> {t("common.evaluationPending")}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5" /> {t("common.submitted")}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-2">{t("evaluation.pendingTitle")}</h2>
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                  {t("evaluation.pendingDesc")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase">{t("student.totalMarks")}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{result.max_score} pts</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase">{t("student.questions")}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{result.question_reviews?.length || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
              <p className="text-sm font-bold text-amber-700 mt-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Awaiting Examiner Finalization
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Total Score */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Score</p>
            <div className="my-2">
              <span className="text-3xl font-extrabold text-slate-900">{result.total_score}</span>
              <span className="text-sm font-medium text-slate-400 ml-1">/ {result.max_score}</span>
            </div>
            <p className="text-xs font-semibold text-indigo-600">Overall Percentage: {result.percentage}%</p>
          </div>

          {/* Percentile Rank */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Percentile Standing</p>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-700">
                {result.percentile !== null ? `${result.percentile}%` : "100.0%"}
              </span>
              <TrendingUp className="w-5 h-5 text-purple-600 shrink-0" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Percentile rank: {result.percentile !== null ? `${result.percentile}%` : "100.0%"}</p>
          </div>

          {/* Objective vs Subjective */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Score Breakdown</p>
            <div className="space-y-1.5 my-1.5 text-xs font-medium">
              <div className="flex justify-between text-slate-700">
                <span>Objective (Auto):</span>
                <span className="font-bold text-slate-900">{result.objective_score ?? 0} pts</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Subjective:</span>
                <span className="font-bold text-slate-900">{result.subjective_score ?? 0} pts</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, ((result.objective_score || 0) / (result.total_score || 1)) * 100))}%` }}
              ></div>
            </div>
          </div>

          {/* Proctoring Integrity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proctoring Integrity</p>
            <div className="my-2 flex items-center gap-2">
              {(result.suspicion_score || 0) < 20 ? (
                <>
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">Verified Record</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Requires Review</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500">Suspicion score: {result.suspicion_score || 0} / 100</p>
          </div>
        </div>
      )}

      {/* Question-by-Question Solution & Feedback Review */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          {result.published ? "Question-Level Evaluation Breakdown" : "Submitted Examination Responses"}
        </h2>

        <div className="space-y-4">
          {result.question_reviews.map((q, idx) => {
            const isFullMarks = q.awarded_score !== null && q.awarded_score >= q.marks && q.marks > 0;
            const isZeroMarks = q.awarded_score !== null && q.awarded_score <= 0;

            return (
              <div key={q.question_id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase">
                      {q.question_type}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">Difficulty: {q.difficulty}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.published ? (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isFullMarks
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isZeroMarks
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        Awarded: {q.awarded_score} / {q.marks} Marks
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Evaluation Pending ({q.marks} Marks)
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{q.question_text}</p>

                {/* Candidate's Submitted Response */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-100">
                  <p className="font-semibold text-slate-500 uppercase tracking-wider">Your Submitted Response</p>

                  {/* Options (MCQ / Multi-Select) */}
                  {q.options && q.options.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt) => {
                        const wasSelected = q.student_selected_option_ids?.includes(opt.id);
                        const isCorrect = opt.is_correct;

                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-lg border flex items-center justify-between ${
                              wasSelected && isCorrect === true
                                ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                                : wasSelected && isCorrect === false
                                ? "bg-red-50/80 border-red-300 text-red-900"
                                : wasSelected
                                ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wasSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                                {wasSelected && <CheckCircle className="w-2.5 h-2.5" />}
                              </span>
                              {opt.option_text}
                            </span>

                            {wasSelected && (
                              <span className="text-[11px] font-semibold text-indigo-700 bg-white/70 px-2 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Answer */}
                  {q.student_answer_text && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {q.student_answer_text}
                    </div>
                  )}

                  {/* Image Answer Preview & OCR */}
                  {q.student_image_url && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                        <ImageIcon className="w-4 h-4" /> Uploaded Handwritten Answer Sheet:
                      </div>
                      <img
                        src={q.student_image_url}
                        alt="Handwritten answer"
                        className="max-h-60 rounded-lg border border-slate-200 object-contain bg-white"
                      />
                      {q.ocr_extracted_text && (
                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700">
                          <span className="font-semibold text-slate-500 block mb-1">OCR Extracted Text:</span>
                          <p className="italic font-mono text-[11px]">{q.ocr_extracted_text}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!q.student_answer_text && !q.student_image_url && (!q.student_selected_option_ids || q.student_selected_option_ids.length === 0) && (
                    <p className="text-slate-400 italic">No answer submitted for this question.</p>
                  )}
                </div>

                {/* Published Solutions & AI Feedback */}
                {result.published && (
                  <div className="space-y-2.5 pt-2">
                    {(q.correct_options_text || q.model_answer) && (
                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                        <p className="font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Correct Solution / Model Answer
                        </p>
                        {q.correct_options_text && (
                          <p className="font-medium">{q.correct_options_text.join(", ")}</p>
                        )}
                        {q.model_answer && (
                          <p className="leading-relaxed text-slate-700 mt-1">{q.model_answer}</p>
                        )}
                      </div>
                    )}

                    {(q.ai_justification || q.ai_feedback) && (
                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1.5">
                        <p className="font-semibold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Evaluator Feedback
                        </p>
                        {q.ai_justification && (
                          <p className="text-slate-700 leading-relaxed"><span className="font-semibold">Justification:</span> {q.ai_justification}</p>
                        )}
                        {q.ai_feedback && (
                          <p className="text-slate-700 leading-relaxed"><span className="font-semibold">Feedback:</span> {typeof q.ai_feedback === 'string' ? q.ai_feedback : JSON.stringify(q.ai_feedback)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
