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
import LanguageSelector from "@/components/layout/LanguageSelector";
import VirtualKeyboard from "@/components/student/VirtualKeyboard";
import { useLanguage } from "@/i18n";

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
  const { t, language } = useLanguage();

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

  // Submission Status State
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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
        setPaper(paperData);
        setSubmittedSuccess(true);
        setLoading(false);
        return;
      }

      setPaper(paperData);
      setRemainingSeconds(Math.max(0, sessionData.remaining_seconds));

      // Fetch any previously saved answers
      try {
        const savedList = await studentApi.getSavedAnswers(sessionId);
        if (Array.isArray(savedList)) {
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
      } catch (e) {
        console.warn("Could not pre-load saved answers:", e);
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
      setSubmittedSuccess(true);
      setShowSubmitModal(false);
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
      setSubmittedSuccess(true);
      setShowSubmitModal(false);
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

  // Render Professional Submission Confirmation Screen
  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="max-w-xl w-full bg-[#131d33] rounded-3xl border border-[#1e2d4a] p-8 sm:p-10 shadow-2xl space-y-6 text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          {/* Submission Heading & Subtitle */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t("evaluation.submissionSuccessTitle")}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              {t("evaluation.submissionSuccessDesc")}
            </p>
          </div>

          {/* Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 font-bold text-xs sm:text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{t("evaluation.submissionStatusSuccess")}</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{t("evaluation.submissionStatusPending")}</span>
            </div>
          </div>

          {/* Exam Info */}
          {paper && (
            <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e2d4a] text-xs text-slate-400 space-y-1 text-left">
              <p><span className="font-semibold text-slate-300">{t("examiner.examTitle")}:</span> {paper.title}</p>
              <p><span className="font-semibold text-slate-300">{t("examiner.subject")}:</span> {paper.subject}</p>
              <p><span className="font-semibold text-slate-300">{t("student.questions")}:</span> {paper.questions?.length || 0}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => router.replace("/student")}
              className="w-full sm:flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-sm font-bold transition-colors shadow-md shadow-teal-500/10 flex items-center justify-center gap-2"
            >
              <span>{t("evaluation.returnToDashboard")}</span>
            </button>
            <button
              onClick={() => router.replace("/student/results")}
              className="w-full sm:flex-1 py-3 bg-[#0b132b] hover:bg-[#1a2744] text-slate-200 border border-[#1e2d4a] rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <span>{t("evaluation.viewSubmittedExams")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-200">{t("instructions.enteringRoom")}</p>
        <p className="text-xs text-slate-400 mt-1">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#131d33] rounded-2xl border border-rose-800/60 p-8 text-center shadow-2xl space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Exam Access Error</h2>
          <p className="text-sm text-slate-300">{error || "Unable to start exam session"}</p>
          <button
            onClick={() => router.replace("/student/exams")}
            className="w-full py-2.5 bg-teal-600 text-slate-950 rounded-xl text-sm font-bold hover:bg-teal-500 transition-colors"
          >
            {t("student.availableExams")}
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
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
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

  const totalQuestions = paper.questions.length;
  const answeredCount = Object.values(answers).filter(
    (a) => a.selected_option_ids.length > 0 || a.answer_text.trim().length > 0 || a.image_url
  ).length;

  const reviewCount = Object.values(answers).filter((a) => a.is_marked_for_review).length;

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col font-sans select-none">
      {/* Top Examination Control Header */}
      <header className="bg-[#0b132b]/95 border-b border-[#1e2d4a] sticky top-0 z-40 px-3 sm:px-6 py-3 flex items-center justify-between shadow-lg shadow-black/20">
        {/* Left: Metadata & Student Language Selector */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-950/70 text-teal-300 border border-teal-500/40 uppercase">
              {paper.subject}
            </span>
            <h1 className="text-sm sm:text-base font-bold text-white max-w-[150px] sm:max-w-xs md:max-w-md truncate">
              {paper.title}
            </h1>
          </div>

          {/* Student Exam Language Selector */}
          <div className="pl-2 border-l border-[#1e2d4a]">
            <LanguageSelector />
          </div>
        </div>

        {/* Center: Authoritative Clock & Autosave */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-all ${
              remainingSeconds < 300
                ? "bg-rose-950/80 border-rose-600 text-rose-300 animate-pulse"
                : "bg-[#131d33] border-[#1e2d4a] text-teal-300 shadow-sm"
            }`}
          >
            <Clock className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{t("student.timeRemaining")}: {formatTimer(remainingSeconds)}</span>
          </div>

          {/* Autosave Pill */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
            {saveStatus === "saving" ? (
              <>
                <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                <span>{t("student.submitting")}</span>
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-teal-400/90">{t("student.allChangesSaved")}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400">{t("student.errorSaving")}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {paper.proctoring_enabled && (
            <button
              onClick={() => setShowProctorCam(!showProctorCam)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                showProctorCam ? "bg-teal-950/60 border-teal-500/40 text-teal-300" : "bg-[#131d33] border-[#1e2d4a] text-slate-400 hover:text-white"
              }`}
              title="Toggle Proctor Camera View"
            >
              {showProctorCam ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden lg:inline">{showProctorCam ? t("student.aiActive") : t("student.disabled")}</span>
            </button>
          )}

          {/* Fullscreen Mode Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              isFullscreen ? "bg-teal-950/60 border-teal-500/40 text-teal-300" : "bg-[#131d33] border-[#1e2d4a] text-slate-400 hover:text-white"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs sm:text-sm hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10 flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileCheck className="w-4 h-4" />
            <span>{t("student.finishAndSubmit")}</span>
          </button>
        </div>
      </header>

      {/* Proctoring Non-Intrusive Warning Banner */}
      {proctorWarning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md sticky top-14 z-30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0" />
            <span>{proctorWarning}</span>
          </div>
          <button onClick={() => setProctorWarning(null)} className="text-xs underline font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Examination Workspace */}
      <div className="flex-1 w-full px-3 sm:px-5 lg:px-8 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Left Column: Active Question Workspace */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5 flex flex-col justify-between">
          <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] p-5 sm:p-8 shadow-xl space-y-6">
            {/* Question Header Meta */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2d4a] pb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  {t("student.question")} {currentIdx + 1}
                </span>
                <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#162238] text-slate-300 border border-[#1e2d4a] uppercase">
                  {(currentQ.question_type || "").replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-400 capitalize">
                  {t("student.difficulty")}: {currentQ.difficulty}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#162238] text-slate-200 border border-[#1e2d4a]">
                  {currentQ.marks} {t("student.marks")}
                </span>
                <button
                  onClick={toggleMarkForReview}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    currentAns.is_marked_for_review
                      ? "bg-purple-950/80 text-purple-300 border-purple-500/60"
                      : "bg-[#162238] text-slate-300 hover:text-white border-[#1e2d4a]"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {currentAns.is_marked_for_review ? t("student.markedForReview") : t("student.markForReview")}
                </button>
              </div>
            </div>

            {/* Question Prompt (Exam question text remains UNCHANGED as authored by examiner) */}
            <div className="space-y-4">
              <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                {currentQ.question_text}
              </p>

              {currentQ.image_url && (
                <div className="p-3 bg-[#162238] rounded-xl border border-[#1e2d4a] inline-block">
                  <img
                    src={currentQ.image_url}
                    alt="Question visual reference"
                    className="max-h-72 rounded-lg object-contain bg-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Answer Input Components */}
            <div className="pt-4 border-t border-[#1e2d4a] space-y-4">
              {(() => {
                const normType = (currentQ.question_type || "").toString().toLowerCase().trim().replace(/[\s-]+/g, "_");
                const isMCQ = normType === "mcq";
                const isMultiSelect = normType === "multi_select" || normType === "multiselect";
                const isShortAnswer = normType === "short_answer" || normType === "short";
                const isLongAnswer = normType === "long_answer" || normType === "long";
                const isImageUpload = normType === "image_upload" || normType === "image";

                return (
                  <>
                    {/* MCQ (Radio buttons - Options remain UNCHANGED as authored) */}
                    {isMCQ && (
                      <div className="space-y-2.5">
                        {currentQ.options.map((opt) => {
                          const isSelected = currentAns.selected_option_ids.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateCurrentAnswer({ selected_option_ids: [opt.id] })}
                              className={`w-full p-4 rounded-2xl border text-left text-sm flex items-center justify-between transition-all ${
                                isSelected
                                  ? "bg-teal-500/20 border-teal-500 text-teal-100 font-semibold shadow-md shadow-teal-500/10"
                                  : "bg-[#162238] border-[#1e2d4a] text-slate-200 hover:bg-[#1a2744] hover:border-slate-500"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-teal-400 bg-teal-500 text-slate-950 font-bold" : "border-slate-500"
                                  }`}
                                >
                                  {isSelected && <span className="w-2 h-2 rounded-full bg-slate-950"></span>}
                                </span>
                                <span>{opt.option_text}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* MULTI_SELECT (Checkboxes) */}
                    {isMultiSelect && (
                      <div className="space-y-2.5">
                        <p className="text-xs text-teal-400 font-medium mb-1">
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
                              className={`w-full p-4 rounded-2xl border text-left text-sm flex items-center justify-between transition-all ${
                                isSelected
                                  ? "bg-teal-500/20 border-teal-500 text-teal-100 font-semibold shadow-md shadow-teal-500/10"
                                  : "bg-[#162238] border-[#1e2d4a] text-slate-200 hover:bg-[#1a2744] hover:border-slate-500"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                    isSelected ? "border-teal-400 bg-teal-500 text-slate-950 font-bold" : "border-slate-500"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </span>
                                <span>{opt.option_text}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* SHORT_ANSWER (Textarea + Virtual Keyboard) */}
                    {isShortAnswer && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="student-short-answer-input" className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                            {t("examiner.studentAnswer")} (Short Answer)
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
                          placeholder={t("student.shortAnswerPlaceholder")}
                          className="w-full min-h-[140px] p-4 text-sm bg-[#0f172a] border border-[#1e2d4a] rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-white leading-relaxed resize-y shadow-inner"
                        />
                        {/* Indic Virtual Keyboard Helper */}
                        {language !== "en" && (
                          <VirtualKeyboard
                            language={language}
                            onInsertChar={(char) =>
                              updateCurrentAnswer({ answer_text: currentAns.answer_text + char })
                            }
                            onDeleteChar={() =>
                              updateCurrentAnswer({ answer_text: currentAns.answer_text.slice(0, -1) })
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* LONG_ANSWER (Essay Textarea + Virtual Keyboard) */}
                    {isLongAnswer && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="student-long-answer-input" className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                            {t("examiner.studentAnswer")} (Long Answer)
                          </label>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{currentAns.answer_text.length} characters</span>
                          </div>
                        </div>
                        <textarea
                          id="student-long-answer-input"
                          rows={10}
                          value={currentAns.answer_text}
                          onChange={(e) => updateCurrentAnswer({ answer_text: e.target.value })}
                          placeholder={t("student.longAnswerPlaceholder")}
                          className="w-full min-h-[250px] p-4 text-sm bg-[#0f172a] border border-[#1e2d4a] rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-white leading-relaxed resize-y font-normal shadow-inner"
                        ></textarea>
                        {/* Indic Virtual Keyboard Helper */}
                        {language !== "en" && (
                          <VirtualKeyboard
                            language={language}
                            onInsertChar={(char) =>
                              updateCurrentAnswer({ answer_text: currentAns.answer_text + char })
                            }
                            onDeleteChar={() =>
                              updateCurrentAnswer({ answer_text: currentAns.answer_text.slice(0, -1) })
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* IMAGE_UPLOAD */}
                    {isImageUpload && (
                      <div className="space-y-4">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                          {t("student.handwrittenUpload")}
                        </label>

                        <div className="border-2 border-dashed border-[#1e2d4a] rounded-2xl p-6 text-center hover:bg-[#162238] transition-colors">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/jpeg,image/png,image/jpg"
                            className="hidden"
                            id="handwritten-upload"
                          />
                          <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-200">{t("student.handwrittenUpload")}</p>
                          <p className="text-xs text-slate-400 mt-1">JPEG, JPG, or PNG (Max 10MB)</p>
                          <label
                            htmlFor="handwritten-upload"
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-bold cursor-pointer shadow-md transition-colors"
                          >
                            {t("student.selectImageFile")}
                          </label>
                        </div>

                        {uploadingImage && (
                          <div className="p-4 bg-teal-950/40 rounded-xl border border-teal-500/30 flex items-center justify-center gap-2 text-teal-300 text-xs font-medium">
                            <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                            {t("student.uploadingImage")}
                          </div>
                        )}

                        {currentAns.image_url && (
                          <div className="space-y-3 p-4 bg-[#162238] rounded-xl border border-[#1e2d4a]">
                            <p className="text-xs font-semibold text-slate-300">Uploaded Sheet:</p>
                            <img
                              src={currentAns.image_url}
                              alt="Uploaded answer sheet"
                              className="max-h-64 rounded-lg border border-[#1e2d4a] object-contain mx-auto bg-slate-950"
                            />
                            {currentAns.ocr_text && (
                              <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e2d4a] text-xs text-slate-300">
                                <span className="font-semibold block mb-1">{t("student.ocrText")}:</span>
                                <p className="italic font-mono text-[11px]">{currentAns.ocr_text}</p>
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
          <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] p-4 shadow-lg flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleClearAnswer}
              disabled={!isCurrentAnswered}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-[#162238] disabled:opacity-30 transition-colors flex items-center gap-1 border border-transparent hover:border-[#1e2d4a]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t("student.clearAnswer")}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2.5 rounded-xl border border-[#1e2d4a] bg-[#162238] text-slate-200 font-semibold text-xs sm:text-sm hover:bg-[#1a2744] hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> {t("student.previousQuestion")}
              </button>

              {currentIdx < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs sm:text-sm hover:bg-teal-400 transition-colors shadow-md flex items-center gap-1.5"
                >
                  {t("student.nextQuestion")} <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm hover:bg-emerald-400 transition-colors shadow-md flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" /> {t("student.reviewAndSubmit")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette & Proctor Monitor */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 sticky top-20">
          {/* Live Proctoring Webcam */}
          {paper.proctoring_enabled && showProctorCam && (
            <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] p-3.5 sm:p-4 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-400" /> {t("student.proctoring")}
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[#1e2d4a] aspect-video bg-black w-full flex items-center justify-center">
                <ProctoringMonitor sessionId={sessionId} token={authService.getToken() || ""} embedded={true} />
              </div>
            </div>
          )}

          {/* Question Navigator Palette */}
          <div className="bg-[#131d33] rounded-2xl border border-[#1e2d4a] p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{t("student.questionPalette")}</h3>
              <span className="text-xs font-semibold text-teal-400">
                {answeredCount} / {totalQuestions}
              </span>
            </div>

            {/* Summary Indicators */}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-center border-y border-[#1e2d4a] py-2.5">
              <div className="p-2 bg-emerald-950/60 border border-emerald-800/40 rounded-xl text-emerald-300 font-semibold">
                <span className="block text-sm font-bold">{answeredCount}</span> {t("student.answered")}
              </div>
              <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-xl text-purple-300 font-semibold">
                <span className="block text-sm font-bold">{reviewCount}</span> {t("student.inReview")}
              </div>
              <div className="p-2 bg-[#162238] border border-[#1e2d4a] rounded-xl text-slate-300 font-semibold">
                <span className="block text-sm font-bold">{totalQuestions - answeredCount}</span> {t("student.unanswered")}
              </div>
            </div>

            {/* Palette Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
              {paper.questions.map((q, idx) => {
                const ans = answers[q.id];
                const answered = ans && (ans.selected_option_ids.length > 0 || ans.answer_text.trim().length > 0 || ans.image_url);
                const inReview = ans?.is_marked_for_review;
                const isCurrent = idx === currentIdx;

                let btnBg = "bg-[#162238] text-slate-300 border border-[#1e2d4a] hover:bg-[#1a2744]";
                if (answered && inReview) {
                  btnBg = "bg-purple-600 text-white font-bold border border-purple-400";
                } else if (inReview) {
                  btnBg = "bg-purple-950/80 text-purple-300 border border-purple-500/60";
                } else if (answered) {
                  btnBg = "bg-emerald-600 text-white font-bold border border-emerald-400";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${btnBg} ${
                      isCurrent ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-[#0b132b] scale-105 shadow-md" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-[#1e2d4a] space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span> {t("student.answered")}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#162238] border border-[#1e2d4a]"></span> {t("student.unanswered")}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600"></span> {t("student.markedForReview")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131d33] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#1e2d4a] space-y-6 text-white">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">{t("student.confirmSubmitTitle")}</h3>
              <p className="text-xs text-slate-400">
                {t("student.confirmSubmitDesc")}
              </p>
            </div>

            <div className="bg-[#162238] p-4 rounded-2xl border border-[#1e2d4a] grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-400 block">{t("student.answered")}</span>
                <span className="text-lg font-bold text-emerald-400">{answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t("student.unanswered")}</span>
                <span className="text-lg font-bold text-slate-200">{totalQuestions - answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t("student.inReview")}</span>
                <span className="text-lg font-bold text-purple-400">{reviewCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-[#1e2d4a] bg-[#162238] text-slate-200 font-semibold text-sm hover:bg-[#1a2744] transition-colors"
              >
                {t("student.returnToExam")}
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    {t("student.submitting")}
                  </>
                ) : (
                  t("student.confirmAndSubmit")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
