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

export default function ExamsListPage() {
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
        <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
          Upcoming
        </span>
      );
    }
    if (now > end) {
      return (
        <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
          Closed
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Active Now
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Examinations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure examination schedules, attach questions from the bank, and monitor sessions.
          </p>
        </div>
        <Link
          href="/examiner/exams/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Examination</span>
        </Link>
      </div>

      {/* Search / Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchSubject}
            onChange={(e) => setSearchSubject(e.target.value)}
            placeholder="Filter by subject..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        {searchSubject && (
          <button
            onClick={() => setSearchSubject("")}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Exams Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading examinations...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No examinations found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by launching an examination using our multi-step exam builder.
            </p>
            <Link
              href="/examiner/exams/create"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Exam</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Title & Subject</th>
                  <th className="py-3.5 px-4">Schedule Window</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Questions</th>
                  <th className="py-3.5 px-4">Proctoring</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/examiner/exams/${exam.id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                      >
                        {exam.title}
                      </Link>
                      <p className="text-[11px] text-slate-500 mt-0.5">{exam.subject}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(exam.start_time).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(exam.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(exam.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{exam.duration} mins</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{exam.question_count} questions</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {exam.proctoring_enabled ? (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                          {exam.gaze_sensitivity} sensitivity
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Disabled</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(exam)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <Link
                        href={`/examiner/exams/${exam.id}`}
                        className="inline-flex p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setDeletingExam(exam)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Delete Exam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Exam Confirmation Modal */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Examination?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to delete <span className="font-semibold text-slate-700">"{deletingExam.title}"</span>? All linked session references will be removed.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingExam(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
