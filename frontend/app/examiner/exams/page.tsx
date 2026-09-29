"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  PlusCircle,
  Search,
  Calendar,
  Clock,
  Trash2,
  Eye,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { examsApi, Exam } from "../../../services/api";
import { useLanguage } from "../../../i18n";

export default function ExamsListPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSubject, setSearchSubject] = useState("");
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await examsApi.list({ subject: searchSubject.trim() || undefined });
      setExams(data);
    } catch (err: any) {
      console.error("Exams list error:", err);
      setError(err.message || "Failed to load examinations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [searchSubject]);

  const handleDelete = async () => {
    if (!deletingExam) return;
    setDeleteLoading(true);
    try {
      await examsApi.delete(deletingExam.id);
      setExams((prev) => prev.filter((e) => e.id !== deletingExam.id));
      setDeletingExam(null);
    } catch (err: any) {
      alert(`Failed to delete examination: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (exam: Exam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    if (now < start) {
      return (
        <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">
          {t("student.upcoming")}
        </span>
      );
    }
    if (now > end) {
      return (
        <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-800 text-slate-400 rounded-full border border-slate-700">
          {t("student.closed")}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        {t("student.openNow")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("nav.exams")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <Link
          href="/examiner/exams/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t("examiner.createExam")}</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#131D33] p-4 rounded-xl border border-slate-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchSubject}
            onChange={(e) => setSearchSubject(e.target.value)}
            placeholder={t("examiner.filterSubject")}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Exams Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
      ) : exams.length === 0 ? (
        <div className="bg-[#131D33] p-12 rounded-xl border border-slate-800 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">{t("examiner.createFirstExam")}</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {t("examiner.subtitle")}
          </p>
          <Link
            href="/examiner/exams/create"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("examiner.createExam")}</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-[#131D33] rounded-2xl border border-slate-800 p-5 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">
                    {exam.subject}
                  </span>
                  {getStatusBadge(exam)}
                </div>

                <h3 className="text-base font-bold text-slate-100 leading-snug">{exam.title}</h3>
                {exam.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{exam.description}</p>
                )}

                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block">{t("student.duration")}</span>
                    <span className="font-semibold text-slate-200">{exam.duration} {t("student.minutes")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t("student.questions")}</span>
                    <span className="font-semibold text-slate-200">{exam.question_count} {t("student.questions")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t("student.proctoring")}</span>
                    <span className="font-semibold text-teal-400">
                      {exam.proctoring_enabled ? t("student.aiActive") : t("student.disabled")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t("instructions.negativePenalty")}</span>
                    <span className="font-semibold text-slate-200">
                      {exam.negative_marking_enabled ? t("common.yes") : t("common.no")}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Start: {new Date(exam.start_time).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <Link
                  href={`/examiner/exams/${exam.id}`}
                  className="flex-1 py-2 bg-[#0B132B] border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-xl text-center transition-colors"
                >
                  {t("common.details")}
                </Link>
                <button
                  onClick={() => setDeletingExam(exam)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                  title={t("common.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-sm rounded-2xl shadow-xl border border-slate-800 p-6 text-center">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">{t("common.delete")}?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Are you sure you want to delete <strong className="text-slate-200">{deletingExam.title}</strong>?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingExam(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-[#0B132B] border border-slate-700 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-800"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteLoading ? t("common.loading") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
