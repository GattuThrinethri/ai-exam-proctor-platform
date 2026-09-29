"use client";

import { useState } from "react";
import {
  X,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Exam } from "@/services/api";
import { useLanguage } from "@/i18n";
import LanguageSelector from "@/components/layout/LanguageSelector";

interface ExamInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  onStartExam: (exam: Exam) => Promise<void>;
  loading?: boolean;
}

export default function ExamInstructionsModal({
  isOpen,
  onClose,
  exam,
  onStartExam,
  loading = false,
}: ExamInstructionsModalProps) {
  const { t } = useLanguage();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !exam) return null;

  const totalMarksDisplay = exam.total_marks
    ? `${exam.total_marks} ${t("student.marks")}`
    : `${exam.question_count * 5} ${t("student.marks")}`;

  const maxTabWarnings = exam.max_tab_switch_warnings ?? 3;
  const gazeSensitivity = (exam.gaze_sensitivity || "medium").toLowerCase();

  const handleStart = async () => {
    if (!agreed) {
      setError(t("instructions.agreementRequired"));
      return;
    }
    setError(null);
    try {
      if (typeof document !== "undefined" && document.documentElement && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen().catch(() => {});
        } catch {
          // Gracefully continue if browser policy or user denies fullscreen
        }
      }
      await onStartExam(exam);
    } catch (err: any) {
      setError(err.message || "Failed to start examination");
    }
  };

  const guidelines = [
    {
      title: t("instructions.internetStabilityTitle"),
      rule: t("instructions.internetStabilityRule"),
    },
    {
      title: t("instructions.timerTitle"),
      rule: t("instructions.timerRule"),
    },
    {
      title: t("instructions.windowFocusTitle"),
      rule: t("instructions.windowFocusRule"),
    },
    {
      title: t("instructions.webcamTitle"),
      rule: t("instructions.webcamRule"),
    },
    {
      title: t("instructions.gazeTitle"),
      rule: t("instructions.gazeRule"),
    },
    {
      title: t("instructions.browserActionsTitle"),
      rule: t("instructions.browserActionsRule"),
    },
    {
      title: t("instructions.submissionTitle"),
      rule: t("instructions.submissionRule"),
    },
    {
      title: t("instructions.resumptionTitle"),
      rule: t("instructions.resumptionRule"),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#131d33] text-slate-100 w-full max-w-3xl rounded-3xl shadow-2xl border border-[#1e2d4a] overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#1e2d4a] flex items-center justify-between bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {t("instructions.title")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("instructions.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Student Language Selector inside Pre-Exam Instructions */}
            <LanguageSelector />
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#162238] transition-colors disabled:opacity-50"
              title={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-2.5 text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Exam Summary Metadata Grid */}
          <div className="bg-[#162238] border border-[#1e2d4a] rounded-2xl p-4 sm:p-5">
            <div className="mb-3 pb-3 border-b border-[#1e2d4a] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-teal-300 bg-teal-950/80 border border-teal-500/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {exam.subject}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                  {exam.title}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> {t("instructions.liveSession")}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-[#0f172a] rounded-xl border border-[#1e2d4a]">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.questions")}</span>
                <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  {exam.question_count}
                </span>
              </div>
              <div className="p-3 bg-[#0f172a] rounded-xl border border-[#1e2d4a]">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.duration")}</span>
                <span className="text-sm sm:text-base font-bold text-teal-400 mt-0.5 block">
                  {t("student.durationMins", { duration: exam.duration })}
                </span>
              </div>
              <div className="p-3 bg-[#0f172a] rounded-xl border border-[#1e2d4a]">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.totalMarks")}</span>
                <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  {totalMarksDisplay}
                </span>
              </div>
              <div className="p-3 bg-[#0f172a] rounded-xl border border-[#1e2d4a]">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.proctoring")}</span>
                <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
                  {exam.proctoring_enabled ? t("student.aiActive") : t("student.disabled")}
                </span>
              </div>
            </div>
          </div>

          {/* Configured Dynamic Proctoring Safeguards */}
          <div className="border border-teal-500/30 bg-teal-950/20 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" /> {t("instructions.configuredSafeguards")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-200">
              <div className="p-2.5 bg-[#162238] rounded-xl border border-[#1e2d4a]">
                <span className="text-slate-400 block text-[11px]">{t("instructions.tabSwitchWarnings")}</span>
                <span className="font-bold text-white">
                  {exam.proctoring_enabled
                    ? t("instructions.maxWarnings", { count: maxTabWarnings })
                    : t("instructions.notEnforced")}
                </span>
              </div>
              <div className="p-2.5 bg-[#162238] rounded-xl border border-[#1e2d4a]">
                <span className="text-slate-400 block text-[11px]">{t("instructions.gazeSensitivity")}</span>
                <span className="font-bold text-white capitalize">
                  {exam.proctoring_enabled ? `${gazeSensitivity}` : t("instructions.notEnforced")}
                </span>
              </div>
              <div className="p-2.5 bg-[#162238] rounded-xl border border-[#1e2d4a]">
                <span className="text-slate-400 block text-[11px]">{t("instructions.negativePenalty")}</span>
                <span className="font-bold text-white">
                  {exam.negative_marking_enabled ? t("instructions.activePenalty") : t("instructions.noPenalty")}
                </span>
              </div>
            </div>
          </div>

          {/* Examination Rules Box (Scrollable) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{t("instructions.importantInstructions")}</span>
            </div>

            <div className="bg-[#0f172a] border border-[#1e2d4a] rounded-2xl p-4 sm:p-5 text-xs sm:text-[13px] text-slate-300 space-y-3 leading-relaxed max-h-60 overflow-y-auto pr-2">
              {guidelines.map((item, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0"></span>
                  <p>
                    <strong className="text-white">{item.title}:</strong> {item.rule}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Agreement Checkbox Container */}
          <div className="p-4 rounded-2xl bg-teal-950/40 border-2 border-teal-500/50 transition-colors hover:bg-teal-950/60">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="instruction-agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded-md border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-400 mt-0.5 cursor-pointer shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                {t("instructions.agreementText")}
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-[#1e2d4a] bg-[#0f172a] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            {agreed ? (
              <span className="text-teal-400 font-medium flex items-center gap-1">
                ✓ {t("instructions.agreementAcknowledged")}
              </span>
            ) : (
              t("instructions.agreementRequired")
            )}
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[#1e2d4a] bg-[#162238] text-slate-200 font-semibold text-xs sm:text-sm hover:bg-[#1a2744] transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>

            <button
              type="button"
              onClick={handleStart}
              disabled={!agreed || loading}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs sm:text-sm hover:bg-teal-400 transition-all shadow-md shadow-teal-500/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>{t("instructions.enteringRoom")}</span>
                </>
              ) : (
                <>
                  <span>{t("instructions.startExamButton")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
