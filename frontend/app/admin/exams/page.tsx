"use client";

import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Trash2,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
  Users
} from "lucide-react";
import { adminApi, AdminExam } from "@/services/api";

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadExams();
  }, [subjectFilter]);

  async function loadExams() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getExams({ subject: subjectFilter || undefined });
      setExams(data);
    } catch (err: any) {
      setError(err.message || "Failed to load global exams");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteExam(examId: number, title: string) {
    if (!confirm(`Are you sure you want to administratively delete "${title}" (ID ${examId})? This will delete all attached questions and candidate sessions.`)) {
      return;
    }

    setDeletingId(examId);
    try {
      await adminApi.deleteExam(examId);
      loadExams();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const subjects = Array.from(new Set(exams.map((e) => e.subject)));
  const filteredExams = exams.filter((e) => {
    if (!search) return true;
    const pat = search.toLowerCase();
    return e.title.toLowerCase().includes(pat) || e.creator_name.toLowerCase().includes(pat) || e.creator_email.toLowerCase().includes(pat);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Global Examination Oversight</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor all examination configurations created across examiners, candidate participation counts, and administrative deletion.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or examiner..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading examinations oversight...</div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No examinations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Exam Title</th>
                  <th className="px-6 py-3.5">Examiner / Creator</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Candidates</th>
                  <th className="px-6 py-3.5">Window Status</th>
                  <th className="px-6 py-3.5 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900 leading-tight">{exam.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {exam.subject}
                          </span>
                          {exam.proctoring_enabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              <ShieldCheck className="w-3 h-3" /> Proctored
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">{exam.creator_name}</p>
                        <p className="text-slate-400">{exam.creator_email}</p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-700 font-semibold">
                      {exam.duration} Minutes
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Users className="w-3.5 h-3.5" /> {exam.candidate_count} Candidates
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {exam.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active Now
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Inactive Window</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        disabled={deletingId === exam.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
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
    </div>
  );
}
