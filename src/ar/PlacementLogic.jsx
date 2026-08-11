/**
 * PlacementLogic.jsx
 * 
 * Manages object placement state, physical world anchoring, and repositioning.
 * Binds WebXR select/tap events to lock 3D model positions at detected surface hit points.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

export function usePlacementLogic({ isARActive, reticleDataRef, session = null }) {
    const [isPlaced, setIsPlaced] = useState(false);
    const [scale, setScale] = useState(1.0);
    const [yRotation, setYRotation] = useState(0);
    const [isRepositioning, setIsRepositioning] = useState(false);

    // Ref-backed storage to lock position firmly & prevent tap displacement
    const isPlacedRef = useRef(false);
    const isRepositioningRef = useRef(false);
    const placedPositionRef = useRef(new THREE.Vector3(0, 0, 0));
    const placedQuaternionRef = useRef(new THREE.Quaternion());
    const anchorRef = useRef(null);

    useEffect(() => {
        isPlacedRef.current = isPlaced;
    }, [isPlaced]);

    useEffect(() => {
        isRepositioningRef.current = isRepositioning;
    }, [isRepositioning]);

    /**
     * Executes tap-to-place action based on current reticle surface position.
     * Locks the model position firmly at current hit location.
     */
    const placeObject = useCallback((cameraObj = null) => {
        // If already locked in place and not repositioning, DO NOT move!
        if (isPlacedRef.current && !isRepositioningRef.current) {
            return false;
        }

        const currentData = reticleDataRef?.current;
        if (currentData && currentData.visible && currentData.position) {
            placedPositionRef.current.copy(currentData.position);
            placedQuaternionRef.current.copy(currentData.quaternion ? currentData.quaternion : new THREE.Quaternion());

            // Create WebXR hardware-accelerated spatial anchor if available
            if (currentData.hitResult && typeof currentData.hitResult.createAnchor === "function") {
                currentData.hitResult.createAnchor().then((anchor) => {
                    anchorRef.current = anchor;
                }).catch((err) => {
                    console.warn("[PlacementLogic] WebXR createAnchor note:", err);
                });
            }
        } else if (cameraObj) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            cameraObj.getWorldPosition(worldPos);
            cameraObj.getWorldQuaternion(worldQuat);

            const offset = new THREE.Vector3(0, -0.4, -1.5).applyQuaternion(worldQuat);
            worldPos.add(offset);

            placedPositionRef.current.copy(worldPos);
            placedQuaternionRef.current.copy(worldQuat);
        } else {
            placedPositionRef.current.set(0, -0.4, -1.5);
            placedQuaternionRef.current.identity();
        }

        isPlacedRef.current = true;
        isRepositioningRef.current = false;
        setIsPlaced(true);
        setIsRepositioning(false);
        return true;
    }, [reticleDataRef]);

    const updateAnchoredPose = useCallback((pos, quat) => {
        if (pos) placedPositionRef.current.copy(pos);
        if (quat) placedQuaternionRef.current.copy(quat);
    }, []);

    /**
     * Resets placement state to allow placing the model at a new location.
     */
    const repositionObject = useCallback(() => {
        if (anchorRef.current && typeof anchorRef.current.delete === "function") {
            try { anchorRef.current.delete(); } catch (_) { }
        }
        anchorRef.current = null;
        isRepositioningRef.current = true;
        setIsRepositioning(true);
    }, []);

    /**
     * Resets scale factor back to 1.0 (original size).
     */
    const resetScale = useCallback(() => {
        setScale(1.0);
    }, []);

    /**
     * Resets placement and transformation state completely.
     */
    const resetPlacement = useCallback(() => {
        if (anchorRef.current && typeof anchorRef.current.delete === "function") {
            try { anchorRef.current.delete(); } catch (_) { }
        }
        anchorRef.current = null;
        isPlacedRef.current = false;
        isRepositioningRef.current = false;
        setIsPlaced(false);
        setIsRepositioning(false);
        placedPositionRef.current.set(0, 0, 0);
        placedQuaternionRef.current.identity();
        setScale(1.0);
        setYRotation(0);
    }, []);

    // Bind WebXR 'select' event (screen tap in AR mode)
    useEffect(() => {
        if (!isARActive || !session) return;

        const handleSelect = () => {
            // ONLY place if NOT placed yet OR currently repositioning!
            if (!isPlacedRef.current || isRepositioningRef.current) {
                placeObject();
            }
        };

        session.addEventListener("select", handleSelect);
        return () => {
            session.removeEventListener("select", handleSelect);
        };
    }, [isARActive, placeObject, session]);

    return {
        isPlaced,
        isPlacedRef,
        placedPositionRef,
        placedQuaternionRef,
        scale,
        setScale,
        yRotation,
        setYRotation,
        isRepositioning,
        isRepositioningRef,
        anchorRef,
        updateAnchoredPose,
        placeObject,
        repositionObject,
        resetScale,
        resetPlacement,
    };
}
