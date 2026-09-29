"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  ArrowRight,
  Search,
  AlertCircle
} from "lucide-react";
import { studentApi, Exam } from "@/services/api";
import ExamInstructionsModal from "@/components/student/ExamInstructionsModal";
import { useLanguage } from "@/i18n";

export default function StudentExamsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "upcoming" | "closed">("all");
  const [selectedExamForInstructions, setSelectedExamForInstructions] = useState<Exam | null>(null);
  const [startingExam, setStartingExam] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    setLoading(true);
    setError(null);
    try {
      const data = await studentApi.getAvailableExams();
      setExams(data);
    } catch (err: any) {
      setError(err.message || "Failed to load exams");
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
  const subjects = Array.from(new Set(exams.map((e) => e.subject)));

  const filteredExams = exams.filter((e) => {
    const s = new Date(e.start_time);
    const end = new Date(e.end_time);

    let statusMatch = true;
    if (statusFilter === "active") statusMatch = now >= s && now <= end;
    if (statusFilter === "upcoming") statusMatch = now < s;
    if (statusFilter === "closed") statusMatch = now > end;

    const subjectMatch = !subjectFilter || e.subject.toLowerCase() === subjectFilter.toLowerCase();
    const searchMatch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.subject.toLowerCase().includes(search.toLowerCase());

    return statusMatch && subjectMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("student.availableExams")}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t("student.subtitle")}
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#131D33] p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:border-teal-500 placeholder-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("examiner.allSubjects")}</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-[#0B132B] p-1 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "all" ? "bg-teal-500 text-slate-950 shadow-sm" : "hover:text-slate-100"}`}
            >
              {t("common.all")}
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "active" ? "bg-teal-500 text-slate-950 shadow-sm" : "hover:text-slate-100"}`}
            >
              {t("common.active")}
            </button>
            <button
              onClick={() => setStatusFilter("upcoming")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "upcoming" ? "bg-teal-500 text-slate-950 shadow-sm" : "hover:text-slate-100"}`}
            >
              {t("student.upcoming")}
            </button>
            <button
              onClick={() => setStatusFilter("closed")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "closed" ? "bg-teal-500 text-slate-950 shadow-sm" : "hover:text-slate-100"}`}
            >
              {t("student.closed")}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-[#131D33] p-12 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm shadow-sm">
          {t("student.noExams")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => {
            const s = new Date(exam.start_time);
            const e = new Date(exam.end_time);
            const isActive = now >= s && now <= e;
            const isUpcoming = now < s;
            const isClosed = now > e;

            return (
              <div
                key={exam.id}
                className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {exam.subject}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> {t("student.openNow")}
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {t("student.upcoming")}
                      </span>
                    )}
                    {isClosed && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        {t("student.closed")}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-100 leading-snug">{exam.title}</h3>
                  {exam.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{exam.description}</p>
                  )}

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-400 block">{t("student.duration")}</span>
                      <span className="font-semibold text-slate-200">{exam.duration} {t("student.minutes")}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{t("student.questions")}</span>
                      <span className="font-semibold text-slate-200">{exam.question_count} {t("student.questions")}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{t("student.proctoring")}</span>
                      <span className="font-semibold text-teal-400">
                        {exam.proctoring_enabled ? t("student.aiActive") : t("student.disabled")}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{t("instructions.negativePenalty")}</span>
                      <span className="font-semibold text-slate-200">
                        {exam.negative_marking_enabled ? t("common.yes") : t("common.no")}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                    {s.toLocaleDateString()} {s.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} &ndash; {e.toLocaleDateString()} {e.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-800">
                  {isActive ? (
                    <button
                      onClick={() => handleOpenInstructions(exam)}
                      className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {t("student.enterExam")} <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : isUpcoming ? (
                    <div className="text-center py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      {t("student.upcoming")}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs font-medium text-slate-400 bg-slate-800/50 rounded-xl border border-slate-800">
                      {t("student.closed")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pre-Exam Instructions & Guidelines Modal */}
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
