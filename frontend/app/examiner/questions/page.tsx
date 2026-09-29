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
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-500/10 text-teal-300 rounded-full border border-teal-500/20">MCQ</span>;
      case "MULTI_SELECT":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/20">Multi-Select</span>;
      case "SHORT_ANSWER":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20">Short Answer</span>;
      case "LONG_ANSWER":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">Long Answer</span>;
      case "IMAGE_UPLOAD":
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-pink-500/10 text-pink-300 rounded-full border border-pink-500/20">Image OCR</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 rounded-full">{type}</span>;
    }
  };

  const getDifficultyBadge = (diff: string) => {
    const d = diff.toLowerCase();
    if (d === "easy") {
      return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20">{t("examiner.easy")}</span>;
    }
    if (d === "medium") {
      return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">{t("examiner.medium")}</span>;
    }
    return <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-300 rounded-full border border-rose-500/20">{t("examiner.hard")}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("examiner.questionBank")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("examiner.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>+ {t("examiner.importQuestions")}</span>
          </button>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("examiner.createQuestion")}</span>
          </button>
        </div>
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
              className="w-full pl-9 pr-4 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
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

          <input
            type="text"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            placeholder={t("examiner.filterSubject")}
            className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 w-36"
          />

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("examiner.allDifficulties")}</option>
            <option value="easy">{t("examiner.easy")}</option>
            <option value="medium">{t("examiner.medium")}</option>
            <option value="hard">{t("examiner.hard")}</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B132B] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("examiner.allTypes")}</option>
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

      {/* Questions Table */}
      <div className="bg-[#131D33] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">{t("examiner.questionBank")}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No questions matched your current filter criteria or the bank is currently empty.
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-4 px-4 py-2 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl hover:bg-teal-400"
            >
              {t("examiner.createQuestion")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0B132B] text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">{t("examiner.subject")}</th>
                  <th className="py-3.5 px-4">{t("examiner.questionText")}</th>
                  <th className="py-3.5 px-4">{t("examiner.filterType")}</th>
                  <th className="py-3.5 px-4">{t("examiner.filterDifficulty")}</th>
                  <th className="py-3.5 px-4">{t("examiner.marks")}</th>
                  <th className="py-3.5 px-4 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100 whitespace-nowrap">
                      {q.subject}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="line-clamp-2 font-medium text-slate-200">{q.question_text}</p>
                      {q.options && q.options.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {q.options.length} options configured
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getTypeBadge(q.question_type)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{getDifficultyBadge(q.difficulty)}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      <span className="text-emerald-400">+{q.marks}</span>
                      {q.negative_marks > 0 && (
                        <span className="text-rose-400 ml-1">(-{q.negative_marks})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => setViewingQuestion(q)}
                        className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title={t("common.view")}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title={t("common.edit")}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingQuestion(q)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-xl rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B132B]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">{t("student.question")} #{viewingQuestion.id}</span>
                {getTypeBadge(viewingQuestion.question_type)}
                {getDifficultyBadge(viewingQuestion.difficulty)}
              </div>
              <button
                onClick={() => setViewingQuestion(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.subject")}</span>
                <p className="font-medium text-slate-100 mt-0.5">{viewingQuestion.subject}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.questionText")}</span>
                <p className="text-sm font-medium text-slate-200 mt-1 whitespace-pre-wrap">
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
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200 font-semibold"
                            : "bg-[#0B132B] border-slate-800 text-slate-300"
                        }`}
                      >
                        <span>{opt.option_text}</span>
                        {opt.is_correct && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                            {t("examiner.isCorrect")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingQuestion.expected_answer && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.expectedAnswer")}</span>
                  <p className="p-2.5 bg-emerald-500/10 text-emerald-200 rounded-lg border border-emerald-500/20 font-mono mt-1">
                    {viewingQuestion.expected_answer}
                  </p>
                </div>
              )}

              {viewingQuestion.model_answer && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.modelAnswer")}</span>
                  <p className="p-2.5 bg-[#0B132B] text-slate-200 rounded-lg border border-slate-800 mt-1 whitespace-pre-wrap">
                    {viewingQuestion.model_answer}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.marks")}</span>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">+{viewingQuestion.marks}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("examiner.negativeMarks")}</span>
                  <p className="text-sm font-bold text-rose-400 mt-0.5">
                    {viewingQuestion.negative_marks > 0 ? `-${viewingQuestion.negative_marks}` : "None (0)"}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-800 bg-[#0B132B] flex justify-end">
              <button
                onClick={() => setViewingQuestion(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-sm rounded-2xl shadow-xl border border-slate-800 p-6 text-center">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">{t("examiner.deleteQuestion")}?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              {t("examiner.confirmDeleteQuestion")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingQuestion(null)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-[#0B132B] border border-slate-700 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-800"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteLoading ? t("common.loading") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
