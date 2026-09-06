"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseFaceDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onFaceAbsent?: () => void;
  onMultipleFaces?: (count: number) => void;
  detectionIntervalMs?: number;
}

export function useFaceDetection({
  videoRef,
  isActive,
  onFaceAbsent,
  onMultipleFaces,
  detectionIntervalMs = 600,
}: UseFaceDetectionOptions) {
  const [faceCount, setFaceCount] = useState<number>(1);
  const [isDetectorReady, setIsDetectorReady] = useState<boolean>(false);
  const detectorRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const absentCounterRef = useRef<number>(0);
  const multipleCounterRef = useRef<number>(0);

  // Initialize MediaPipe Face Detection
  useEffect(() => {
    let isMounted = true;

    async function initDetector() {
      if (typeof window === "undefined") return;

      try {
        const { FaceDetection } = await import("@mediapipe/face_detection");
        const detector = new FaceDetection({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });

        detector.setOptions({
          model: "short",
          minDetectionConfidence: 0.5,
        });

        detector.onResults((results: any) => {
          if (!isMounted) return;
          const detections = results.detections || [];
          const count = detections.length;
          setFaceCount(count);

          if (count === 0) {
            absentCounterRef.current += 1;
            multipleCounterRef.current = 0;
            // Trigger absent after 2 consecutive frames (~1.2s)
            if (absentCounterRef.current >= 2) {
              onFaceAbsent?.();
              absentCounterRef.current = 0;
            }
          } else if (count > 1) {
            multipleCounterRef.current += 1;
            absentCounterRef.current = 0;
            // Trigger multiple after 2 consecutive frames
            if (multipleCounterRef.current >= 2) {
              onMultipleFaces?.(count);
              multipleCounterRef.current = 0;
            }
          } else {
            absentCounterRef.current = 0;
            multipleCounterRef.current = 0;
          }
        });

        detectorRef.current = detector;
        if (isMounted) setIsDetectorReady(true);
      } catch (err) {
        console.warn("MediaPipe FaceDetection initialization notice:", err);
        // Fallback: stay marked ready so UI continues without crashing
        if (isMounted) setIsDetectorReady(true);
      }
    }

    initDetector();

    return () => {
      isMounted = false;
      if (detectorRef.current?.close) {
        try {
          detectorRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [onFaceAbsent, onMultipleFaces]);

  // Frame processing loop
  useEffect(() => {
    if (!isActive || !isDetectorReady) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && detectorRef.current?.send) {
        try {
          await detectorRef.current.send({ image: video });
        } catch {
          // Frame skip handling
        }
      }
    }, detectionIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isDetectorReady, detectionIntervalMs, videoRef]);

  return {
    faceCount,
    isDetectorReady,
  };
}
