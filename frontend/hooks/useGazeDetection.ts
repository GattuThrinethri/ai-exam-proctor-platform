"use client";

import { useEffect, useRef, useState } from "react";

interface UseGazeDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  gazeSensitivity?: "low" | "medium" | "high";
  onGazeAway?: () => void;
  detectionIntervalMs?: number;
}

const SENSITIVITY_THRESHOLDS = {
  low: 0.38,
  medium: 0.26,
  high: 0.18,
};

export function useGazeDetection({
  videoRef,
  isActive,
  gazeSensitivity = "medium",
  onGazeAway,
  detectionIntervalMs = 750,
}: UseGazeDetectionOptions) {
  const [isLookingAway, setIsLookingAway] = useState<boolean>(false);
  const [isMeshReady, setIsMeshReady] = useState<boolean>(false);
  const meshRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const gazeCounterRef = useRef<number>(0);

  const threshold = SENSITIVITY_THRESHOLDS[gazeSensitivity] || SENSITIVITY_THRESHOLDS.medium;

  // Initialize MediaPipe FaceMesh
  useEffect(() => {
    let isMounted = true;

    async function initMesh() {
      if (typeof window === "undefined") return;

      try {
        const { FaceMesh } = await import("@mediapipe/face_mesh");
        const mesh = new FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        mesh.onResults((results: any) => {
          if (!isMounted) return;
          const multiFaceLandmarks = results.multiFaceLandmarks;
          if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
            setIsLookingAway(false);
            gazeCounterRef.current = 0;
            return;
          }

          const landmarks = multiFaceLandmarks[0];
          // Key landmarks: Nose tip (1), Left eye outer (33), Right eye outer (263)
          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];

          if (nose && leftEye && rightEye) {
            const eyeDistance = Math.abs(rightEye.x - leftEye.x);
            if (eyeDistance > 0.05) {
              const eyeMidpointX = (leftEye.x + rightEye.x) / 2;
              const noseOffset = Math.abs(nose.x - eyeMidpointX);
              const deviationRatio = noseOffset / eyeDistance;

              const lookingAway = deviationRatio > threshold;
              setIsLookingAway(lookingAway);

              if (lookingAway) {
                gazeCounterRef.current += 1;
                // Require 2 consecutive intervals to debounce momentary blinks
                if (gazeCounterRef.current >= 2) {
                  onGazeAway?.();
                  gazeCounterRef.current = 0;
                }
              } else {
                gazeCounterRef.current = 0;
              }
            }
          }
        });

        meshRef.current = mesh;
        if (isMounted) setIsMeshReady(true);
      } catch (err) {
        console.warn("MediaPipe FaceMesh initialization notice:", err);
        if (isMounted) setIsMeshReady(true);
      }
    }

    initMesh();

    return () => {
      isMounted = false;
      if (meshRef.current?.close) {
        try {
          meshRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [onGazeAway, threshold]);

  // Frame processing loop
  useEffect(() => {
    if (!isActive || !isMeshReady) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && meshRef.current?.send) {
        try {
          await meshRef.current.send({ image: video });
        } catch {
          // Frame skip
        }
      }
    }, detectionIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isMeshReady, detectionIntervalMs, videoRef]);

  return {
    isLookingAway,
    isMeshReady,
  };
}
