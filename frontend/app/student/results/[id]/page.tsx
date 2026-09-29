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
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        {t("common.loading")}
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-4 bg-rose-950/40 text-rose-300 rounded-2xl border border-rose-800/80 text-sm flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || t("common.error")}
        </div>
        <Link href="/student/results" className="text-sm text-teal-400 font-semibold hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("student.myResults")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link
            href="/student/results"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("student.myResults")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{result.exam_title}</h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              {result.subject}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-4 h-4" /> {t("examiner.submittedAt")}: {new Date(result.submitted_at || result.generated_at).toLocaleString()}
        </div>
      </div>

      {/* Evaluation Pending Screen */}
      {!result.published ? (
        <div className="bg-[#131D33] rounded-3xl border border-slate-800 p-8 sm:p-10 shadow-xl space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-md">
            <Clock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">{t("evaluation.submissionStatusPending")}</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg mx-auto">
              {t("evaluation.pendingResultsDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 font-bold text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{t("evaluation.submissionStatusSuccess")}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center gap-2 text-amber-300 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{t("evaluation.submissionStatusPending")}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0B132B] border border-slate-800 text-xs text-slate-400 space-y-1 text-left">
            <p><span className="font-semibold text-slate-300">{t("examiner.examTitle")}:</span> {result.exam_title}</p>
            <p><span className="font-semibold text-slate-300">{t("examiner.subject")}:</span> {result.subject}</p>
            <p><span className="font-semibold text-slate-300">{t("examiner.submittedAt")}:</span> {new Date(result.submitted_at || result.generated_at).toLocaleString()}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              href="/student"
              className="w-full sm:flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-sm font-bold transition-colors shadow-md flex items-center justify-center"
            >
              {t("evaluation.returnToDashboard")}
            </Link>
            <Link
              href="/student/results"
              className="w-full sm:flex-1 py-3 bg-[#0B132B] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
            >
              {t("student.myResults")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Total Score */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.score")}</p>
            <div className="my-2">
              <span className="text-3xl font-extrabold text-slate-100">{result.total_score}</span>
              <span className="text-sm font-medium text-slate-400 ml-1">/ {result.max_score}</span>
            </div>
            <p className="text-xs font-semibold text-teal-400">{t("student.percentage")}: {result.percentage}%</p>
          </div>

          {/* Percentile Rank */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.percentileRank")}</p>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-400">
                {result.percentile !== null ? `${result.percentile}%` : "100.0%"}
              </span>
              <TrendingUp className="w-5 h-5 text-purple-400 shrink-0" />
            </div>
            <p className="text-xs text-slate-400 font-medium">{t("student.percentileRank")}: {result.percentile !== null ? `${result.percentile}%` : "100.0%"}</p>
          </div>

          {/* Objective vs Subjective */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.detailedAnalysis")}</p>
            <div className="space-y-1.5 my-1.5 text-xs font-medium">
              <div className="flex justify-between text-slate-300">
                <span>Objective:</span>
                <span className="font-bold text-slate-100">{result.objective_score ?? 0} pts</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Subjective:</span>
                <span className="font-bold text-slate-100">{result.subjective_score ?? 0} pts</span>
              </div>
            </div>
            <div className="w-full bg-[#0B132B] rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="bg-teal-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, ((result.objective_score || 0) / (result.total_score || 1)) * 100))}%` }}
              ></div>
            </div>
          </div>

          {/* Proctoring Integrity */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.proctoring")}</p>
            <div className="my-2 flex items-center gap-2">
              {(result.suspicion_score || 0) < 20 ? (
                <>
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-300">Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                  <span className="text-sm font-bold text-amber-300">Reviewed</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400">Suspicion: {result.suspicion_score || 0} / 100</p>
          </div>
        </div>
      )}

      {/* Question-by-Question Solution & Feedback Review */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-100 tracking-tight">
          {result.published ? t("student.detailedAnalysis") : t("student.resultDetails")}
        </h2>

        <div className="space-y-4">
          {result.question_reviews.map((q, idx) => {
            const isFullMarks = q.awarded_score !== null && q.awarded_score >= q.marks && q.marks > 0;
            const isZeroMarks = q.awarded_score !== null && q.awarded_score <= 0;

            return (
              <div key={q.question_id} className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 uppercase">
                      {q.question_type}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{t("student.difficulty")}: {q.difficulty}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.published ? (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isFullMarks
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : isZeroMarks
                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                          : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      }`}>
                        {t("examiner.awardedMarks")}: {q.awarded_score} / {q.marks}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t("common.evaluationPending")} ({q.marks} {t("student.marks")})
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text (Preserved in original created language) */}
                <p className="text-sm font-medium text-slate-200 leading-relaxed">{q.question_text}</p>

                {/* Candidate's Submitted Response */}
                <div className="bg-[#0B132B] p-4 rounded-xl space-y-2 text-xs border border-slate-800">
                  <p className="font-semibold text-slate-400 uppercase tracking-wider">{t("examiner.studentAnswer")}</p>

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
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                                : wasSelected && isCorrect === false
                                ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                                : wasSelected
                                ? "bg-teal-500/10 border-teal-500/30 text-teal-200 font-semibold"
                                : "bg-[#131D33] border-slate-800 text-slate-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wasSelected ? "bg-teal-500 border-teal-500 text-slate-950" : "border-slate-600"}`}>
                                {wasSelected && <CheckCircle className="w-2.5 h-2.5" />}
                              </span>
                              {opt.option_text}
                            </span>

                            {wasSelected && (
                              <span className="text-[11px] font-semibold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                                {t("student.answered")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Answer */}
                  {q.student_answer_text && (
                    <div className="p-3 bg-[#131D33] rounded-lg border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {q.student_answer_text}
                    </div>
                  )}

                  {/* Image Answer Preview & OCR */}
                  {q.student_image_url && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2 text-teal-400 font-semibold">
                        <ImageIcon className="w-4 h-4" /> {t("student.handwrittenUpload")}:
                      </div>
                      <img
                        src={q.student_image_url}
                        alt="Handwritten answer"
                        className="max-h-60 rounded-lg border border-slate-800 object-contain bg-[#131D33]"
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

                {/* Published Solutions & AI Feedback */}
                {result.published && (
                  <div className="space-y-2.5 pt-2">
                    {(q.correct_options_text || q.model_answer) && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200 space-y-1">
                        <p className="font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {t("examiner.correctAnswer")} / {t("examiner.modelAnswer")}
                        </p>
                        {q.correct_options_text && (
                          <p className="font-medium">{q.correct_options_text.join(", ")}</p>
                        )}
                        {q.model_answer && (
                          <p className="leading-relaxed text-slate-300 mt-1">{q.model_answer}</p>
                        )}
                      </div>
                    )}

                    {(q.ai_justification || q.ai_feedback) && (
                      <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-200 space-y-1.5">
                        <p className="font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" /> {t("evaluation.examinerFeedback")}
                        </p>
                        {q.ai_justification && (
                          <p className="text-slate-300 leading-relaxed"><span className="font-semibold">Justification:</span> {q.ai_justification}</p>
                        )}
                        {q.ai_feedback && (
                          <p className="text-slate-300 leading-relaxed"><span className="font-semibold">Feedback:</span> {typeof q.ai_feedback === 'string' ? q.ai_feedback : JSON.stringify(q.ai_feedback)}</p>
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
