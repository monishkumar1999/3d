/**
 * PlaneDetection.jsx
 * 
 * Per-frame WebXR Hit Testing component.
 * Uses WebXR `XRFrame.getHitTestResults` to detect horizontal physical surfaces (floors/tables)
 * in real-time and provides target matrices for surface placement indicators (Reticle).
 */

import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function PlaneDetection({ active, onHitTestResult }) {
    const { gl } = useThree();
    const hitTestSourceRef = useRef(null);
    const hitTestSourceRequestedRef = useRef(false);

    // Matrix & Vector allocations reused every frame to avoid garbage collection pressure & maintain 60 FPS
    const hitMatrix = useRef(new THREE.Matrix4());
    const tempPosition = useRef(new THREE.Vector3());
    const tempQuaternion = useRef(new THREE.Quaternion());
    const tempScale = useRef(new THREE.Vector3());

    // Request WebXR hit-test source when AR session becomes active
    useEffect(() => {
        if (!active) {
            hitTestSourceRef.current = null;
            hitTestSourceRequestedRef.current = false;
            if (onHitTestResult) {
                onHitTestResult({ visible: false });
            }
            return;
        }

        const session = gl.xr.getSession();
        if (!session) return;

        let isMounted = true;

        async function initHitTest() {
            try {
                // Request viewer reference space for raycasting along camera orientation
                const viewerSpace = await session.requestReferenceSpace("viewer");
                const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

                if (isMounted) {
                    hitTestSourceRef.current = hitTestSource;
                    hitTestSourceRequestedRef.current = true;
                }
            } catch (err) {
                console.warn("[PlaneDetection] Could not request WebXR hit-test source:", err);
            }
        }

        if (!hitTestSourceRequestedRef.current) {
            initHitTest();
        }

        // Cleanup hit test source on session end or unmount
        const handleSessionEnd = () => {
            if (hitTestSourceRef.current) {
                try {
                    hitTestSourceRef.current.cancel();
                } catch (_) { }
                hitTestSourceRef.current = null;
            }
            hitTestSourceRequestedRef.current = false;
        };

        session.addEventListener("end", handleSessionEnd);

        return () => {
            isMounted = false;
            handleSessionEnd();
            session.removeEventListener("end", handleSessionEnd);
        };
    }, [active, gl.xr]);

    // Per-frame hit test calculation loop
    useFrame((state, delta, xrFrame) => {
        if (!active || !xrFrame || !hitTestSourceRef.current) {
            return;
        }

        const referenceSpace = gl.xr.getReferenceSpace();
        if (!referenceSpace) return;

        const hitTestResults = xrFrame.getHitTestResults(hitTestSourceRef.current);

        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace);

            if (pose) {
                // Extract pose matrix transform
                hitMatrix.current.fromArray(pose.transform.matrix);
                hitMatrix.current.decompose(tempPosition.current, tempQuaternion.current, tempScale.current);

                if (onHitTestResult) {
                    onHitTestResult({
                        visible: true,
                        position: tempPosition.current,
                        quaternion: tempQuaternion.current,
                        rawMatrix: hitMatrix.current,
                        hitResult: hit,
                    });
                }
                return;
            }
        }

        // If no surface detected in this frame
        if (onHitTestResult) {
            onHitTestResult({ visible: false, position: null, quaternion: null });
        }
    });

    return null;
}
