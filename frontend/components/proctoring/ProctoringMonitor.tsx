"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useProctoring } from "../../hooks/useProctoring";
import { WebcamPreview } from "./WebcamPreview";
import { ProctoringStatus } from "./ProctoringStatus";

interface ProctoringMonitorProps {
  sessionId: number;
  token: string;
  proctoringEnabled?: boolean;
  gazeSensitivity?: "low" | "medium" | "high";
  maxTabSwitchWarnings?: number;
  isSessionActive?: boolean;
  embedded?: boolean;
}

export const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  sessionId,
  token,
  proctoringEnabled = true,
  gazeSensitivity = "medium",
  maxTabSwitchWarnings = 3,
  isSessionActive = true,
  embedded = false,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const {
    videoRef,
    cameraStatus,
    socketStatus,
    faceCount,
    isLookingAway,
    tabSwitchWarnings,
    lastWarning,
  } = useProctoring({
    sessionId,
    token,
    proctoringEnabled,
    gazeSensitivity,
    maxTabSwitchWarnings,
    isSessionActive,
  });

  if (!proctoringEnabled) return null;

  if (embedded) {
    return (
      <div className="relative w-full h-full flex flex-col justify-center items-center">
        {/* Dynamic Alert Banner when warning triggers */}
        {lastWarning && isSessionActive && (
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-2 bg-amber-950/95 text-amber-200 border border-amber-700/80 px-2.5 py-1 rounded-lg text-[11px] shadow-lg animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{lastWarning}</span>
          </div>
        )}

        <WebcamPreview
          videoRef={videoRef}
          cameraStatus={cameraStatus}
          faceCount={faceCount}
          isLookingAway={isLookingAway}
          className="w-full h-full aspect-video"
        />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Dynamic Alert Banner when warning triggers */}
      {lastWarning && isSessionActive && (
        <div className="flex items-center gap-2 bg-amber-950/90 text-amber-200 border border-amber-700/80 px-3 py-1.5 rounded-lg text-xs shadow-lg animate-bounce">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{lastWarning}</span>
        </div>
      )}

      {/* Floating Proctoring Control Container */}
      <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-2 shadow-2xl backdrop-blur-md transition-all duration-200">
        <div className="flex items-center justify-between gap-3 mb-1.5 px-1">
          <ProctoringStatus
            cameraStatus={cameraStatus}
            socketStatus={socketStatus}
            tabSwitchCount={tabSwitchWarnings}
            maxWarnings={maxTabSwitchWarnings}
          />
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
            title={isMinimized ? "Expand Camera" : "Minimize Camera"}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expandable Preview */}
        {!isMinimized && (
          <WebcamPreview
            videoRef={videoRef}
            cameraStatus={cameraStatus}
            faceCount={faceCount}
            isLookingAway={isLookingAway}
          />
        )}
      </div>
    </div>
  );
};

export default ProctoringMonitor;
