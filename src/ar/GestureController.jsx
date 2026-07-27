/**
 * GestureController.jsx
 * 
 * Touch Gesture Controller for WebXR AR Mode.
 * Handles two-finger touch gestures for pinch-to-scale and Y-axis-only object rotation.
 * Prevents single-finger accidental movement and maintains world-space placement anchors.
 */

import React, { useEffect, useRef } from "react";

export function useGestureController({ isARActive, isPlaced, setScale, setYRotation }) {
    const initialPinchDistRef = useRef(null);
    const initialScaleRef = useRef(1.0);

    const initialAngleRef = useRef(null);
    const initialYRotationRef = useRef(0);

    useEffect(() => {
        if (!isARActive || !isPlaced) return;

        const getTouchDistance = (t1, t2) => {
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getTouchAngle = (t1, t2) => {
            return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 2) {
                // Initialize Pinch-to-scale reference distance
                const dist = getTouchDistance(e.touches[0], e.touches[1]);
                initialPinchDistRef.current = dist;
                setScale((currentScale) => {
                    initialScaleRef.current = currentScale;
                    return currentScale;
                });

                // Initialize Two-finger rotation reference angle
                const angle = getTouchAngle(e.touches[0], e.touches[1]);
                initialAngleRef.current = angle;
                setYRotation((currentRot) => {
                    initialYRotationRef.current = currentRot;
                    return currentRot;
                });
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 2 && initialPinchDistRef.current && initialAngleRef.current !== null) {
                e.preventDefault();

                // 1. Pinch-to-scale calculation
                const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
                if (initialPinchDistRef.current > 0) {
                    const scaleFactor = currentDist / initialPinchDistRef.current;
                    const nextScale = Math.min(Math.max(initialScaleRef.current * scaleFactor, 0.1), 5.0);
                    setScale(nextScale);
                }

                // 2. Two-finger Y-axis rotation calculation
                const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
                const angleDelta = currentAngle - initialAngleRef.current;
                setYRotation(initialYRotationRef.current + angleDelta);
            }
        };

        const handleTouchEnd = (e) => {
            if (e.touches.length < 2) {
                initialPinchDistRef.current = null;
                initialAngleRef.current = null;
            }
        };

        window.addEventListener("touchstart", handleTouchStart, { passive: false });
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", handleTouchEnd);
        window.addEventListener("touchcancel", handleTouchEnd);

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
            window.removeEventListener("touchcancel", handleTouchEnd);
        };
    }, [isARActive, isPlaced, setScale, setYRotation]);
}
