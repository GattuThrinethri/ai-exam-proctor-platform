"use client";

import React from "react";
import { Camera, CameraOff, AlertCircle, Eye, Users } from "lucide-react";
import { CameraStatus } from "../../hooks/useProctoring";

interface WebcamPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraStatus: CameraStatus;
  faceCount: number;
  isLookingAway: boolean;
  className?: string;
}

export const WebcamPreview: React.FC<WebcamPreviewProps> = ({
  videoRef,
  cameraStatus,
  faceCount,
  isLookingAway,
  className,
}) => {
  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-md ${className || "w-48 h-36"}`}>
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${cameraStatus === "granted" ? "block" : "hidden"}`}
      />

      {/* States when video is not active */}
      {cameraStatus === "requesting" && (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-2 text-center text-xs">
          <Camera className="w-6 h-6 animate-pulse mb-1 text-indigo-400" />
          <span>Starting camera...</span>
        </div>
      )}

      {cameraStatus === "denied" && (
        <div className="flex flex-col items-center justify-center h-full bg-red-950/60 text-red-300 p-2 text-center text-xs">
          <CameraOff className="w-6 h-6 mb-1 text-red-400" />
          <span className="font-semibold">Camera Blocked</span>
          <span className="text-[10px] text-red-400 mt-0.5">Please allow webcam access</span>
        </div>
      )}

      {cameraStatus === "unavailable" && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-800 text-slate-400 p-2 text-center text-xs">
          <AlertCircle className="w-6 h-6 mb-1 text-amber-400" />
          <span>No camera found</span>
        </div>
      )}

      {cameraStatus === "idle" && (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
          <Camera className="w-6 h-6 mb-1" />
          <span>Camera inactive</span>
        </div>
      )}

      {/* Real-time Indicator Badges */}
      {cameraStatus === "granted" && (
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {faceCount === 1 && !isLookingAway && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
              Verified
            </span>
          )}

          {faceCount === 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-700/60">
              <AlertCircle className="w-2.5 h-2.5 mr-1" />
              Face Absent
            </span>
          )}

          {faceCount > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-700/60">
              <Users className="w-2.5 h-2.5 mr-1" />
              Multiple Faces
            </span>
          )}

          {isLookingAway && faceCount === 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-950/80 text-yellow-300 border border-yellow-700/60">
              <Eye className="w-2.5 h-2.5 mr-1" />
              Gaze Away
            </span>
          )}
        </div>
      )}
    </div>
  );
};
