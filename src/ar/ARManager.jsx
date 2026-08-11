/**
 * ARManager.jsx
 * 
 * Top-level Orchestrator Component for Real-World AR Experience.
 * Manages standard 3D preview with OrbitControls vs active WebXR AR mode.
 * Integrates PlaneDetection, Reticle, PlacementLogic, and GestureController.
 */

import React, { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";

import { checkARSupport, requestARSession, endARSession } from "./XRSessionManager";
import PlaneDetection from "./PlaneDetection";
import Reticle from "./Reticle";
import { usePlacementLogic } from "./PlacementLogic";
import { useGestureController } from "./GestureController";
import AROverlay from "./AROverlay";

/**
 * Unified Model Container for AR & 3D modes.
 * Keeps ModelComponent continuously mounted so textures/GLTF are never reloaded when placed.
 */
function ARModelGroup({
    isARActive,
    modelComponent: ModelComponent,
    modelProps,
    reticleDataRef,
    placement,
    finalQuaternion
}) {
    const groupRef = useRef(null);
    const { camera } = useThree();

    useFrame(() => {
        if (!groupRef.current) return;

        if (!isARActive) {
            // Standard 3D OrbitControls viewer mode: centered at origin
            groupRef.current.position.set(0, 0, 0);
            groupRef.current.quaternion.set(0, 0, 0, 1);
            groupRef.current.scale.set(1, 1, 1);
            return;
        }

        if (placement.isPlaced && !placement.isRepositioning) {
            // Anchored state: lock strictly at physical world position and rotation
            groupRef.current.position.copy(placement.placedPositionRef.current);
            groupRef.current.quaternion.copy(finalQuaternion);
            groupRef.current.scale.set(placement.scale, placement.scale, placement.scale);
        } else {
            // Placement / Scanning preview state: follow hit-test reticle or camera world position
            const currentData = reticleDataRef?.current;
            if (currentData && currentData.visible && currentData.position) {
                groupRef.current.position.copy(currentData.position);
                if (currentData.quaternion) {
                    groupRef.current.quaternion.copy(currentData.quaternion);
                }
            } else if (camera) {
                // World position 1.5m in front of camera
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                camera.getWorldPosition(worldPos);
                camera.getWorldQuaternion(worldQuat);

                const offset = new THREE.Vector3(0, -0.4, -1.5).applyQuaternion(worldQuat);
                worldPos.add(offset);

                groupRef.current.position.copy(worldPos);
                groupRef.current.quaternion.copy(worldQuat);
            }
            groupRef.current.scale.set(placement.scale, placement.scale, placement.scale);
        }
    });

    return (
        <group ref={groupRef}>
            <Suspense fallback={null}>
                <ModelComponent {...modelProps} />
            </Suspense>
        </group>
    );
}

/**
 * Internal WebXR Scene Content component rendered inside R3F <Canvas>
 */
function ARSceneContent({
    isARActive,
    activeSession,
    modelComponent: ModelComponent,
    modelProps,
    onReticleUpdate,
    reticleDataRef,
    placement,
}) {
    const { gl, scene } = useThree();

    // Bind WebXR session and ensure transparent clear color & background during AR mode
    React.useEffect(() => {
        if (!gl || !gl.xr || typeof gl.xr !== "object") return;

        if (isARActive && activeSession) {
            gl.xr.enabled = true;
            try {
                gl.xr.setReferenceSpaceType("local-floor");
            } catch (err) {
                try {
                    gl.xr.setReferenceSpaceType("local");
                } catch (_) { }
            }
            scene.background = null;
            gl.setClearColor(0x000000, 0);

            gl.xr.setSession(activeSession).catch((err) => {
                console.warn("[ARManager] WebXR session binding note:", err);
            });
        } else if (!isARActive) {
            gl.xr.enabled = false;
        }
    }, [isARActive, activeSession, gl, scene]);

    // Bind Gesture Controller for multi-touch scale and Y-axis rotation
    useGestureController({
        isARActive,
        isPlaced: placement.isPlaced,
        setScale: placement.setScale,
        setYRotation: placement.setYRotation,
    });

    // Per-frame hardware spatial anchor pose update from ARCore / ARKit
    useFrame((state, delta, xrFrame) => {
        if (!isARActive || !placement.isPlaced || placement.isRepositioning) return;
        const anchor = placement.anchorRef?.current;
        if (!anchor || !xrFrame) return;

        const referenceSpace = gl.xr.getReferenceSpace();
        if (!referenceSpace) return;

        try {
            const pose = xrFrame.getPose(anchor.anchorSpace, referenceSpace);
            if (pose) {
                const mat = new THREE.Matrix4().fromArray(pose.transform.matrix);
                const pos = new THREE.Vector3();
                const quat = new THREE.Quaternion();
                const s = new THREE.Vector3();
                mat.decompose(pos, quat, s);

                placement.updateAnchoredPose(pos, quat);
            }
        } catch (_) { }
    });

    // Disable OrbitControls during WebXR AR Session
    const isOrbitEnabled = !isARActive;

    // Calculate final model rotation (Base surface quaternion combined with gesture Y-axis rotation)
    const finalQuaternion = React.useMemo(() => {
        const q = placement.placedQuaternionRef.current.clone();
        if (placement.yRotation !== 0) {
            const yRotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yRotation);
            q.multiply(yRotQuat);
        }
        return q;
    }, [placement.placedQuaternionRef, placement.yRotation]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight
                position={[5, 10, 5]}
                intensity={1.0}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />
            <Environment preset="studio" background={false} />

            {/* OrbitControls disabled entirely during active WebXR session */}
            <OrbitControls enabled={isOrbitEnabled} minDistance={1.5} maxDistance={10} enablePan={true} />

            {/* WebXR Surface Detection Loop */}
            <PlaneDetection active={isARActive && (!placement.isPlaced || placement.isRepositioning)} onHitTestResult={onReticleUpdate} />

            {/* Surface Reticle Indicator */}
            {isARActive && (!placement.isPlaced || placement.isRepositioning) && (
                <Reticle reticleDataRef={reticleDataRef} />
            )}

            {/* Model Rendering: Single continuous group prevents unmounting on anchor */}
            {!isARActive ? (
                <Center>
                    <ARModelGroup
                        isARActive={false}
                        modelComponent={ModelComponent}
                        modelProps={modelProps}
                        reticleDataRef={reticleDataRef}
                        placement={placement}
                        finalQuaternion={finalQuaternion}
                    />
                </Center>
            ) : (
                <ARModelGroup
                    isARActive={true}
                    modelComponent={ModelComponent}
                    modelProps={modelProps}
                    reticleDataRef={reticleDataRef}
                    placement={placement}
                    finalQuaternion={finalQuaternion}
                />
            )}
        </>
    );
}

