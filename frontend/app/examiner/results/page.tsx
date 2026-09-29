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
import { useLanguage } from "../../../i18n";

export default function ExaminerResultsPage() {
  const { t } = useLanguage();
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
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20">
          Nominal (0)
        </span>
      );
    }
    if (score < 25) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">
          Low ({score})
        </span>
      );
    }
    if (score < 50) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">
          Medium ({score})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-300 rounded-full border border-rose-500/20 font-bold">
        Elevated ({score})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("nav.examResults")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <button
          onClick={fetchResults}
          disabled={loading}
          className="p-2 text-slate-300 hover:text-white bg-[#131D33] border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          title={t("common.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#131D33] p-4 rounded-xl border border-slate-800 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("common.search")}
              className="w-full pl-9 pr-4 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400"
          >
            {t("common.search")}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>{t("common.filter")}:</span>
          </div>

          <select
            value={selectedExamId || ""}
            onChange={(e) => setSelectedExamId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-teal-500 focus:outline-none max-w-xs"
          >
            <option value="">{t("examiner.totalExams")}</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.subject})
              </option>
            ))}
          </select>

          {(selectedExamId || searchTerm) && (
            <button
              onClick={() => {
                setSelectedExamId(undefined);
                setSearchTerm("");
              }}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium ml-auto"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-[#131D33] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center">
            <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No candidate results found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No exam sessions match your filter or no student submissions have been recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0B132B] text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">{t("examiner.candidateName")}</th>
                  <th className="py-3.5 px-4">{t("examiner.examTitle")}</th>
                  <th className="py-3.5 px-4">{t("examiner.submittedAt")}</th>
                  <th className="py-3.5 px-4">{t("student.score")}</th>
                  <th className="py-3.5 px-4">{t("student.proctoring")}</th>
                  <th className="py-3.5 px-4">{t("examiner.evaluationStatus")}</th>
                  <th className="py-3.5 px-4 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {results.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100 whitespace-nowrap">
                      {res.student_name}
                      <span className="block text-[11px] text-slate-400 font-normal">{res.student_email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-200">{res.exam_title}</p>
                      <span className="text-[11px] text-teal-400">{res.subject || "General"}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {new Date(res.submitted_at || res.generated_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-100">
                      {res.published && res.total_score !== null ? (
                        <>
                          {res.total_score} {res.max_score ? <span className="text-[11px] font-normal text-slate-400">/ {res.max_score} ({res.percentage ?? 0}%)</span> : null}
                        </>
                      ) : (
                        <span className="text-xs text-amber-300 font-medium">{t("common.evaluationPending")}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getSuspicionPill(res.suspicion_score)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {res.published ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> {t("examiner.evaluatedStatus")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <Clock className="w-3 h-3" /> {t("examiner.pendingReview")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/examiner/results/${res.session_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-500/10 text-teal-300 font-semibold text-xs border border-teal-500/20 rounded-xl hover:bg-teal-500/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t("examiner.evaluate")}</span>
                      </Link>
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
