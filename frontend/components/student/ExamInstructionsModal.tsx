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
      // Request browser fullscreen on user gesture
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {t("instructions.title")}
              </h2>
              <p className="text-xs text-slate-500">
                {t("instructions.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Error Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-700 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Exam Summary Metadata Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="mb-3 pb-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {exam.subject}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {exam.title}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {t("instructions.liveSession")}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.questions")}</span>
                <span className="text-sm sm:text-base font-bold text-slate-800 mt-0.5 block">
                  {exam.question_count}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.duration")}</span>
                <span className="text-sm sm:text-base font-bold text-indigo-600 mt-0.5 block">
                  {t("student.durationMins", { duration: exam.duration })}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.totalMarks")}</span>
                <span className="text-sm sm:text-base font-bold text-slate-800 mt-0.5 block">
                  {totalMarksDisplay}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
                <span className="text-[11px] text-slate-400 block font-medium">{t("student.proctoring")}</span>
                <span className="text-sm sm:text-base font-bold text-slate-800 mt-0.5 block">
                  {exam.proctoring_enabled ? t("student.aiActive") : t("student.disabled")}
                </span>
              </div>
            </div>
          </div>

          {/* Configured Dynamic Proctoring Safeguards */}
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> {t("instructions.configuredSafeguards")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              <div className="p-2.5 bg-white/80 rounded-xl border border-indigo-100">
                <span className="text-slate-400 block text-[11px]">{t("instructions.tabSwitchWarnings")}</span>
                <span className="font-bold text-slate-800">
                  {exam.proctoring_enabled
                    ? t("instructions.maxWarnings", { count: maxTabWarnings })
                    : t("instructions.notEnforced")}
                </span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-indigo-100">
                <span className="text-slate-400 block text-[11px]">{t("instructions.gazeSensitivity")}</span>
                <span className="font-bold text-slate-800 capitalize">
                  {exam.proctoring_enabled ? `${gazeSensitivity}` : t("instructions.notEnforced")}
                </span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-indigo-100">
                <span className="text-slate-400 block text-[11px]">{t("instructions.negativePenalty")}</span>
                <span className="font-bold text-slate-800">
                  {exam.negative_marking_enabled ? t("instructions.activePenalty") : t("instructions.noPenalty")}
                </span>
              </div>
            </div>
          </div>

          {/* Examination Rules Box (Scrollable) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>{t("instructions.importantInstructions")}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs sm:text-[13px] text-slate-700 space-y-3 leading-relaxed max-h-60 overflow-y-auto pr-2">
              {guidelines.map((item, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0"></span>
                  <p>
                    <strong>{item.title}:</strong> {item.rule}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Agreement Checkbox Container */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200/90 transition-colors hover:bg-indigo-50">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="instruction-agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                {t("instructions.agreementText")}
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            {agreed ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
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
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-white transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>

            <button
              type="button"
              onClick={handleStart}
              disabled={!agreed || loading}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
