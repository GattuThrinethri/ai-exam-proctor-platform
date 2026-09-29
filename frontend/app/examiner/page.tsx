"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileSpreadsheet,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { examinerApi, examsApi, ExaminerStats, Exam } from "../../services/api";
import { useLanguage } from "../../i18n";

export default function ExaminerDashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<ExaminerStats | null>(null);
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, examsData] = await Promise.all([
        examinerApi.getDashboardStats(),
        examsApi.list(),
      ]);
      setStats(statsData);
      setRecentExams(examsData.slice(0, 5));
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: t("examiner.questionBank"),
      value: stats?.total_questions ?? 0,
      label: t("examiner.totalQuestions"),
      icon: BookOpen,
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      href: "/examiner/questions",
    },
    {
      title: t("examiner.totalExams"),
      value: stats?.total_exams ?? 0,
      label: t("examiner.totalExams"),
      icon: FileSpreadsheet,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      href: "/examiner/exams",
    },
    {
      title: t("common.active"),
      value: stats?.active_exams ?? 0,
      label: t("student.openNow"),
      icon: Activity,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      href: "/examiner/exams",
    },
    {
      title: t("common.completed"),
      value: stats?.completed_exams ?? 0,
      label: t("student.closed"),
      icon: CheckCircle2,
      color: "text-slate-300 bg-slate-800/80 border-slate-700",
      href: "/examiner/exams",
    },
    {
      title: t("examiner.pendingEvaluations"),
      value: stats?.pending_evaluations ?? 0,
      label: t("common.evaluationPending"),
      icon: Clock,
      color: "text-amber-300 bg-amber-500/10 border-amber-500/20",
      href: "/examiner/results",
    },
    {
      title: t("nav.proctoringReview"),
      value: stats?.flagged_sessions ?? 0,
      label: t("student.proctoring"),
      icon: ShieldAlert,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      href: "/examiner/proctoring",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("examiner.dashboard")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 text-slate-300 hover:text-white bg-[#131D33] border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
            title={t("common.refresh")}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/examiner/questions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-200 bg-[#131D33] border border-slate-800 rounded-xl hover:bg-slate-800 shadow-sm transition-colors"
          >
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span>{t("examiner.questionBank")}</span>
          </Link>
          <Link
            href="/examiner/exams/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("examiner.createExam")}</span>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">{t("common.error")}</p>
            <p className="text-rose-400 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-500"
          >
            {t("common.refresh")}
          </button>
        </div>
      )}

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className="bg-[#131D33] p-5 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {card.title}
                  </span>
                  <div className="text-3xl font-extrabold text-slate-100 mt-2">
                    {loading ? (
                      <div className="h-9 w-16 bg-slate-800 rounded animate-pulse"></div>
                    ) : (
                      card.value
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{card.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Examinations List */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t("examiner.recentExaminations")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("examiner.subtitle")}</p>
          </div>
          <Link
            href="/examiner/exams"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
          >
            <span>{t("student.browseAll")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : recentExams.length === 0 ? (
          <div className="p-12 text-center">
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
          <div className="divide-y divide-slate-800/80">
            {recentExams.map((exam) => (
              <div
                key={exam.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 truncate">{exam.title}</span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">
                      {exam.subject}
                    </span>
                    {exam.proctoring_enabled && (
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">
                        {t("student.proctoring")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5 flex-wrap">
                    <span>{t("student.duration")}: {exam.duration} {t("student.minutes")}</span>
                    <span>•</span>
                    <span>{t("student.questions")}: {exam.question_count}</span>
                    <span>•</span>
                    <span>Start: {new Date(exam.start_time).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/examiner/exams/${exam.id}`}
                    className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    {t("common.details")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
