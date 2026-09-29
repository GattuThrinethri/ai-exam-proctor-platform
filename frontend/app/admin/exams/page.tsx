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
import { useLanguage } from "@/i18n";

export default function AdminExamsPage() {
  const { t } = useLanguage();
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
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("admin.examOversight")}</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor all examination configurations created across examiners and candidate participation counts.
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

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

        <div className="flex items-center gap-3 w-full sm:w-auto">
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
        </div>
      </div>

      {/* Global Exams Table */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No examinations match the selected parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0B132B] text-slate-300 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">{t("examiner.examTitle")}</th>
                  <th className="px-6 py-3.5">{t("examiner.subject")}</th>
                  <th className="px-6 py-3.5">Creator / Examiner</th>
                  <th className="px-6 py-3.5">{t("student.duration")}</th>
                  <th className="px-6 py-3.5">Attempts</th>
                  <th className="px-6 py-3.5">{t("student.proctoring")}</th>
                  <th className="px-6 py-3.5 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredExams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-100">{ex.title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {ex.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-200">{ex.creator_name}</p>
                      <p className="text-xs text-slate-400">{ex.creator_email}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                      {ex.duration} {t("student.minutes")}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                      {ex.candidate_count} Sessions
                    </td>
                    <td className="px-6 py-4">
                      {ex.proctoring_enabled ? (
                        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {t("student.aiActive")}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {t("student.disabled")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteExam(ex.id, ex.title)}
                        disabled={deletingId === ex.id}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        title={t("common.delete")}
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
