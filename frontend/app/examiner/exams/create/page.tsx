"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Filter,
  MoveUp,
  MoveDown,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Sliders,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";
import { examsApi, questionsApi, Question } from "../../../../services/api";
import { useLanguage } from "../../../../i18n";

export default function CreateExamPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // STEP 1: Basic info
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // STEP 2: Settings
  const [randomization, setRandomization] = useState(true);
  const [negativeMarking, setNegativeMarking] = useState(true);
  const [proctoring, setProctoring] = useState(true);
  const [gazeSensitivity, setGazeSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [maxTabWarnings, setMaxTabWarnings] = useState<number>(3);

  // STEP 3: Available & Selected Questions
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [qSearch, setQSearch] = useState("");
  const [qSubjectFilter, setQSubjectFilter] = useState("");
  const [qLoading, setQLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize start and end time with reasonable defaults (now and 2 days later)
  useEffect(() => {
    const now = new Date();
    const plusTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    // Format YYYY-MM-DDTHH:MM for datetime-local
    const formatLocal = (d: Date) => d.toISOString().slice(0, 16);
    setStartTime(formatLocal(now));
    setEndTime(formatLocal(plusTwoDays));
  }, []);

  // Fetch question bank questions when reaching step 3
  const loadQuestions = async () => {
    setQLoading(true);
    try {
      const res = await questionsApi.list({
        subject: qSubjectFilter || undefined,
        search: qSearch || undefined,
        page_size: 100,
      });
      setAvailableQuestions(res.items || []);
    } catch (err: any) {
      console.error("Failed to load questions:", err);
    } finally {
      setQLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      loadQuestions();
    }
  }, [step, qSubjectFilter]);

  // Question selection handlers
  const isSelected = (id: number) => selectedQuestions.some((q) => q.id === id);

  const toggleSelectQuestion = (q: Question) => {
    if (isSelected(q.id)) {
      setSelectedQuestions((prev) => prev.filter((item) => item.id !== q.id));
    } else {
      setSelectedQuestions((prev) => [...prev, q]);
    }
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === selectedQuestions.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...selectedQuestions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSelectedQuestions(updated);
  };

  // Step validations
  const validateStep1 = () => {
    if (!title.trim()) return "Exam Title is required.";
    if (!subject.trim()) return "Subject is required.";
    if (duration <= 0) return "Duration must be greater than 0.";
    if (!startTime || !endTime) return "Start and End times are required.";
    if (new Date(endTime) <= new Date(startTime))
      return "End time must be after Start time.";
    return null;
  };

  const handleNextStep1 = () => {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextStep2 = () => {
    setError(null);
    setStep(3);
  };

  const handleNextStep3 = () => {
    if (selectedQuestions.length === 0) {
      setError("Please select at least 1 question for this examination.");
      return;
    }
    setError(null);
    setStep(4);
  };

  const handleCreateExam = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const totalMarksCalc = selectedQuestions.reduce((acc, q) => acc + q.marks, 0);

      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
        duration: Number(duration),
        question_count: selectedQuestions.length || Number(questionCount) || 1,
        total_marks: totalMarksCalc,
        pass_marks: Math.round(totalMarksCalc * 0.4), // 40% default passing score
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        randomization_enabled: randomization,
        negative_marking_enabled: negativeMarking,
        proctoring_enabled: proctoring,
        question_ids: selectedQuestions.map((q) => q.id),
      };

      const res = await examsApi.create(payload);
      setStep(5);
    } catch (err: any) {
      console.error("Create exam error:", err);
      setError(err.message || "Failed to create examination.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link
            href="/examiner/exams"
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Exams
          </Link>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("examiner.createExam")}</h1>
        </div>

        {/* Stepper indicator */}
        <div className="grid grid-cols-5 gap-1.5 text-xs text-center w-full sm:w-auto">
          {[
            { s: 1, title: "1. Info" },
            { s: 2, title: "2. Settings" },
            { s: 3, title: "3. Questions" },
            { s: 4, title: "4. Review" },
            { s: 5, title: "5. Publish" },
          ].map((item) => (
            <button
              key={item.s}
              onClick={() => {
                if (item.s < step) setStep(item.s as any);
              }}
              disabled={item.s > step}
              className={`py-2 px-1 rounded-xl font-semibold transition-colors truncate ${
                step === item.s
                  ? "bg-teal-500 text-slate-950 shadow-sm"
                  : step > item.s
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "text-slate-500 bg-[#131D33] cursor-not-allowed border border-slate-800"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Basic Information */}
      {step === 1 && (
        <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 1: Basic Exam Information</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify the title, subject, time availability window, and duration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.examTitle")}</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm DBMS Examination 2026"
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.subject")}</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. DBMS, Operating Systems"
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Candidate guidelines, allowed materials, and instructions..."
              className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("student.duration")} ({t("student.minutes")})</label>
              <input
                type="number"
                min="1"
                required
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Expected Questions Count</label>
              <input
                type="number"
                min="1"
                required
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Window Start Time</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Window End Time</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleNextStep1}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400 transition-colors shadow-sm"
            >
              <span>Next: Configure Safeguards</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Settings & Safeguards */}
      {step === 2 && (
        <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 2: Exam Safeguards & Rules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enable automated AI proctoring, question shuffling, and negative penalty scoring rules.
            </p>
          </div>

          <div className="space-y-4">
            {/* Randomization */}
            <div className="flex items-center justify-between p-4 bg-[#0B132B] border border-slate-800 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-100">Question & Option Shuffling</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Randomize question order and options array for every student session.
                </p>
              </div>
              <input
                type="checkbox"
                checked={randomization}
                onChange={(e) => setRandomization(e.target.checked)}
                className="w-4 h-4 text-teal-500 focus:ring-teal-500 rounded border-slate-700"
              />
            </div>

            {/* Negative Marking */}
            <div className="flex items-center justify-between p-4 bg-[#0B132B] border border-slate-800 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-100">Negative Penalty Scoring</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deduct configured penalty marks for incorrect objective answers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                className="w-4 h-4 text-teal-500 focus:ring-teal-500 rounded border-slate-700"
              />
            </div>

            {/* Proctoring Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0B132B] border border-slate-800 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" /> Automated AI Proctoring
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitor webcam feed, tab switches, gaze tracking, and multiple face detections.
                </p>
              </div>
              <input
                type="checkbox"
                checked={proctoring}
                onChange={(e) => setProctoring(e.target.checked)}
                className="w-4 h-4 text-teal-500 focus:ring-teal-500 rounded border-slate-700"
              />
            </div>

            {proctoring && (
              <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Gaze Deviation Sensitivity</label>
                    <select
                      value={gazeSensitivity}
                      onChange={(e) => setGazeSensitivity(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="low">Low (Forgiving)</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="high">High (Strict Audit)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Max Tab Switch Warnings Allowed</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxTabWarnings}
                      onChange={(e) => setMaxTabWarnings(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleNextStep2}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400 transition-colors shadow-sm"
            >
              <span>Next: Select Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Question Paper Composition */}
      {step === 3 && (
        <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-100">Step 3: Question Paper Composition</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select questions from the bank to attach to this exam paper.
              </p>
            </div>

            <div className="text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl">
              Selected: {selectedQuestions.length} Questions ({selectedQuestions.reduce((a, b) => a + b.marks, 0)} Total Marks)
            </div>
          </div>

          {/* Question search & filter */}
          <div className="flex gap-2">
            <input
              type="text"
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              placeholder={t("common.search")}
              className="flex-1 px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />
            <button
              onClick={loadQuestions}
              className="px-4 py-2 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400"
            >
              {t("common.filter")}
            </button>
          </div>

          {/* Questions selection table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            {qLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">{t("common.loading")}</div>
            ) : availableQuestions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No questions found.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B132B] text-slate-300 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">Select</th>
                    <th className="p-3">{t("examiner.subject")}</th>
                    <th className="p-3">{t("examiner.questionText")}</th>
                    <th className="p-3">{t("examiner.filterType")}</th>
                    <th className="p-3">{t("examiner.marks")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {availableQuestions.map((q) => {
                    const selected = isSelected(q.id);
                    return (
                      <tr
                        key={q.id}
                        onClick={() => toggleSelectQuestion(q)}
                        className={`cursor-pointer transition-colors ${
                          selected ? "bg-teal-500/10 font-semibold" : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {}}
                            className="w-4 h-4 text-teal-500 rounded border-slate-700 focus:ring-teal-500"
                          />
                        </td>
                        <td className="p-3 text-slate-100 font-bold whitespace-nowrap">{q.subject}</td>
                        <td className="p-3 max-w-sm line-clamp-1">{q.question_text}</td>
                        <td className="p-3 whitespace-nowrap">{q.question_type}</td>
                        <td className="p-3 text-emerald-400 font-bold whitespace-nowrap">+{q.marks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleNextStep3}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400 transition-colors shadow-sm"
            >
              <span>Next: Review Examination</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review */}
      {step === 4 && (
        <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-100">Step 4: Final Summary & Review</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify examination details, time windows, and question paper paper sequence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-2 text-slate-300">
              <p><span className="font-semibold text-slate-400">Exam Title:</span> {title}</p>
              <p><span className="font-semibold text-slate-400">Subject:</span> {subject}</p>
              <p><span className="font-semibold text-slate-400">Duration:</span> {duration} Minutes</p>
              <p><span className="font-semibold text-slate-400">Total Marks:</span> {selectedQuestions.reduce((a, b) => a + b.marks, 0)} Pts</p>
            </div>
            <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-2 text-slate-300">
              <p><span className="font-semibold text-slate-400">Start Time:</span> {new Date(startTime).toLocaleString()}</p>
              <p><span className="font-semibold text-slate-400">End Time:</span> {new Date(endTime).toLocaleString()}</p>
              <p><span className="font-semibold text-slate-400">AI Proctoring:</span> {proctoring ? "Enabled (Webcam + Gaze)" : "Disabled"}</p>
              <p><span className="font-semibold text-slate-400">Randomization:</span> {randomization ? "Enabled" : "Disabled"}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleCreateExam}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? t("common.loading") : t("examiner.publishExam")}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Success Publish */}
      {step === 5 && (
        <div className="bg-[#131D33] p-10 rounded-2xl border border-slate-800 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Examination Created & Published!</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your exam schedule is now active. Students can view and enter the exam within the configured time window.
          </p>
          <div className="pt-4">
            <Link
              href="/examiner/exams"
              className="px-6 py-2.5 bg-teal-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-teal-400 transition-colors inline-block"
            >
              Go to Examinations List
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
