"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Edit3,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  questionsApi,
  ImportPreviewResponse,
  ExtractedQuestion,
  ImportConfirmRequest,
} from "../../services/api";

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ImportQuestionsModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportQuestionsModalProps) {
  // Stage 1: Upload, Stage 2: Preview/Edit, Stage 3: Success
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // Stage 1 states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stage 2 states
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [defaultSubject, setDefaultSubject] = useState("");
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Stage 3 states
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  const resetState = () => {
    setStage(1);
    setSelectedFile(null);
    setExtracting(false);
    setUploadProgress(0);
    setError(null);
    setPreviewData(null);
    setDefaultSubject("");
    setExtractedQuestions([]);
    setSelectedIds(new Set());
    setSubmitting(false);
    setImportedCount(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (file: File) => {
    setError(null);
    const validExtensions = [".pdf", ".docx", ".pptx", ".txt", ".csv", ".xlsx", ".jpg", ".jpeg", ".png"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!validExtensions.includes(ext)) {
      setError(`Unsupported file format '${ext}'. Please choose a PDF, DOCX, PPTX, TXT, CSV, XLSX, or Image file.`);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("File size exceeds 15MB limit. Please upload a smaller document.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    setExtracting(true);
    setError(null);
    setUploadProgress(30);

    try {
      setUploadProgress(60);
      const res = await questionsApi.importDocument(selectedFile);
      setUploadProgress(100);

      setPreviewData(res);
      setExtractedQuestions(res.questions);
      setDefaultSubject(res.detected_subject || "General");

      // By default select non-duplicate questions
      const initialSelected = new Set<string>();
      res.questions.forEach((q) => {
        if (!q.is_duplicate) {
          initialSelected.add(q.temp_id);
        }
      });
      // If all questions are duplicates, select them all so user can choose
      if (initialSelected.size === 0 && res.questions.length > 0) {
        res.questions.forEach((q) => initialSelected.add(q.temp_id));
      }

      setSelectedIds(initialSelected);
      setStage(2);
    } catch (err: any) {
      setError(err.message || "Failed to extract questions from the document.");
    } finally {
      setExtracting(false);
    }
  };

  // Stage 2 actions
  const toggleSelectAll = () => {
    if (selectedIds.size === extractedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(extractedQuestions.map((q) => q.temp_id)));
    }
  };

  const skipDuplicates = () => {
    const updated = new Set<string>();
    extractedQuestions.forEach((q) => {
      if (!q.is_duplicate) {
        updated.add(q.temp_id);
      }
    });
    setSelectedIds(updated);
  };

  const toggleSelectQuestion = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteQuestion = (id: string) => {
    setExtractedQuestions((prev) => prev.filter((q) => q.temp_id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleQuestionTextChange = (id: string, text: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => (q.temp_id === id ? { ...q, question_text: text } : q))
    );
  };

  const handleOptionChange = (qId: string, optIdx: number, newText: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => {
        if (q.temp_id !== qId) return q;
        const updatedOpts = [...q.options];
        updatedOpts[optIdx] = { ...updatedOpts[optIdx], option_text: newText };
        return { ...q, options: updatedOpts };
      })
    );
  };

  const handleSetCorrectOption = (qId: string, optIdx: number) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => {
        if (q.temp_id !== qId) return q;
        const updatedOpts = q.options.map((opt, idx) => ({
          ...opt,
          is_correct: idx === optIdx,
        }));
        return { ...q, options: updatedOpts };
      })
    );
  };

  const handleMarksChange = (qId: string, marks: number) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => (q.temp_id === qId ? { ...q, marks: Math.max(0.5, marks) } : q))
    );
  };

  const handleDifficultyChange = (qId: string, difficulty: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => (q.temp_id === qId ? { ...q, difficulty } : q))
    );
  };

  const handleConfirmImport = async () => {
    const questionsToImport = extractedQuestions.filter((q) => selectedIds.has(q.temp_id));
    if (questionsToImport.length === 0) {
      setError("Please select at least one question to import.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: ImportConfirmRequest = {
        questions: questionsToImport.map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer,
          subject: q.subject || defaultSubject || "General",
          difficulty: q.difficulty,
          marks: q.marks,
          negative_marks: q.negative_marks,
          model_answer: q.model_answer,
          expected_answer: q.expected_answer,
        })),
        default_subject: defaultSubject.trim() || undefined,
      };

      const res = await questionsApi.confirmImport(payload);
      setImportedCount(res.imported_count);
      setStage(3);
      onImportSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to confirm and import questions.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const duplicateCount = extractedQuestions.filter((q) => q.is_duplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Import Questions from Document</h2>
              <p className="text-xs text-slate-500">
                Bulk extract, preview, edit, and import exam questions into the Question Bank.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STAGE 1: Upload */}
          {stage === 1 && (
            <div className="space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  dragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.csv,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedFile ? selectedFile.name : "Drag & drop your question document here"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedFile
                      ? `Selected: ${formatFileSize(selectedFile.size)} • Click to choose a different file`
                      : "or click to browse from your computer"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-w-md">
                  {["PDF", "DOCX", "PPTX", "TXT", "CSV", "XLSX", "JPG", "PNG"].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md border border-slate-200"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">Maximum file size: 15 MB</span>
              </div>

              {selectedFile && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    disabled={extracting}
                    onClick={handleExtract}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting Questions...</span>
                      </>
                    ) : (
                      <>
                        <span>Extract Questions</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {extracting && (
                <div className="space-y-2">
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-slate-500">
                    Scanning document structure, identifying questions, options, and answers...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: Preview & Selection */}
          {stage === 2 && (
            <div className="space-y-5">
              {/* Toolbar & Subject */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStage(1)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 text-xs flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Upload New</span>
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    Extracted Questions ({extractedQuestions.length})
                  </span>
                  <span className="text-xs text-slate-500">
                    ({selectedIds.size} of {extractedQuestions.length} selected)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 font-medium whitespace-nowrap">Subject:</label>
                  <input
                    type="text"
                    value={defaultSubject}
                    onChange={(e) => setDefaultSubject(e.target.value)}
                    placeholder="e.g. DBMS, Operating Systems"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none w-44"
                  />
                </div>
              </div>

              {/* Duplicate Warning Banner */}
              {duplicateCount > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{duplicateCount} possible duplicate question(s)</strong> detected against your
                      existing Question Bank.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={skipDuplicates}
                      className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100 font-medium"
                    >
                      Skip Duplicates
                    </button>
                    <button
                      onClick={toggleSelectAll}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              )}

              {/* Selection helper row */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="text-emerald-700 hover:text-emerald-800 font-medium"
                  >
                    {selectedIds.size === extractedQuestions.length ? "Deselect All" : "Select All"}
                  </button>
                  <span>•</span>
                  <span>Review and adjust questions before importing</span>
                </div>
                <span>Total: {extractedQuestions.length}</span>
              </div>

              {/* Extracted Questions List */}
              <div className="space-y-4 max-h-[48vh] overflow-y-auto pr-1">
                {extractedQuestions.map((q, qIndex) => {
                  const isSelected = selectedIds.has(q.temp_id);
                  const hasOptions = q.options && q.options.length > 0;
                  const hasCorrectAnswer = q.options?.some((o) => o.is_correct);

                  return (
                    <div
                      key={q.temp_id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-white border-slate-300 shadow-sm"
                          : "bg-slate-50/70 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectQuestion(q.temp_id)}
                          className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />

                        {/* Question Content */}
                        <div className="flex-1 space-y-3">
                          {/* Badges & Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">Q{qIndex + 1}.</span>
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                                {q.question_type}
                              </span>
                              {q.is_duplicate && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Duplicate Warning</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex items-center gap-1 text-slate-500">
                                <span>Marks:</span>
                                <input
                                  type="number"
                                  min="0.5"
                                  step="0.5"
                                  value={q.marks}
                                  onChange={(e) =>
                                    handleMarksChange(q.temp_id, parseFloat(e.target.value) || 1)
                                  }
                                  className="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center text-xs text-slate-800"
                                />
                              </div>

                              <select
                                value={q.difficulty}
                                onChange={(e) => handleDifficultyChange(q.temp_id, e.target.value)}
                                className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>

                              <button
                                onClick={() => handleDeleteQuestion(q.temp_id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Question Text */}
                          <textarea
                            value={q.question_text}
                            onChange={(e) => handleQuestionTextChange(q.temp_id, e.target.value)}
                            rows={2}
                            className="w-full p-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />

                          {/* Duplicate Explanation */}
                          {q.is_duplicate && q.duplicate_reason && (
                            <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2 rounded border border-amber-200">
                              {q.duplicate_reason}
                            </p>
                          )}

                          {/* Options for MCQ / Multi-select */}
                          {hasOptions && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Options (click radio to set correct answer):</span>
                                {!hasCorrectAnswer && (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> No answer marked
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  return (
                                    <div
                                      key={optIdx}
                                      onClick={() => handleSetCorrectOption(q.temp_id, optIdx)}
                                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                        opt.is_correct
                                          ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-medium"
                                          : "bg-white border-slate-200 hover:bg-slate-50"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`radio-${q.temp_id}`}
                                        checked={opt.is_correct}
                                        onChange={() => handleSetCorrectOption(q.temp_id, optIdx)}
                                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-slate-500">{letter}.</span>
                                      <input
                                        type="text"
                                        value={opt.option_text}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) =>
                                          handleOptionChange(q.temp_id, optIdx, e.target.value)
                                        }
                                        className="flex-1 bg-transparent border-none p-0 text-xs focus:outline-none"
                                      />
                                      {opt.is_correct && (
                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Model Answer / Explanation */}
                          {q.model_answer && (
                            <div className="text-[11px] text-slate-600 bg-slate-100 p-2 rounded border border-slate-200">
                              <span className="font-semibold text-slate-700">Model Answer: </span>
                              {q.model_answer}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 3: Success Confirmation */}
          {stage === 3 && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Questions Successfully Imported!</h3>
                <p className="text-sm text-slate-600">
                  Successfully imported <strong>{importedCount}</strong> question(s) into the Question Bank.
                </p>
                <p className="text-xs text-slate-400">
                  These questions are now available for creating exams and generating tests.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          {stage === 1 && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={!selectedFile || extracting}
                onClick={handleExtract}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Preview Questions</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {stage === 2 && (
            <>
              <button
                onClick={() => setStage(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Upload
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting || selectedIds.size === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Questions...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Add Selected ({selectedIds.size}) to Question Bank</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {stage === 3 && (
            <div className="w-full flex justify-end">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
