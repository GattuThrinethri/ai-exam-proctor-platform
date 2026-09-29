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
      <div className="bg-gradient-to-r from-[#131d33] via-[#162238] to-[#1a2744] rounded-2xl p-6 sm:p-8 text-white border border-[#1e2d4a] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-950/80 text-teal-300 border border-teal-500/40 mb-2">
            {t("common.studentPortal")}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("student.welcome", { name: user?.name || "Student" })}
          </h1>
          <p className="mt-1 text-slate-300 text-sm max-w-xl">
            {t("student.subtitle")}
          </p>
        </div>

        <Link
          href="/student/exams"
          className="px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all shadow-md flex items-center gap-2 shrink-0"
        >
          {t("student.availableExams")} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#131d33] p-5 rounded-2xl border border-[#1e2d4a] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-950/80 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("common.active")}</p>
            <p className="text-2xl font-extrabold text-white">{activeExams.length}</p>
          </div>
        </div>

        <div className="bg-[#131d33] p-5 rounded-2xl border border-[#1e2d4a] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("common.completed")}</p>
            <p className="text-2xl font-extrabold text-white">{completedCount}</p>
          </div>
        </div>

        <div className="bg-[#131d33] p-5 rounded-2xl border border-[#1e2d4a] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-950/80 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.averageScore")}</p>
            <p className="text-2xl font-extrabold text-white">{avgScore}</p>
          </div>
        </div>

        <div className="bg-[#131d33] p-5 rounded-2xl border border-[#1e2d4a] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-950/80 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("student.percentileRank")}</p>
            <p className="text-2xl font-extrabold text-white">
              {bestPercentile !== "-" ? `${bestPercentile}%` : "-"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/60 border border-rose-800/60 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Active Examinations Section */}
      <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></div>
            <h2 className="text-base font-bold text-white">{t("student.activeExamsAvailable")}</h2>
          </div>
          <Link href="/student/exams" className="text-xs font-semibold text-teal-400 hover:text-teal-300">
            {t("student.browseAll")} &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : activeExams.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {t("student.noExams")}
          </div>
        ) : (
          <div className="divide-y divide-[#1e2d4a]">
            {activeExams.map((exam) => (
              <div key={exam.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[#162238] transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#1a2744] text-slate-200 border border-[#1e2d4a]">
                      {exam.subject}
                    </span>
                    {exam.proctoring_enabled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-teal-950/60 text-teal-300 border border-teal-500/30">
                        <ShieldCheck className="w-3 h-3 text-teal-400" /> {t("student.proctoring")} ({t("student.aiActive")})
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white">{exam.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.duration} {t("student.minutes")}
                    </span>
                    <span>&bull;</span>
                    <span>{exam.question_count} {t("student.questions")}</span>
                    <span>&bull;</span>
                    <span className="text-teal-400 font-medium">{t("student.openNow")}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenInstructions(exam)}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-colors shadow-md flex items-center gap-2 shrink-0"
                >
                  {t("student.enterExam")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Submissions Table */}
      <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{t("student.myResults")}</h2>
          <Link href="/student/results" className="text-xs font-semibold text-teal-400 hover:text-teal-300">
            {t("student.browseAll")} &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {t("student.noResults")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0f172a] text-slate-400 text-xs uppercase font-semibold border-b border-[#1e2d4a]">
                <tr>
                  <th className="px-6 py-3.5">{t("examiner.examTitle")}</th>
                  <th className="px-6 py-3.5">{t("examiner.subject")}</th>
                  <th className="px-6 py-3.5">{t("student.score")}</th>
                  <th className="px-6 py-3.5">{t("student.percentage")}</th>
                  <th className="px-6 py-3.5">{t("student.percentileRank")}</th>
                  <th className="px-6 py-3.5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {results.slice(0, 5).map((res) => (
                  <tr key={res.id} className="hover:bg-[#162238] transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{res.exam_title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#162238] text-slate-300 border border-[#1e2d4a]">
                        {res.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {res.published && res.total_score !== null ? (
                        <>
                          {res.total_score} <span className="text-xs font-normal text-slate-400">/ {res.max_score}</span>
                        </>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-800/40">
                          {t("common.evaluationPending")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {res.published && res.percentage !== null ? (
                        <span className="font-semibold text-teal-400">{res.percentage}%</span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">{t("common.pending")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40">
                        {res.percentile !== null ? `${res.percentile}%` : "100.00%"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/student/results/${res.session_id}`}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                      >
                        {t("student.detailedAnalysis")} &rarr;
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
