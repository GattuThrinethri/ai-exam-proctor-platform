"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Award,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { examinerApi, examsApi, ExaminerResult, Exam } from "../../../services/api";

export default function ExaminerResultsPage() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get("exam_id") ? parseInt(searchParams.get("exam_id")!, 10) : undefined;

  const [results, setResults] = useState<ExaminerResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(initialExamId);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load exams list for filter dropdown
  useEffect(() => {
    examsApi
      .list()
      .then((data) => setExams(data))
      .catch((err) => console.error("Error loading exams for filter:", err));
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await examinerApi.getResults({
        exam_id: selectedExamId,
        search: searchTerm.trim() || undefined,
      });
      setResults(data);
    } catch (err: any) {
      console.error("Results fetch error:", err);
      setError(err.message || "Failed to load candidate results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [selectedExamId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults();
  };

  const getSuspicionPill = (score: number) => {
    if (score === 0) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
          Nominal (0)
        </span>
      );
    }
    if (score < 25) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
          Low ({score})
        </span>
      );
    }
    if (score < 50) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
          Medium ({score})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 rounded-full border border-rose-200 font-bold">
        Elevated ({score})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Candidate Results</h1>
          <p className="text-sm text-slate-500 mt-1">
            Read-only evaluation outcomes, objective scoring, AI grading breakdowns, and suspicion ratings.
          </p>
        </div>
        <button
          onClick={fetchResults}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Results</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate name or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={selectedExamId || ""}
            onChange={(e) => setSelectedExamId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="w-full sm:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
          >
            <option value="">All Examinations</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.subject})
              </option>
            ))}
          </select>
          {selectedExamId && (
            <button
              onClick={() => setSelectedExamId(undefined)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading exam results...</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No candidate results found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Candidate answers will automatically be evaluated and populated here as submissions occur.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Examination</th>
                  <th className="py-3.5 px-4">Objective Score</th>
                  <th className="py-3.5 px-4">Subjective Score</th>
                  <th className="py-3.5 px-4">Total Score</th>
                  <th className="py-3.5 px-4">Suspicion Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {results.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{res.student_name}</p>
                      <p className="text-[11px] text-slate-400">{res.student_email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{res.exam_title}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700">
                      {res.objective_score.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700">
                      {res.subjective_score.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 text-xs font-black bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                        {res.total_score.toFixed(2)} pts
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getSuspicionPill(res.suspicion_score)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${
                          res.status === "submitted"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500 text-[11px]">
                      {res.submitted_at
                        ? new Date(res.submitted_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Auto-evaluated"}
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
