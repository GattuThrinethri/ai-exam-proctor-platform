"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  RotateCcw,
  Camera,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
  FileCheck,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
} from "lucide-react";
import { studentApi, StudentExamPaper, StudentPaperQuestion, Exam } from "@/services/api";
import { authService } from "@/services/auth";
import { ProctoringMonitor } from "@/components/proctoring/ProctoringMonitor";
import ExamInstructionsModal from "@/components/student/ExamInstructionsModal";

interface LocalAnswerState {
  selected_option_ids: number[];
  answer_text: string;
  image_url: string | null;
  ocr_text?: string | null;
  is_marked_for_review: boolean;
}

export default function ExamTakePage() {
  const params = useParams();
  const sessionId = Number(params.id);
  const router = useRouter();

  // Core Exam State
  const [paper, setPaper] = useState<StudentExamPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, LocalAnswerState>>({});

  // Pre-exam instruction agreement state
  const [hasConfirmedInstructions, setHasConfirmedInstructions] = useState(() => {
    if (typeof window !== "undefined" && sessionId) {
      return sessionStorage.getItem(`exam_agreed_${sessionId}`) === "true";
    }
    return false;
  });

  // Server-Authoritative Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timerExpired, setTimerExpired] = useState(false);

  // Autosave State
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Submit Modal State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Proctoring Monitor State
  const [showProctorCam, setShowProctorCam] = useState(true);
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter for Palette
  const [paletteFilter, setPaletteFilter] = useState<"all" | "answered" | "unanswered" | "review">("all");

  // Browser Fullscreen API State & Listener
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      if (typeof document !== "undefined") {
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    }
    if (typeof document !== "undefined") {
      setIsFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener("fullscreenchange", handleFullscreenChange);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      }
    };
  }, []);

  async function toggleFullscreen() {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
    }
  }

  // Verify instruction confirmation on session change
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      if (sessionStorage.getItem(`exam_agreed_${sessionId}`) === "true") {
        setHasConfirmedInstructions(true);
      }
    }
  }, [sessionId]);

  // Load Exam Paper & Initial Answers
  useEffect(() => {
    if (!sessionId) return;
    loadExam();
  }, [sessionId]);

  async function loadExam() {
    setLoading(true);
    setError(null);
    try {
      const [paperData, sessionData] = await Promise.all([
        studentApi.getExamPaper(sessionId),
        studentApi.getSession(sessionId),
      ]);

      if (sessionData.is_timed_out || sessionData.status === "submitted" || sessionData.status === "timed_out") {
        alert("This exam session has already ended or timed out.");
        router.replace(`/student/results/${sessionId}`);
        return;
      }

      setPaper(paperData);
      setRemainingSeconds(Math.max(0, sessionData.remaining_seconds));

      // Fetch any previously saved answers
      const token = authService.getToken();
      const ansRes = await fetch(`/api/exam-sessions/${sessionId}/answers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (ansRes.ok) {
        const savedList = await ansRes.json();
        const initialAnswers: Record<number, LocalAnswerState> = {};
        for (const item of savedList) {
          initialAnswers[item.question_id] = {
            selected_option_ids: item.selected_option_ids || [],
            answer_text: item.answer_text || "",
            image_url: item.image_url || null,
            ocr_text: item.ocr_text || null,
            is_marked_for_review: false,
          };
        }
        setAnswers(initialAnswers);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load examination paper");
    } finally {
      setLoading(false);
    }
  }

  // Authoritative Countdown Clock
  useEffect(() => {
    if (loading || remainingSeconds <= 0 || timerExpired || !hasConfirmedInstructions) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerExpired(true);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, remainingSeconds, timerExpired, hasConfirmedInstructions]);

  // Periodic Server Time Sync (every 60s)
  useEffect(() => {
    if (loading || timerExpired || !hasConfirmedInstructions) return;

    const syncInterval = setInterval(async () => {
      try {
        const session = await studentApi.getSession(sessionId);
        setRemainingSeconds(session.remaining_seconds);
        if (session.remaining_seconds <= 0 || session.is_timed_out) {
          setTimerExpired(true);
          handleAutoSubmit();
        }
      } catch (err) {
        console.error("Timer sync error:", err);
      }
    }, 60000);

    return () => clearInterval(syncInterval);
  }, [sessionId, loading, timerExpired, hasConfirmedInstructions]);

  // Handle Tab Switch / Window Blur Event
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && paper?.proctoring_enabled && !timerExpired && hasConfirmedInstructions) {
        setProctorWarning("Tab switch detected. Please maintain continuous focus on the exam window.");
        setTimeout(() => setProctorWarning(null), 6000);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [paper, timerExpired, hasConfirmedInstructions]);

  // Debounced Autosave Trigger
  const triggerAutosave = useCallback(
    (questionId: number, answerState: LocalAnswerState) => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      setSaveStatus("saving");
      autosaveTimeoutRef.current = setTimeout(async () => {
        try {
          await studentApi.saveAnswer(sessionId, {
            question_id: questionId,
            selected_option_ids: answerState.selected_option_ids,
            answer_text: answerState.answer_text,
            image_url: answerState.image_url || undefined,
          });
          setSaveStatus("saved");
        } catch (err) {
          console.error("Autosave failed:", err);
          setSaveStatus("error");
        }
      }, 800);
    },
    [sessionId]
  );

  // Update Answer for a question
  function updateCurrentAnswer(partial: Partial<LocalAnswerState>) {
    if (!paper) return;
    const q = paper.questions[currentIdx];
    if (!q) return;

    setAnswers((prev) => {
      const current = prev[q.id] || {
        selected_option_ids: [],
        answer_text: "",
        image_url: null,
        is_marked_for_review: false,
      };
      const updated: LocalAnswerState = { ...current, ...partial };
      triggerAutosave(q.id, updated);
      return { ...prev, [q.id]: updated };
    });
  }

  // Image Upload Handler
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !paper) return;

    // Validate type & size (10MB limit)
    if (!["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(file.type)) {
      alert("Invalid file format. Please upload a JPG or PNG image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds the 10MB limit.");
      return;
    }

    const q = paper.questions[currentIdx];
    setUploadingImage(true);
    try {
      const uploadRes = await studentApi.uploadAnswerImage(sessionId, q.id, file);
      updateCurrentAnswer({
        image_url: uploadRes.image_url,
        ocr_text: uploadRes.ocr_text || null,
      });
    } catch (err: any) {
      alert(`Image upload error: ${err.message}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Clear Answer Handler
  function handleClearAnswer() {
    if (!paper) return;
    const q = paper.questions[currentIdx];
    updateCurrentAnswer({
      selected_option_ids: [],
      answer_text: "",
      image_url: null,
      ocr_text: null,
    });
  }

  // Toggle Mark for Review
  function toggleMarkForReview() {
    if (!paper) return;
    const q = paper.questions[currentIdx];
    const current = answers[q.id] || {
      selected_option_ids: [],
      answer_text: "",
      image_url: null,
      is_marked_for_review: false,
    };
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        ...current,
        is_marked_for_review: !current.is_marked_for_review,
      },
    }));
  }

  // Final Submit Handler
  async function handleConfirmSubmit() {
    setSubmitting(true);
    try {
      await studentApi.submitExam(sessionId);
      router.replace(`/student/results/${sessionId}`);
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  }

  // Auto-Submit Handler on Timer Expiry
  async function handleAutoSubmit() {
    setSubmitting(true);
    try {
      await studentApi.submitExam(sessionId);
    } catch (err) {
      console.log("Auto-submit finalized");
    } finally {
      router.replace(`/student/results/${sessionId}`);
    }
  }

  // Timer Display Formatting
  function formatTimer(sec: number) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-300">Entering Examination Room...</p>
        <p className="text-xs text-slate-500 mt-1">Initializing sanitized question paper & server timer</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Exam Access Error</h2>
          <p className="text-sm text-slate-600">{error || "Unable to start exam session"}</p>
          <button
            onClick={() => router.replace("/student/exams")}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
          >
            Return to Available Exams
          </button>
        </div>
      </div>
    );
  }

  // Direct URL Guard: Student must confirm instructions before viewing question paper
  if (!hasConfirmedInstructions && paper) {
    const examEquivalent: Exam = {
      id: paper.exam_id,
      title: paper.title,
      subject: paper.subject,
      description: paper.description,
      duration: paper.duration_minutes,
      question_count: paper.questions.length,
      start_time: paper.started_at || "",
      end_time: "",
      randomization_enabled: false,
      negative_marking_enabled: false,
      proctoring_enabled: paper.proctoring_enabled,
      gaze_sensitivity: "medium",
      max_tab_switch_warnings: 3,
      total_marks: paper.questions.reduce((acc, q) => acc + (q.marks || 1), 0),
    };

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <ExamInstructionsModal
          isOpen={true}
          onClose={() => router.replace("/student/exams")}
          exam={examEquivalent}
          onStartExam={async () => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`exam_agreed_${sessionId}`, "true");
            }
            setHasConfirmedInstructions(true);
          }}
        />
      </div>
    );
  }

  const currentQ: StudentPaperQuestion = paper.questions[currentIdx];
  const currentAns = answers[currentQ?.id] || {
    selected_option_ids: [],
    answer_text: "",
    image_url: null,
    ocr_text: null,
    is_marked_for_review: false,
  };

  const isCurrentAnswered =
    currentAns.selected_option_ids.length > 0 ||
    currentAns.answer_text.trim().length > 0 ||
    Boolean(currentAns.image_url);

  // Counts for summary
  const totalQuestions = paper.questions.length;
  const answeredCount = Object.values(answers).filter(
    (a) => a.selected_option_ids.length > 0 || a.answer_text.trim().length > 0 || a.image_url
  ).length;
  const reviewCount = Object.values(answers).filter((a) => a.is_marked_for_review).length;

  const isLowTime = remainingSeconds < 600; // < 10 mins
  const isCriticalTime = remainingSeconds < 300; // < 5 mins

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Top Authoritative Exam Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-600 items-center justify-center font-bold text-white shadow-inner">
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate max-w-[110px] sm:max-w-xs" title={paper.title}>
                {paper.title}
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                {paper.subject}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Q{currentIdx + 1}/{totalQuestions} &bull; {paper.duration_minutes}m
            </p>
          </div>
        </div>

        {/* Center: Server-Authoritative Countdown Clock */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-bold tracking-wider ${
              isCriticalTime
                ? "bg-red-500/20 text-red-300 border-red-500 animate-pulse"
                : isLowTime
                ? "bg-amber-500/20 text-amber-300 border-amber-500"
                : "bg-slate-800 text-emerald-300 border-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Autosave Pill */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
            {saveStatus === "saving" ? (
              <>
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>All changes saved</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400">Error saving</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {paper.proctoring_enabled && (
            <button
              onClick={() => setShowProctorCam(!showProctorCam)}
              className={`p-1.5 sm:p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                showProctorCam ? "bg-slate-800 text-indigo-400" : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
              title="Toggle Proctor Camera View"
            >
              {showProctorCam ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden lg:inline">{showProctorCam ? "Cam Active" : "Cam Hidden"}</span>
            </button>
          )}

          {/* Fullscreen Mode Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 sm:p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isFullscreen ? "bg-slate-800 text-emerald-400 border border-emerald-500/40" : "bg-slate-800/60 text-slate-400 hover:text-white"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1 whitespace-nowrap"
          >
            <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Finish &amp; </span>Submit
          </button>
        </div>
      </header>

      {/* Proctoring Non-Intrusive Warning Banner */}
      {proctorWarning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-sm sticky top-14 z-30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0" />
            <span>{proctorWarning}</span>
          </div>
          <button onClick={() => setProctorWarning(null)} className="text-xs underline font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Examination Workspace - Full Window Viewport */}
      <div className="flex-1 w-full px-3 sm:px-5 lg:px-8 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Left Column: Active Question Workspace (Spans 8 cols on laptop, 9 on desktop) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5 flex flex-col justify-between">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            {/* Question Header Meta */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Question {currentIdx + 1}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 uppercase">
                  {(currentQ.question_type || "").replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-400 capitalize">Difficulty: {currentQ.difficulty}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800">
                  {currentQ.marks} Marks
                </span>
                <button
                  onClick={toggleMarkForReview}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    currentAns.is_marked_for_review
                      ? "bg-purple-100 text-purple-700 border border-purple-300"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {currentAns.is_marked_for_review ? "Marked for Review" : "Mark for Review"}
                </button>
              </div>
            </div>

            {/* Question Prompt */}
            <div className="space-y-4">
              <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                {currentQ.question_text}
              </p>

              {currentQ.image_url && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                  <img
                    src={currentQ.image_url}
                    alt="Question visual reference"
                    className="max-h-72 rounded-lg object-contain bg-white"
                  />
                </div>
              )}
            </div>

            {/* Answer Input Components */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              {(() => {
                const normType = (currentQ.question_type || "").toString().toLowerCase().trim().replace(/[\s-]+/g, "_");
                const isMCQ = normType === "mcq";
                const isMultiSelect = normType === "multi_select" || normType === "multiselect";
                const isShortAnswer = normType === "short_answer" || normType === "short";
                const isLongAnswer = normType === "long_answer" || normType === "long";
                const isImageUpload = normType === "image_upload" || normType === "image";

                return (
                  <>
                    {/* Type 1: MCQ (Single Select Radio Cards) */}
                    {isMCQ && (
                      <div className="space-y-2.5">
                        {currentQ.options.map((opt) => {
                          const isSelected = currentAns.selected_option_ids.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateCurrentAnswer({ selected_option_ids: [opt.id] })}
                              className={`w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between transition-all ${
                                isSelected
                                  ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600 text-indigo-950 font-semibold"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                                  }`}
                                >
                                  {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                                </span>
                                {opt.option_text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Type 2: MULTI_SELECT (Checkboxes) */}
                    {isMultiSelect && (
                      <div className="space-y-2.5">
                        <p className="text-xs text-indigo-600 font-medium mb-1">
                          Select all options that apply:
                        </p>
                        {currentQ.options.map((opt) => {
                          const isSelected = currentAns.selected_option_ids.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const currentIds = currentAns.selected_option_ids;
                                const nextIds = isSelected
                                  ? currentIds.filter((id) => id !== opt.id)
                                  : [...currentIds, opt.id];
                                updateCurrentAnswer({ selected_option_ids: nextIds });
                              }}
                              className={`w-full p-4 rounded-xl border text-left text-sm flex items-center justify-between transition-all ${
                                isSelected
                                  ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600 text-indigo-950 font-semibold"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </span>
                                {opt.option_text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Type 3: SHORT_ANSWER (Comfortable Multi-Line Textarea) */}
                    {isShortAnswer && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="student-short-answer-input" className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                            Student Answer (Short Answer)
                          </label>
                          <span className="text-xs text-slate-400">
                            {currentAns.answer_text.length} characters
                          </span>
                        </div>
                        <textarea
                          id="student-short-answer-input"
                          rows={5}
                          value={currentAns.answer_text}
                          onChange={(e) => updateCurrentAnswer({ answer_text: e.target.value })}
                          placeholder="Type your concise response here (e.g. definitions, brief explanations, direct answers)..."
                          className="w-full min-h-[140px] p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-900 leading-relaxed resize-y shadow-inner"
                        />
                        <div className="flex justify-between items-center text-xs text-slate-400">
                          <span>Supports multiple lines &bull; Press Enter for new lines</span>
                          <span className="text-emerald-600 font-medium">Autosave enabled</span>
                        </div>
                      </div>
                    )}

                    {/* Type 4: LONG_ANSWER (Rich Multi-Line Essay Editor) */}
                    {isLongAnswer && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="student-long-answer-input" className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                            Student Answer (Long Answer)
                          </label>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{currentAns.answer_text.length} characters</span>
                            <span>&bull;</span>
                            <span>
                              Words: {currentAns.answer_text.trim() ? currentAns.answer_text.trim().split(/\s+/).length : 0}
                            </span>
                          </div>
                        </div>
                        <textarea
                          id="student-long-answer-input"
                          rows={12}
                          value={currentAns.answer_text}
                          onChange={(e) => updateCurrentAnswer({ answer_text: e.target.value })}
                          placeholder="Provide your comprehensive explanation, proofs, step-by-step reasoning, and structured analysis..."
                          className="w-full min-h-[300px] p-4 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-900 leading-relaxed resize-y font-normal shadow-inner"
                        ></textarea>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                          <span>Organize your response with clear paragraphs, headings, or bullet points</span>
                          <span className="text-emerald-600 font-medium">Autosave enabled</span>
                        </div>
                      </div>
                    )}

                    {/* Type 5: IMAGE_UPLOAD (Handwritten Answer Sheet + OCR) */}
                    {isImageUpload && (
                      <div className="space-y-4">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Handwritten Answer Sheet Upload
                        </label>

                        {/* Dropzone & Selector */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/jpeg,image/png,image/jpg"
                            className="hidden"
                            id="handwritten-upload"
                          />
                          <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-700">Upload handwritten answer sheet</p>
                          <p className="text-xs text-slate-400 mt-1">JPEG, JPG, or PNG (Max 10MB)</p>
                          <label
                            htmlFor="handwritten-upload"
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                          >
                            Select Image File
                          </label>
                        </div>

                        {/* Upload Status / Preview */}
                        {uploadingImage && (
                          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center gap-2 text-indigo-700 text-xs font-medium">
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            Uploading image and performing OCR transcription...
                          </div>
                        )}

                        {currentAns.image_url && (
                          <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs font-semibold text-slate-700">Uploaded Sheet:</p>
                            <img
                              src={currentAns.image_url}
                              alt="Uploaded answer sheet"
                              className="max-h-64 rounded-lg border border-slate-300 object-contain mx-auto bg-white"
                            />
                            {currentAns.ocr_text && (
                              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                                <span className="font-semibold block mb-1">OCR Transcribed Text:</span>
                                <p className="italic font-mono">{currentAns.ocr_text}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Action Navigation Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAnswer}
                disabled={!isCurrentAnswered}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear Answer
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              {currentIdx < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs sm:text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" /> Review & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette & Proctor Monitor (Sticky Sidebar) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 sticky top-16">
          {/* 1. Live Proctoring Webcam (Permanently positioned above question numbers) */}
          {paper.proctoring_enabled && showProctorCam && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> Live Proctoring Active
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black w-full flex items-center justify-center">
                <ProctoringMonitor sessionId={sessionId} token={authService.getToken() || ""} embedded={true} />
              </div>
              <p className="text-[11px] text-slate-400 text-center leading-tight">
                Facial orientation analysis active &bull; Keep face centered in frame
              </p>
            </div>
          )}

          {/* 2. Question Navigator Palette (Directly below webcam) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Question Palette</h3>
              <span className="text-xs font-semibold text-indigo-600">
                {answeredCount} / {totalQuestions} Answered
              </span>
            </div>

            {/* Summary Indicators */}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-center border-y border-slate-100 py-2.5">
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-800 font-semibold">
                <span className="block text-sm">{answeredCount}</span> Answered
              </div>
              <div className="p-1.5 bg-purple-50 rounded-lg text-purple-800 font-semibold">
                <span className="block text-sm">{reviewCount}</span> In Review
              </div>
              <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 font-semibold">
                <span className="block text-sm">{totalQuestions - answeredCount}</span> Pending
              </div>
            </div>

            {/* Palette Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
              {paper.questions.map((q, idx) => {
                const ans = answers[q.id];
                const answered = ans && (ans.selected_option_ids.length > 0 || ans.answer_text.trim().length > 0 || ans.image_url);
                const inReview = ans?.is_marked_for_review;
                const isCurrent = idx === currentIdx;

                let btnBg = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                if (answered && inReview) {
                  btnBg = "bg-purple-600 text-white";
                } else if (inReview) {
                  btnBg = "bg-purple-100 text-purple-700 border border-purple-300";
                } else if (answered) {
                  btnBg = "bg-emerald-600 text-white";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${btnBg} ${
                      isCurrent ? "ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-sm" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span> Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-200"></span> Unanswered
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span> Marked for Review
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Finish Examination</h3>
              <p className="text-xs text-slate-500">
                Please verify your answer status before submitting.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-400 block">Answered</span>
                <span className="text-lg font-bold text-emerald-600">{answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Unanswered</span>
                <span className="text-lg font-bold text-slate-700">{totalQuestions - answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">In Review</span>
                <span className="text-lg font-bold text-purple-600">{reviewCount}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center leading-relaxed">
              Once submitted, you cannot modify your answers. The automatic evaluation engine will grade objective answers and initiate AI evaluation.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  "Confirm & Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
