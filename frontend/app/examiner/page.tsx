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

export default function ExaminerDashboardPage() {
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
      title: "Question Bank",
      value: stats?.total_questions ?? 0,
      label: "Total Questions Available",
      icon: BookOpen,
      color: "text-blue-600 bg-blue-50 border-blue-100",
      href: "/examiner/questions",
    },
    {
      title: "Total Exams",
      value: stats?.total_exams ?? 0,
      label: "Exams Configured",
      icon: FileSpreadsheet,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
      href: "/examiner/exams",
    },
    {
      title: "Active Exams",
      value: stats?.active_exams ?? 0,
      label: "Currently Open for Students",
      icon: Activity,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      href: "/examiner/exams",
    },
    {
      title: "Completed Exams",
      value: stats?.completed_exams ?? 0,
      label: "Exam Windows Closed",
      icon: CheckCircle2,
      color: "text-slate-600 bg-slate-50 border-slate-200",
      href: "/examiner/exams",
    },
    {
      title: "Pending Evaluations",
      value: stats?.pending_evaluations ?? 0,
      label: "Awaiting Result Aggregation",
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-100",
      href: "/examiner/results",
    },
    {
      title: "Flagged Sessions",
      value: stats?.flagged_sessions ?? 0,
      label: "Proctoring Review Recommended",
      icon: ShieldAlert,
      color: "text-rose-600 bg-rose-50 border-rose-100",
      href: "/examiner/proctoring",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Examiner Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time overview of examinations, candidate sessions, and proctoring telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/examiner/questions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Question Bank</span>
          </Link>
          <Link
            href="/examiner/exams/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Exam</span>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <p className="font-semibold">Unable to fetch dashboard metrics</p>
            <p className="text-rose-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700"
          >
            Retry
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
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {card.title}
                  </span>
                  <div className="text-3xl font-extrabold text-slate-900 mt-2">
                    {loading ? (
                      <div className="h-9 w-16 bg-slate-200 rounded animate-pulse"></div>
                    ) : (
                      card.value
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{card.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Examinations List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Examinations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recently configured examinations and their schedules.</p>
          </div>
          <Link
            href="/examiner/exams"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading recent examinations...</div>
        ) : recentExams.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No examinations created yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by creating your first online examination with randomized question paper generation.
            </p>
            <Link
              href="/examiner/exams/create"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Exam</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentExams.map((exam) => (
              <div
                key={exam.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 truncate">{exam.title}</span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                      {exam.subject}
                    </span>
                    {exam.proctoring_enabled && (
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                        Proctored
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                    <span>Duration: {exam.duration} mins</span>
                    <span>•</span>
                    <span>Questions: {exam.question_count}</span>
                    <span>•</span>
                    <span>Start: {new Date(exam.start_time).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/examiner/exams/${exam.id}`}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    View Details
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
