"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, AlertCircle, TrendingUp, Calendar, CheckCircle2 } from "lucide-react";
import { studentApi, StudentResultSummary } from "@/services/api";
import { useLanguage } from "@/i18n";

export default function StudentResultsPage() {
  const { t } = useLanguage();
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    setLoading(true);
    setError(null);
    try {
      const data = await studentApi.getMyResults();
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("student.myResults")}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t("student.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="bg-[#131D33] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {t("student.noResults")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0B132B] text-slate-300 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">{t("examiner.examTitle")}</th>
                  <th className="px-6 py-3.5">{t("examiner.subject")}</th>
                  <th className="px-6 py-3.5">{t("examiner.submittedAt")}</th>
                  <th className="px-6 py-3.5">{t("student.score")}</th>
                  <th className="px-6 py-3.5">{t("student.percentage")}</th>
                  <th className="px-6 py-3.5">{t("student.percentileRank")}</th>
                  <th className="px-6 py-3.5">{t("common.status")}</th>
                  <th className="px-6 py-3.5 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {results.map((res) => {
                  const subDate = res.submitted_at ? new Date(res.submitted_at).toLocaleDateString() : "-";
                  return (
                    <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-100">{res.exam_title}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {res.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{subDate}</td>
                      <td className="px-6 py-4 font-bold text-slate-100">
                        {res.published && res.total_score !== null ? (
                          <>
                            {res.total_score} <span className="text-xs font-normal text-slate-400">/ {res.max_score}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
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
                        {res.published && res.percentile !== null ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {t("student.percentileRank")}: {res.percentile}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">{t("common.pending")}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {res.published ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t("common.completed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {t("common.evaluationPending")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/student/results/${res.session_id}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 font-semibold text-xs border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                        >
                          {res.published ? `${t("student.viewAnalysis")} →` : `${t("common.details")} →`}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
