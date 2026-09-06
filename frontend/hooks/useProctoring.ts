"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ProctorWebSocketClient, ProctorEventType } from "../services/proctoring";
import { useFaceDetection } from "./useFaceDetection";
import { useGazeDetection } from "./useGazeDetection";

export type CameraStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "ended";
export type SocketStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseProctoringOptions {
  sessionId: number;
  token: string;
  proctoringEnabled?: boolean;
  gazeSensitivity?: "low" | "medium" | "high";
  maxTabSwitchWarnings?: number;
  isSessionActive?: boolean;
}

export function useProctoring({
  sessionId,
  token,
  proctoringEnabled = true,
  gazeSensitivity = "medium",
  maxTabSwitchWarnings = 3,
  isSessionActive = true,
}: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<ProctorWebSocketClient | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("disconnected");
  const [tabSwitchWarnings, setTabSwitchWarnings] = useState<number>(0);
  const [lastWarning, setLastWarning] = useState<string | null>(null);

  const lastEventTimesRef = useRef<Record<string, number>>({});

  // Helper to send debounced events over WebSocket
  const triggerProctorEvent = useCallback(
    (eventType: ProctorEventType, cooldownMs: number = 4000, metadata?: Record<string, any>) => {
      if (!isSessionActive || !proctoringEnabled) return;

      const now = Date.now();
      const lastTime = lastEventTimesRef.current[eventType] || 0;
      if (now - lastTime < cooldownMs) return;

      lastEventTimesRef.current[eventType] = now;
      clientRef.current?.sendEvent(eventType, metadata);
    },
    [isSessionActive, proctoringEnabled]
  );

  // Initialize and manage Camera
  useEffect(() => {
    if (!proctoringEnabled || !isSessionActive) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unavailable");
        return;
      }

      setCameraStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Listen for track ending
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (isMounted) setCameraStatus("ended");
          };
        });

        setCameraStatus("granted");
      } catch (err: any) {
        if (!isMounted) return;
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraStatus("denied");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setCameraStatus("unavailable");
        } else {
          setCameraStatus("unavailable");
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [proctoringEnabled, isSessionActive]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("idle");
  }, []);

  // Initialize and manage WebSocket connection
  useEffect(() => {
    if (!proctoringEnabled || !isSessionActive || !token || !sessionId) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      return;
    }

    const client = new ProctorWebSocketClient(
      sessionId,
      token,
      (status) => setSocketStatus(status),
      (warningMsg) => setLastWarning(warningMsg)
    );

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sessionId, token, proctoringEnabled, isSessionActive]);

  // Tab switch monitoring (Page Visibility API)
  useEffect(() => {
    if (!proctoringEnabled || !isSessionActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchWarnings((prev) => {
          const nextCount = prev + 1;
          triggerProctorEvent("TAB_SWITCH", 3000, {
            warning_count: nextCount,
            max_warnings: maxTabSwitchWarnings,
          });
          setLastWarning(`Tab switch detected (Warning ${nextCount}/${maxTabSwitchWarnings})`);
          return nextCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [proctoringEnabled, isSessionActive, maxTabSwitchWarnings, triggerProctorEvent]);

  // Window blur monitoring (Focus/Blur API)
  useEffect(() => {
    if (!proctoringEnabled || !isSessionActive) return;

    const handleWindowBlur = () => {
      triggerProctorEvent("WINDOW_BLUR", 4000, { timestamp: new Date().toISOString() });
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [proctoringEnabled, isSessionActive, triggerProctorEvent]);

  // Face Detection callbacks
  const handleFaceAbsent = useCallback(() => {
    triggerProctorEvent("FACE_ABSENT", 5000);
    setLastWarning("No face detected in camera view.");
  }, [triggerProctorEvent]);

  const handleMultipleFaces = useCallback(
    (count: number) => {
      triggerProctorEvent("MULTIPLE_FACES", 5000, { face_count: count });
      setLastWarning("Multiple faces detected in camera view.");
    },
    [triggerProctorEvent]
  );

  const { faceCount, isDetectorReady } = useFaceDetection({
    videoRef,
    isActive: proctoringEnabled && isSessionActive && cameraStatus === "granted",
    onFaceAbsent: handleFaceAbsent,
    onMultipleFaces: handleMultipleFaces,
  });

  // Gaze Detection callbacks
  const handleGazeAway = useCallback(() => {
    triggerProctorEvent("GAZE_AWAY", 4000, { sensitivity: gazeSensitivity });
    setLastWarning("Looking away from screen detected.");
  }, [triggerProctorEvent, gazeSensitivity]);

  const { isLookingAway } = useGazeDetection({
    videoRef,
    isActive: proctoringEnabled && isSessionActive && cameraStatus === "granted",
    gazeSensitivity,
    onGazeAway: handleGazeAway,
  });

  return {
    videoRef,
    cameraStatus,
    socketStatus,
    faceCount,
    isLookingAway,
    tabSwitchWarnings,
    lastWarning,
    stopProctoring: stopCamera,
  };
}
