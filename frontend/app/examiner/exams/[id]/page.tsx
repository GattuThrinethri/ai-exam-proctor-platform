"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  Award,
  Eye,
  Sliders,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { examsApi, Exam } from "../../../../services/api";

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string, 10);

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    examsApi
      .get(examId)
      .then((data) => {
        setExam(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Exam detail load error:", err);
        setError(err.message || "Failed to load exam details.");
        setLoading(false);
      });
  }, [examId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">Loading examination details...</div>
    );
  }

  if (error || !exam) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
        <p className="font-bold">Error loading examination</p>
        <p className="mt-1">{error || "Examination not found."}</p>
        <Link
          href="/examiner/exams"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-800 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to examinations</span>
        </Link>
      </div>
    );
  }

  const totalMarks = exam.questions?.reduce((sum, q) => sum + (q.marks || 0), 0) || exam.total_marks || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/examiner/exams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Examinations</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/examiner/results?exam_id=${exam.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            <span>View Candidate Results</span>
          </Link>
          {exam.proctoring_enabled && (
            <Link
              href={`/examiner/proctoring?exam_id=${exam.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span>Proctoring Review</span>
            </Link>
          )}
        </div>
      </div>

      {/* Header Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{exam.title}</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {exam.subject}
              </span>
            </div>
            {exam.description && (
              <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{exam.description}</p>
            )}
          </div>
          <div className="text-right sm:flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium">Total Maximum Marks</span>
            <p className="text-2xl font-black text-emerald-600">{totalMarks} pts</p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Duration</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{exam.duration} Minutes</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Questions</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{exam.questions?.length || exam.question_count} items</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Negative Marking</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {exam.negative_marking_enabled ? "Enforced" : "Disabled"}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Proctoring</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {exam.proctoring_enabled ? `Active (${exam.gaze_sensitivity})` : "Disabled"}
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Availability Window:</span>
            <span className="font-semibold text-slate-900">
              {new Date(exam.start_time).toLocaleString()} – {new Date(exam.end_time).toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Randomization: {exam.randomization_enabled ? "Enabled" : "Sequential"}
          </div>
        </div>
      </div>

      {/* Attached Questions Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Attached Questions ({exam.questions?.length || 0})
          </h2>
          <span className="text-xs text-slate-400">Order randomized per candidate</span>
        </div>

        {!exam.questions || exam.questions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No questions attached to this exam.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {exam.questions.map((q, idx) => (
              <div key={q.id} className="p-5 space-y-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                      {q.question_type}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                      {q.difficulty}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700">+{q.marks} pts</span>
                    {q.negative_marks > 0 && (
                      <span className="text-[11px] text-rose-600 ml-1">(-{q.negative_marks})</span>
                    )}
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-900 whitespace-pre-wrap">{q.question_text}</p>

                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          opt.is_correct
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-semibold"
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{opt.option_text}</span>
                        {opt.is_correct && (
                          <span className="text-[10px] font-bold text-emerald-700">Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
