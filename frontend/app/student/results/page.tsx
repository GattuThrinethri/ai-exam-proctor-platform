"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, AlertCircle, TrendingUp, Calendar, CheckCircle2 } from "lucide-react";
import { studentApi, StudentResultSummary } from "@/services/api";

export default function StudentResultsPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Examination Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your scored examinations, authoritative percentile rankings, and performance breakdowns.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading examination results...</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            You have not completed any examinations yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Exam Title</th>
                  <th className="px-6 py-3.5">Subject</th>
                  <th className="px-6 py-3.5">Date Taken</th>
                  <th className="px-6 py-3.5">Total Score</th>
                  <th className="px-6 py-3.5">Percentage</th>
                  <th className="px-6 py-3.5">Percentile Rank</th>
                  <th className="px-6 py-3.5">Review Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((res) => {
                  const subDate = res.submitted_at ? new Date(res.submitted_at).toLocaleDateString() : "-";
                  return (
                    <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{res.exam_title}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                          {res.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{subDate}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {res.total_score} <span className="text-xs font-normal text-slate-400">/ {res.max_score}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-indigo-600">{res.percentage}%</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {res.percentile !== null ? `Percentile rank: ${res.percentile}%` : "100.00%"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {res.published ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Solutions Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Under Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/student/results/${res.session_id}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs hover:bg-indigo-100 transition-colors"
                        >
                          View Analysis &rarr;
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
