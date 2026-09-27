"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  PlusCircle,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  FileQuestion,
  X,
  Upload,
} from "lucide-react";
import { questionsApi, Question } from "../../../services/api";
import QuestionFormModal from "../../../components/examiner/QuestionFormModal";
import ImportQuestionsModal from "../../../components/examiner/ImportQuestionsModal";
import { useLanguage } from "../../../i18n";

export default function QuestionBankPage() {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await questionsApi.list({
        subject: selectedSubject || undefined,
        difficulty: selectedDifficulty || undefined,
        question_type: selectedType || undefined,
        search: searchTerm.trim() || undefined,
        page_size: 100,
      });
      setQuestions(res.items || []);
    } catch (err: any) {
      console.error("Questions load error:", err);
      setError(err.message || "Failed to load question bank.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubject, selectedDifficulty, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuestions();
  };

  const handleCreateNew = () => {
    setEditingQuestion(null);
    setFormModalOpen(true);
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingQuestion) return;
    setDeleteLoading(true);
    try {
      await questionsApi.delete(deletingQuestion.id);
      setQuestions((prev) => prev.filter((q) => q.id !== deletingQuestion.id));
      setDeletingQuestion(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleQuestionSaved = () => {
    fetchQuestions();
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "MCQ":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">MCQ</span>;
      case "MULTI_SELECT":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700 rounded-full border border-purple-200">Multi-Select</span>;
      case "SHORT_ANSWER":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">Short Answer</span>;
      case "LONG_ANSWER":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">Long Answer</span>;
      case "IMAGE_UPLOAD":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-pink-50 text-pink-700 rounded-full border border-pink-200">Image OCR</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-full">{type}</span>;
    }
  };

  const getDifficultyBadge = (diff: string) => {
    const d = diff.toLowerCase();
    if (d === "easy") {
      return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full">{t("examiner.easy")}</span>;
    }
    if (d === "medium") {
      return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full">{t("examiner.medium")}</span>;
    }
    return <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 rounded-full">{t("examiner.hard")}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("examiner.questionBank")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>+ {t("examiner.importQuestions")}</span>
          </button>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("examiner.createQuestion")}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by question text or keyword..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <input
            type="text"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            placeholder="Filter subject..."
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none w-36"
          />

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="MCQ">MCQ</option>
            <option value="MULTI_SELECT">Multi-Select</option>
            <option value="SHORT_ANSWER">Short Answer</option>
            <option value="LONG_ANSWER">Long Answer</option>
            <option value="IMAGE_UPLOAD">Handwritten Image OCR</option>
          </select>

          {(selectedSubject || selectedDifficulty || selectedType || searchTerm) && (
            <button
              onClick={() => {
                setSelectedSubject("");
                setSelectedDifficulty("");
                setSelectedType("");
                setSearchTerm("");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-auto"
            >
              Reset Filters
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

      {/* Questions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No questions found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No questions matched your current filter criteria or the bank is currently empty.
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
            >
              Add First Question
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Question Text</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Difficulty</th>
                  <th className="py-3.5 px-4">Marks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {q.subject}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="line-clamp-2 font-medium text-slate-800">{q.question_text}</p>
                      {q.options && q.options.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {q.options.length} options configured
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getTypeBadge(q.question_type)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{getDifficultyBadge(q.difficulty)}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      <span className="text-emerald-700">+{q.marks}</span>
                      {q.negative_marks > 0 && (
                        <span className="text-rose-600 ml-1">(-{q.negative_marks})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => setViewingQuestion(q)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Question"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingQuestion(q)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Delete Question"
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

      {/* Question Form Modal (Create / Edit) */}
      <QuestionFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={handleQuestionSaved}
        initialQuestion={editingQuestion}
      />

      {/* Import Questions from Document Modal */}
      <ImportQuestionsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={fetchQuestions}
      />

      {/* Question Detail View Modal */}
      {viewingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Question #{viewingQuestion.id}</span>
                {getTypeBadge(viewingQuestion.question_type)}
                {getDifficultyBadge(viewingQuestion.difficulty)}
              </div>
              <button
                onClick={() => setViewingQuestion(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Subject</span>
                <p className="font-medium text-slate-900 mt-0.5">{viewingQuestion.subject}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Question Statement</span>
                <p className="text-sm font-medium text-slate-800 mt-1 whitespace-pre-wrap">
                  {viewingQuestion.question_text}
                </p>
              </div>

              {viewingQuestion.options && viewingQuestion.options.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Options</span>
                  <div className="space-y-1.5 mt-1.5">
                    {viewingQuestion.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          opt.is_correct
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold"
                            : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{opt.option_text}</span>
                        {opt.is_correct && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-200 text-emerald-900 rounded-full">
                            Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingQuestion.expected_answer && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Expected Answer</span>
                  <p className="p-2.5 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 font-mono mt-1">
                    {viewingQuestion.expected_answer}
                  </p>
                </div>
              )}

              {viewingQuestion.model_answer && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Model Answer / Rubric</span>
                  <p className="p-2.5 bg-slate-50 text-slate-800 rounded-lg border border-slate-200 mt-1 whitespace-pre-wrap">
                    {viewingQuestion.model_answer}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Marks</span>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">+{viewingQuestion.marks}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Negative Penalty</span>
                  <p className="text-sm font-bold text-rose-600 mt-0.5">
                    {viewingQuestion.negative_marks > 0 ? `-${viewingQuestion.negative_marks}` : "None (0)"}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingQuestion(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Question?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to delete this question? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingQuestion(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
