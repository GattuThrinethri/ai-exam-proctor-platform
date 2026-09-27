"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar
} from "lucide-react";
import { authService, AuthUser } from "@/services/auth";
import { studentApi, Exam, StudentResultSummary } from "@/services/api";
import ExamInstructionsModal from "@/components/student/ExamInstructionsModal";
import { useLanguage } from "@/i18n";

export default function StudentDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExamForInstructions, setSelectedExamForInstructions] = useState<Exam | null>(null);
  const [startingExam, setStartingExam] = useState(false);

  useEffect(() => {
    const u = authService.getUser();
    setUser(u);
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [examsData, resultsData] = await Promise.all([
        studentApi.getAvailableExams(),
        studentApi.getMyResults(),
      ]);
      setExams(examsData);
      setResults(resultsData);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenInstructions(exam: Exam) {
    setSelectedExamForInstructions(exam);
  }

  async function handleConfirmStartExam(exam: Exam) {
    setStartingExam(true);
    try {
      const tokRes = await studentApi.generateExamToken(exam.id);
      const session = await studentApi.enterExam(exam.id, tokRes.access_token);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`exam_agreed_${session.id}`, "true");
      }
      setSelectedExamForInstructions(null);
      router.push(`/student/exams/${session.id}/take`);
    } catch (err: any) {
      alert(`Could not enter exam: ${err.message}`);
      setStartingExam(false);
    }
  }

  const now = new Date();
  const activeExams = exams.filter((e) => {
    const s = new Date(e.start_time);
    const end = new Date(e.end_time);
    return now >= s && now <= end;
  });

  const publishedResults = results.filter((r) => r.published && r.total_score !== null);
  const completedCount = results.length;
  const avgScore = publishedResults.length > 0
    ? (publishedResults.reduce((acc, r) => acc + (r.total_score || 0), 0) / publishedResults.length).toFixed(1)
    : "0.0";

  const validPercentiles = results.filter((r) => r.percentile !== null).map((r) => r.percentile as number);
  const bestPercentile = validPercentiles.length > 0 ? Math.max(...validPercentiles).toFixed(1) : "-";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/40 text-indigo-100 border border-indigo-300/30 mb-2">
            {t("common.studentPortal")}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("student.welcome", { name: user?.name || "Student" })}
          </h1>
          <p className="mt-1 text-indigo-100 text-sm max-w-xl">
            {t("student.subtitle")}
          </p>
        </div>

        <Link
          href="/student/exams"
          className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-indigo-50 transition-all shadow-md flex items-center gap-2 shrink-0"
        >
          {t("student.availableExams")} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("common.active")}</p>
            <p className="text-2xl font-bold text-slate-800">{activeExams.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("common.completed")}</p>
            <p className="text-2xl font-bold text-slate-800">{completedCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("student.averageScore")}</p>
            <p className="text-2xl font-bold text-slate-800">{avgScore}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("student.percentage")}</p>
            <p className="text-2xl font-bold text-slate-800">
              {bestPercentile !== "-" ? `${bestPercentile}%` : "-"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Active & Open Examinations Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h2 className="text-base font-semibold text-slate-900">Active Examinations Available Now</h2>
          </div>
          <Link href="/student/exams" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Browse All &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading active examinations...</div>
        ) : activeExams.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No active exams are currently scheduled for your profile. Check the schedule in Available Exams.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeExams.map((exam) => (
              <div key={exam.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      {exam.subject}
                    </span>
                    {exam.proctoring_enabled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <ShieldCheck className="w-3 h-3" /> AI Proctored
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{exam.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.duration} Minutes
                    </span>
                    <span>&bull;</span>
                    <span>{exam.question_count} Questions</span>
                    <span>&bull;</span>
                    <span className="text-emerald-600 font-medium">Available Now</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenInstructions(exam)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 shrink-0"
                >
                  {t("student.enterExam")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Submissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{t("student.myResults")}</h2>
          <Link href="/student/results" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View All Results &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading results...</div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            You haven't completed any examinations yet. Completed submissions will appear here with percentile rankings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Exam Title</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Score / Total</th>
                  <th className="px-6 py-3">Percentage</th>
                  <th className="px-6 py-3">Percentile Rank</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.slice(0, 5).map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{res.exam_title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {res.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {res.published && res.total_score !== null ? (
                        <>
                          {res.total_score} <span className="text-xs font-normal text-slate-400">/ {res.max_score}</span>
                        </>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Evaluation Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {res.published && res.percentage !== null ? (
                        <span className="font-semibold text-indigo-600">{res.percentage}%</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {res.percentile !== null ? `Percentile rank: ${res.percentile}%` : "100.00%"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/student/results/${res.session_id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        Detailed Analysis &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExamInstructionsModal
        isOpen={!!selectedExamForInstructions}
        onClose={() => setSelectedExamForInstructions(null)}
        exam={selectedExamForInstructions}
        onStartExam={handleConfirmStartExam}
        loading={startingExam}
      />
    </div>
  );
}
