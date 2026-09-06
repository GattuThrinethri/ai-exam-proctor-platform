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

export default function CreateExamPage() {
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

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...selectedQuestions];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setSelectedQuestions(updated);
  };

  const removeSelectedQuestion = (index: number) => {
    setSelectedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!title.trim() || !subject.trim()) {
      setError("Please provide both title and subject.");
      return false;
    }
    if (duration <= 0) {
      setError("Duration must be greater than 0 minutes.");
      return false;
    }
    if (questionCount <= 0) {
      setError("Question count must be at least 1.");
      return false;
    }
    if (!startTime || !endTime) {
      setError("Please specify both start and end availability window.");
      return false;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      setError("Start time must be strictly before end time.");
      return false;
    }
    setError(null);
    return true;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    if (selectedQuestions.length === 0) {
      setError("Please select at least 1 question for the exam.");
      return false;
    }
    setError(null);
    return true;
  };

  // Final Publish Handler
  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
        duration: Number(duration),
        question_count: Number(questionCount),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        randomization_enabled: Boolean(randomization),
        negative_marking_enabled: Boolean(negativeMarking),
        proctoring_enabled: Boolean(proctoring),
        gaze_sensitivity: gazeSensitivity,
        max_tab_switch_warnings: Number(maxTabWarnings),
        question_ids: selectedQuestions.map((q) => q.id),
      };

      const created = await examsApi.create(payload);
      router.push(`/examiner/exams/${created.id}`);
    } catch (err: any) {
      console.error("Create exam error:", err);
      setError(err.message || "Failed to publish examination.");
      setSubmitting(false);
    }
  };

  const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/examiner/exams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Examinations</span>
        </Link>
        <span className="text-xs text-slate-400 font-medium">Step {step} of 5</span>
      </div>

      {/* Workflow Step Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {[
            { s: 1, title: "1. Basic Info" },
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
              className={`py-2 px-1 rounded-lg font-semibold transition-colors truncate ${
                step === item.s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : step > item.s
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "text-slate-400 bg-slate-50 cursor-not-allowed"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Basic Information */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Step 1: Basic Exam Information</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify the title, subject, time availability window, and duration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm DBMS Examination 2026"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. DBMS, Operating Systems"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Candidate guidelines, allowed materials, and instructions..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                required
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Questions Count</label>
              <input
                type="number"
                min="1"
                required
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Availability Window: Start</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Availability Window: End</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Next: Settings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Settings */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Step 2: Exam Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure question paper randomization, negative marking penalty, and proctoring parameters.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Randomization */}
            <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-semibold text-xs text-slate-900">Randomized Question Papers</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Generates unique per-student question sequences derived deterministically from the student ID.
                </p>
              </div>
              <input
                type="checkbox"
                checked={randomization}
                onChange={(e) => setRandomization(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 mt-1"
              />
            </div>

            {/* Negative Marking */}
            <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-semibold text-xs text-slate-900">Negative Marking Enforcement</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Deducts question negative marks for incorrect objective responses. Total score is clamped at 0.
                </p>
              </div>
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 mt-1"
              />
            </div>

            {/* Proctoring Toggle */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    AI Automated Proctoring
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enables client-side face presence, multiple faces, gaze estimation, and tab-switch telemetry indicators.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={proctoring}
                  onChange={(e) => setProctoring(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300 mt-1"
                />
              </div>

              {proctoring && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Gaze Deviation Sensitivity
                    </label>
                    <select
                      value={gazeSensitivity}
                      onChange={(e) => setGazeSensitivity(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="low">Low (Lenient - deviation &gt; 0.38)</option>
                      <option value="medium">Medium (Standard - deviation &gt; 0.26)</option>
                      <option value="high">High (Strict - deviation &gt; 0.18)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Maximum Tab Switch Warnings
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={maxTabWarnings}
                      onChange={(e) => setMaxTabWarnings(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Next: Select Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Select Questions from Question Bank */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 3: Question Selection</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick questions from the bank for this exam paper.
              </p>
            </div>
            <div className="px-3 py-1.5 bg-indigo-50 text-indigo-800 rounded-xl border border-indigo-100 text-xs font-bold self-start sm:self-auto">
              Selected: {selectedQuestions.length} / {questionCount} recommended
            </div>
          </div>

          {/* Search bar inside step 3 */}
          <div className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                placeholder="Search questions by keyword..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={loadQuestions}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
            >
              Filter
            </button>
          </div>

          {/* Question selection list */}
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[45vh] overflow-y-auto">
            {qLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Loading Question Bank...</div>
            ) : availableQuestions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No questions found in Question Bank.</div>
            ) : (
              availableQuestions.map((q) => {
                const selected = isSelected(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleSelectQuestion(q)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      selected ? "bg-indigo-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {}} // Handled by div click
                      className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {q.subject}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full">
                          {q.question_type}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full">
                          +{q.marks} marks
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2">{q.question_text}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (validateStep3()) setStep(4);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Next: Review &amp; Reorder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Reorder Questions */}
      {step === 4 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 4: Review Selected Questions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reorder question sequence using the arrows or remove unneeded questions.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Total Maximum Marks:</span>
              <p className="text-lg font-extrabold text-emerald-600">{totalMarks} pts</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {selectedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-xs text-slate-900">{q.subject}</span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-white text-slate-600 rounded border border-slate-200">
                        {q.question_type}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">+{q.marks}m</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">{q.question_text}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, "up")}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-white"
                    title="Move Up"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, "down")}
                    disabled={idx === selectedQuestions.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-white"
                    title="Move Down"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSelectedQuestion(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white ml-1"
                    title="Remove Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Next: Confirm &amp; Publish</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Final Confirmation & Publish */}
      {step === 5 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Step 5: Confirm &amp; Save Examination</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review all parameters before making the exam available to candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Title</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{title}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Subject</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{subject}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Duration</span>
              <p className="font-semibold text-slate-800 mt-0.5">{duration} Minutes</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Total Marks</span>
              <p className="font-bold text-emerald-700 text-sm mt-0.5">{totalMarks} Points</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Start Window</span>
              <p className="font-medium text-slate-700 mt-0.5">{new Date(startTime).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">End Window</span>
              <p className="font-medium text-slate-700 mt-0.5">{new Date(endTime).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Proctoring</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {proctoring ? `Enabled (${gazeSensitivity} gaze sensitivity, max ${maxTabWarnings} tab warnings)` : "Disabled"}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Negative Marking</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {negativeMarking ? "Enforced" : "Disabled (0 penalties)"}
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={submitting}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Publishing Exam...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Publish Examination</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