/**
 * Main ARManager Wrapper
 */
export default function ARManager({ modelComponent, modelProps, className = "w-full h-full relative" }) {
    const [isARActive, setIsARActive] = useState(false);
    const [isARSupported, setIsARSupported] = useState(false);
    const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);
    const [activeSession, setActiveSession] = useState(null);

    const reticleDataRef = useRef({ visible: false, position: null, quaternion: null });
    const [reticleVisible, setReticleVisible] = useState(false);

    const handleHitTestResult = useCallback((data) => {
        reticleDataRef.current = data;
        if (data.visible !== reticleVisible) {
            setReticleVisible(data.visible);
        }
    }, [reticleVisible]);

    // Placement logic hook
    const placement = usePlacementLogic({
        isARActive,
        reticleDataRef,
        session: activeSession,
    });

    const canvasRef = useRef(null);

    // Initial capability check for WebXR AR support
    useEffect(() => {
        async function checkSupport() {
            const supported = await checkARSupport();
            setIsARSupported(supported);
        }
        checkSupport();
    }, []);

    // Handle Launching WebXR AR Session
    const handleEnterAR = useCallback(async () => {
        if (typeof window === "undefined" || !navigator || !navigator.xr) {
            setShowUnsupportedModal(true);
            return;
        }

        try {
            const domOverlayRoot = document.getElementById("ar-overlay-root") || document.body;
            const session = await requestARSession({ domOverlayElement: domOverlayRoot });

            session.addEventListener("end", () => {
                setIsARActive(false);
                setActiveSession(null);
                placement.resetPlacement();
            });

            setActiveSession(session);
            setIsARActive(true);
        } catch (err) {
            console.error("[ARManager] Enter AR error:", err);
            setShowUnsupportedModal(true);
        }
    }, [placement]);

    // Handle Exiting WebXR AR Session
    const handleExitAR = useCallback(() => {
        if (activeSession) {
            endARSession(activeSession);
        }
        setIsARActive(false);
        setActiveSession(null);
        placement.resetPlacement();
    }, [activeSession, placement]);

    return (
        <div className={className}>
            {/* DOM Overlay UI Controls */}
            <AROverlay
                isARActive={isARActive}
                isARSupported={isARSupported}
                isPlaced={placement.isPlaced}
                isRepositioning={placement.isRepositioning}
                reticleVisible={reticleVisible}
                scale={placement.scale}
                onEnterAR={handleEnterAR}
                onExitAR={handleExitAR}
                onPlace={placement.placeObject}
                onReposition={placement.repositionObject}
                onResetScale={placement.resetScale}
                showUnsupportedModal={showUnsupportedModal}
                onCloseUnsupportedModal={() => setShowUnsupportedModal(false)}
            />

            {/* R3F Canvas Container */}
            <Canvas
                ref={canvasRef}
                shadows
                camera={{ position: [0, 0, 4.5], fov: 45, near: 0.1, far: 50 }}
                gl={{
                    alpha: true,
                    preserveDrawingBuffer: true,
                    antialias: true,
                }}
                onCreated={({ gl }) => {
                    // Safely enable WebXR rendering pipeline on Three.js WebXRManager
                    if (gl && gl.xr && typeof gl.xr === "object") {
                        gl.xr.enabled = true;
                        if (activeSession) {
                            gl.xr.setSession(activeSession);
                        }
                    }
                }}
                dpr={[1, 2]}
                className="w-full h-full"
            >
                <ARSceneContent
                    isARActive={isARActive}
                    activeSession={activeSession}
                    modelComponent={modelComponent}
                    modelProps={modelProps}
                    onReticleUpdate={handleHitTestResult}
                    reticleDataRef={reticleDataRef}
                    placement={placement}
                />
            </Canvas>
        </div>
    );
}
