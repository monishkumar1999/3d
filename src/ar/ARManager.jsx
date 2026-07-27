/**
 * ARManager.jsx
 * 
 * Top-level Orchestrator Component for Real-World AR Experience.
 * Manages standard 3D preview with OrbitControls vs active WebXR AR mode.
 * Integrates PlaneDetection, Reticle, PlacementLogic, and GestureController.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";

import { checkARSupport, requestARSession, endARSession } from "./XRSessionManager";
import PlaneDetection from "./PlaneDetection";
import Reticle from "./Reticle";
import { usePlacementLogic } from "./PlacementLogic";
import { useGestureController } from "./GestureController";
import AROverlay from "./AROverlay";

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

    // Disable OrbitControls during WebXR AR Session
    const isOrbitEnabled = !isARActive;

    // Calculate final model rotation (Base surface quaternion combined with gesture Y-axis rotation)
    const finalQuaternion = React.useMemo(() => {
        const q = placement.placedQuaternion.clone();
        if (placement.yRotation !== 0) {
            const yRotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yRotation);
            q.multiply(yRotQuat);
        }
        return q;
    }, [placement.placedQuaternion, placement.yRotation]);

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

            {/* Model Rendering */}
            {!isARActive ? (
                // 1. Standard 3D Viewer Mode (OrbitControls centered view)
                <Center>
                    <ModelComponent {...modelProps} />
                </Center>
            ) : (
                // 2. Real-World AR Mode (Anchored at physical surface location)
                placement.isPlaced && (
                    <group
                        position={placement.placedPosition}
                        quaternion={finalQuaternion}
                        scale={[placement.scale, placement.scale, placement.scale]}
                    >
                        <ModelComponent {...modelProps} />
                        <ContactShadows
                            position={[0, -0.01, 0]}
                            opacity={0.6}
                            scale={5}
                            blur={1.5}
                            far={2}
                        />
                    </group>
                )
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
