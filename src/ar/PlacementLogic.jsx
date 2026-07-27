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
    const [placedPosition, setPlacedPosition] = useState(new THREE.Vector3(0, 0, 0));
    const [placedQuaternion, setPlacedQuaternion] = useState(new THREE.Quaternion());
    const [scale, setScale] = useState(1.0);
    const [yRotation, setYRotation] = useState(0);
    const [isRepositioning, setIsRepositioning] = useState(false);

    /**
     * Executes tap-to-place action based on current reticle surface position.
     */
    const placeObject = useCallback(() => {
        const currentData = reticleDataRef?.current;
        if (!currentData || !currentData.visible || !currentData.position) {
            return false;
        }

        setPlacedPosition(currentData.position.clone());
        setPlacedQuaternion(currentData.quaternion ? currentData.quaternion.clone() : new THREE.Quaternion());
        setIsPlaced(true);
        setIsRepositioning(false);
        return true;
    }, [reticleDataRef]);

    /**
     * Resets placement state to allow placing the model at a new location.
     */
    const repositionObject = useCallback(() => {
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
        setIsPlaced(false);
        setIsRepositioning(false);
        setPlacedPosition(new THREE.Vector3(0, 0, 0));
        setPlacedQuaternion(new THREE.Quaternion());
        setScale(1.0);
        setYRotation(0);
    }, []);

    // Bind WebXR 'select' event (screen tap in AR mode)
    useEffect(() => {
        if (!isARActive || !session) return;

        const handleSelect = () => {
            // Only place if not placed yet or currently repositioning
            if (!isPlaced || isRepositioning) {
                placeObject();
            }
        };

        session.addEventListener("select", handleSelect);
        return () => {
            session.removeEventListener("select", handleSelect);
        };
    }, [isARActive, isPlaced, isRepositioning, placeObject, session]);

    return {
        isPlaced,
        placedPosition,
        placedQuaternion,
        scale,
        setScale,
        yRotation,
        setYRotation,
        isRepositioning,
        placeObject,
        repositionObject,
        resetScale,
        resetPlacement,
    };
}
