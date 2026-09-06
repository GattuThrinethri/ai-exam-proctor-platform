"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { CameraStatus, SocketStatus } from "../../hooks/useProctoring";

interface ProctoringStatusProps {
  cameraStatus: CameraStatus;
  socketStatus: SocketStatus;
  tabSwitchCount: number;
  maxWarnings: number;
}

export const ProctoringStatus: React.FC<ProctoringStatusProps> = ({
  cameraStatus,
  socketStatus,
  tabSwitchCount,
  maxWarnings,
}) => {
  const isHealthy = cameraStatus === "granted" && socketStatus === "connected";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-xs shadow-sm backdrop-blur-sm">
      {/* Proctoring Shield */}
      <div className="flex items-center gap-1.5 font-medium">
        {isHealthy ? (
          <>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300">Proctoring Active</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300">
              {cameraStatus === "denied"
                ? "Camera Required"
                : socketStatus === "connecting"
                ? "Connecting..."
                : "Monitoring Alert"}
            </span>
          </>
        )}
      </div>

      <div className="w-px h-3.5 bg-slate-700" />

      {/* Connection Indicator */}
      <div className="flex items-center gap-1 text-slate-400">
        {socketStatus === "connected" ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        )}
        <span className="text-[11px] capitalize">{socketStatus}</span>
      </div>

      {/* Tab Switch Pill if warnings exist */}
      {tabSwitchCount > 0 && (
        <>
          <div className="w-px h-3.5 bg-slate-700" />
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <span>Tab switches:</span>
            <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-800/80 rounded text-[11px]">
              {tabSwitchCount} / {maxWarnings}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
