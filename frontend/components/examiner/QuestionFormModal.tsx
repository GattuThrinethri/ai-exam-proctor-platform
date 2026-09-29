"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { questionsApi, Question, QuestionOption } from "../../services/api";
import { useLanguage } from "../../i18n";

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedQuestion: Question) => void;
  initialQuestion?: Question | null;
}

export default function QuestionFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialQuestion,
}: QuestionFormModalProps) {
  const { t } = useLanguage();
  const isEditing = !!initialQuestion;

  const [subject, setSubject] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<
    "MCQ" | "MULTI_SELECT" | "SHORT_ANSWER" | "LONG_ANSWER" | "IMAGE_UPLOAD"
  >("MCQ");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [marks, setMarks] = useState<number>(5);
  const [negativeMarks, setNegativeMarks] = useState<number>(1);
  const [modelAnswer, setModelAnswer] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [options, setOptions] = useState<QuestionOption[]>([
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialQuestion) {
      setSubject(initialQuestion.subject);
      setQuestionText(initialQuestion.question_text);
      setQuestionType(initialQuestion.question_type);
      setDifficulty(initialQuestion.difficulty.toUpperCase() as any);
      setMarks(initialQuestion.marks);
      setNegativeMarks(initialQuestion.negative_marks);
      setModelAnswer(initialQuestion.model_answer || "");
      setExpectedAnswer(initialQuestion.expected_answer || "");
      if (initialQuestion.options && initialQuestion.options.length > 0) {
        setOptions(initialQuestion.options);
      } else {
        setOptions([
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false },
        ]);
      }
    } else {
      // Reset defaults
      setSubject("");
      setQuestionText("");
      setQuestionType("MCQ");
      setDifficulty("EASY");
      setMarks(5);
      setNegativeMarks(1);
      setModelAnswer("");
      setExpectedAnswer("");
      setOptions([
        { option_text: "", is_correct: true },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
        { option_text: "", is_correct: false },
      ]);
    }
    setError(null);
  }, [initialQuestion, isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    setOptions([...options, { option_text: "", is_correct: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setError("At least 2 options are required.");
      return;
    }
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index].option_text = text;
    setOptions(updated);
  };

  const handleOptionCorrectChange = (index: number, checked: boolean) => {
    const updated = [...options];
    if (questionType === "MCQ") {
      // Single choice
      updated.forEach((opt, i) => {
        opt.is_correct = i === index;
      });
    } else {
      // Multi-select
      updated[index].is_correct = checked;
    }
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!questionText.trim()) {
      setError("Question text is required.");
      return;
    }
    if (marks <= 0) {
      setError("Marks must be greater than 0.");
      return;
    }
    if (negativeMarks < 0) {
      setError("Negative marks cannot be negative.");
      return;
    }

    if (questionType === "MCQ" || questionType === "MULTI_SELECT") {
      if (options.length < 2) {
        setError("At least 2 options are required for objective questions.");
        return;
      }
      for (const opt of options) {
        if (!opt.option_text.trim()) {
          setError("All option texts must be filled.");
          return;
        }
      }
      const correctCount = options.filter((o) => o.is_correct).length;
      if (questionType === "MCQ" && correctCount !== 1) {
        setError("MCQ questions must have exactly one correct option.");
        return;
      }
      if (questionType === "MULTI_SELECT" && correctCount < 1) {
        setError("Multi-Select questions must have at least one correct option.");
        return;
      }
    }

    if (questionType === "SHORT_ANSWER" && !expectedAnswer.trim()) {
      setError("Expected answer is required for short answer evaluation.");
      return;
    }

    if (questionType === "LONG_ANSWER" && !modelAnswer.trim()) {
      setError("Model answer is required for AI evaluation rubric reference.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        subject: subject.trim(),
        question_text: questionText.trim(),
        question_type: questionType,
        difficulty: difficulty.toLowerCase(),
        marks: Number(marks),
        negative_marks: Number(negativeMarks),
        expected_answer: expectedAnswer.trim() || undefined,
        model_answer: modelAnswer.trim() || undefined,
      };

      if (questionType === "MCQ" || questionType === "MULTI_SELECT") {
        payload.options = options.map((opt) => ({
          option_text: opt.option_text.trim(),
          is_correct: opt.is_correct,
        }));
      }

      let res: Question;
      if (isEditing && initialQuestion) {
        res = await questionsApi.update(initialQuestion.id, payload);
      } else {
        res = await questionsApi.create(payload);
      }

      onSuccess(res);
      onClose();
    } catch (err: any) {
      console.error("Save question error:", err);
      setError(err.message || "Failed to save question.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#131D33] w-full max-w-3xl lg:max-w-4xl rounded-2xl shadow-xl border border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B132B]">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {isEditing ? t("examiner.editQuestion") : t("examiner.createQuestion")}
            </h2>
            <p className="text-xs text-slate-400">
              Configure question prompts, evaluation rubrics, and options.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.subject")}</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. DBMS, Data Structures, AI"
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.filterDifficulty")}</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
              >
                <option value="EASY">{t("examiner.easy")}</option>
                <option value="MEDIUM">{t("examiner.medium")}</option>
                <option value="HARD">{t("examiner.hard")}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.filterType")}</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as any)}
              disabled={isEditing}
              className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none disabled:bg-slate-800"
            >
              <option value="MCQ">Multiple Choice (Single Correct)</option>
              <option value="MULTI_SELECT">Multi-Select (Multiple Correct)</option>
              <option value="SHORT_ANSWER">Short Answer (Exact Matching)</option>
              <option value="LONG_ANSWER">Long Answer / Essay (AI Rubric Graded)</option>
              <option value="IMAGE_UPLOAD">Handwritten Image Upload (OCR + AI Graded)</option>
            </select>
            {isEditing && (
              <p className="text-[11px] text-slate-500 mt-1">Question type cannot be changed after creation.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.questionText")}</label>
            <textarea
              rows={3}
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter the full question description..."
              className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.marks")}</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={marks}
                onChange={(e) => setMarks(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t("examiner.negativeMarks")}</label>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Options for MCQ / Multi-Select */}
          {(questionType === "MCQ" || questionType === "MULTI_SELECT") && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Options & Correct Answer ({questionType === "MCQ" ? "Select 1 radio" : "Check all correct"})
                </label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("examiner.addOption")}</span>
                </button>
              </div>

              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={questionType === "MCQ" ? "radio" : "checkbox"}
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={(e) =>
                        handleOptionCorrectChange(
                          idx,
                          questionType === "MCQ" ? true : e.target.checked
                        )
                      }
                      className="h-4 w-4 text-teal-500 focus:ring-teal-500 border-slate-700"
                      title={opt.is_correct ? "Correct answer" : "Mark as correct"}
                    />
                    <input
                      type="text"
                      required
                      value={opt.option_text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-1.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                        title={t("examiner.removeOption")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Short Answer fields */}
          {questionType === "SHORT_ANSWER" && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  {t("examiner.expectedAnswer")}
                </label>
                <span className="text-[11px] text-slate-500">
                  {expectedAnswer.length} characters
                </span>
              </div>
              <textarea
                rows={4}
                required
                value={expectedAnswer}
                onChange={(e) => setExpectedAnswer(e.target.value)}
                placeholder="Enter expected concise answer, canonical key terms, or acceptable variations..."
                className="w-full min-h-[120px] px-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none resize-y leading-relaxed"
              />
            </div>
          )}

          {/* Long Answer & Image Upload fields */}
          {(questionType === "LONG_ANSWER" || questionType === "IMAGE_UPLOAD") && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  {t("examiner.modelAnswer")}
                </label>
                <span className="text-[11px] text-slate-500">
                  {modelAnswer.length} characters
                </span>
              </div>
              <textarea
                rows={10}
                required
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                placeholder="Enter comprehensive reference answer, key concepts, detailed grading breakdown..."
                className="w-full min-h-[250px] px-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none resize-y leading-relaxed font-normal"
              />
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 disabled:opacity-50 transition-colors"
            >
              {submitting ? t("common.loading") : isEditing ? t("examiner.editQuestion") : t("examiner.createQuestion")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
