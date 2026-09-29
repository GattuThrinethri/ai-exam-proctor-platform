"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  Award,
  Eye,
  Sliders,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { examsApi, Exam } from "../../../../services/api";
import { useLanguage } from "../../../../i18n";

export default function ExamDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string, 10);

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    examsApi
      .get(examId)
      .then((data) => {
        setExam(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Exam detail load error:", err);
        setError(err.message || "Failed to load exam details.");
        setLoading(false);
      });
  }, [examId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
    );
  }

  if (error || !exam) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm">
        <p className="font-bold">{t("common.error")}</p>
        <p className="mt-1">{error || "Examination not found."}</p>
        <Link
          href="/examiner/exams"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("nav.exams")}</span>
        </Link>
      </div>
    );
  }

  const totalMarks = exam.questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || exam.total_marks || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/examiner/exams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Examinations</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/examiner/results?exam_id=${exam.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B132B] border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-xl shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-teal-400" />
            <span>{t("nav.examResults")}</span>
          </Link>
          {exam.proctoring_enabled && (
            <Link
              href={`/examiner/proctoring?exam_id=${exam.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold rounded-xl shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{t("nav.proctoringReview")}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">
                {exam.subject}
              </span>
              <span className="text-xs text-slate-400">ID: #{exam.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">{exam.title}</h1>
            {exam.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{exam.description}</p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#0B132B] border border-slate-800 rounded-xl">
            <span className="text-slate-500 block">{t("student.duration")}</span>
            <span className="text-lg font-bold text-slate-100">{exam.duration} {t("student.minutes")}</span>
          </div>
          <div className="p-3.5 bg-[#0B132B] border border-slate-800 rounded-xl">
            <span className="text-slate-500 block">{t("student.questions")}</span>
            <span className="text-lg font-bold text-slate-100">{exam.question_count || exam.questions?.length || 0}</span>
          </div>
          <div className="p-3.5 bg-[#0B132B] border border-slate-800 rounded-xl">
            <span className="text-slate-500 block">{t("student.totalMarks")}</span>
            <span className="text-lg font-bold text-emerald-400">{totalMarks} Pts</span>
          </div>
          <div className="p-3.5 bg-[#0B132B] border border-slate-800 rounded-xl">
            <span className="text-slate-500 block">{t("student.passingScore")}</span>
            <span className="text-lg font-bold text-slate-100">{exam.pass_marks || Math.round(totalMarks * 0.4)} Pts</span>
          </div>
        </div>

        {/* Safeguards Info */}
        <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
          <h3 className="font-bold text-slate-100 uppercase tracking-wider text-[11px] mb-2">Configured Rules & Safeguards</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 block">AI Proctoring:</span>
              <span className="font-semibold text-teal-400">{exam.proctoring_enabled ? t("student.aiActive") : t("student.disabled")}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Shuffling:</span>
              <span className="font-semibold text-slate-200">{exam.randomization_enabled ? t("common.yes") : t("common.no")}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Negative Marking:</span>
              <span className="font-semibold text-slate-200">{exam.negative_marking_enabled ? t("common.yes") : t("common.no")}</span>
            </div>
          </div>
        </div>

        {/* Attached Questions Table */}
        {exam.questions && exam.questions.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-100">{t("examiner.questionBank")} ({exam.questions.length})</h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#0B132B] text-slate-300 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">{t("examiner.questionText")}</th>
                    <th className="p-3">{t("examiner.filterType")}</th>
                    <th className="p-3">{t("examiner.marks")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {exam.questions.map((q, idx) => (
                    <tr key={q.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-200">{q.question_text}</td>
                      <td className="p-3 whitespace-nowrap text-slate-400">{q.question_type}</td>
                      <td className="p-3 font-bold text-emerald-400 whitespace-nowrap">+{q.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
