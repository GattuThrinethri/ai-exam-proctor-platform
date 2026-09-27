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

export default function StudentExamsPage() {
  const router = useRouter();
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Available Examinations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse scheduled test windows and enter live examinations with automated proctoring.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by exam title or subject..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "all" ? "bg-white text-indigo-600 shadow-sm" : "hover:text-slate-900"}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "active" ? "bg-white text-indigo-600 shadow-sm" : "hover:text-slate-900"}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("upcoming")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "upcoming" ? "bg-white text-indigo-600 shadow-sm" : "hover:text-slate-900"}`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setStatusFilter("closed")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === "closed" ? "bg-white text-indigo-600 shadow-sm" : "hover:text-slate-900"}`}
            >
              Closed
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading examinations...</div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm shadow-sm">
          No examinations match your current filters.
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
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {exam.subject}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Open Now
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Upcoming
                      </span>
                    )}
                    {isClosed && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                        Closed
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{exam.title}</h3>
                  {exam.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{exam.description}</p>
                  )}

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block">Duration</span>
                      <span className="font-semibold text-slate-800">{exam.duration} Minutes</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Questions</span>
                      <span className="font-semibold text-slate-800">{exam.question_count} Questions</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Proctoring</span>
                      <span className="font-semibold text-slate-800">
                        {exam.proctoring_enabled ? "AI Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Negative Marks</span>
                      <span className="font-semibold text-slate-800">
                        {exam.negative_marking_enabled ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    Window: {s.toLocaleDateString()} {s.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} &ndash; {e.toLocaleDateString()} {e.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100">
                  {isActive ? (
                    <button
                      onClick={() => handleOpenInstructions(exam)}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      Enter Examination <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : isUpcoming ? (
                    <div className="text-center py-2 text-xs font-semibold text-amber-600 bg-amber-50 rounded-xl">
                      Examination has not opened yet
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs font-medium text-slate-400 bg-slate-50 rounded-xl">
                      Exam Window Expired
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
