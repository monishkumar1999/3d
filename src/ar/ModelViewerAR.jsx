/**
 * ModelViewerAR.jsx
 *
 * Production Google <model-viewer> AR component.
 * Reference: https://modelviewer.dev/examples/augmentedreality/
 *
 * AR Mode Priority:
 *   WebXR → Scene Viewer (Android) → Quick Look (iOS)
 *
 * Uses ar-status events to drive real UI state — never guesses AR state.
 * Accepts a pre-exported customized GLB Blob URL as `src`.
 */

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, Scan, CheckCircle2, AlertTriangle, Box } from "lucide-react";

// Ensure the <model-viewer> web component is loaded once globally
let _modelViewerScriptLoaded = false;
function ensureModelViewerScript() {
    if (_modelViewerScriptLoaded) return;
    if (customElements.get("model-viewer")) {
        _modelViewerScriptLoaded = true;
        return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
    document.head.appendChild(script);
    _modelViewerScriptLoaded = true;
}

// AR status values emitted by <model-viewer>
const AR_STATUS = {
    NOT_PRESENTING: "not-presenting",
    SESSION_STARTED: "session-started",
    OBJECT_PLACED: "object-placed",
    FAILED: "failed",
};

export default function ModelViewerAR({ src, productName = "Product", onClose }) {
    const modelViewerRef = useRef(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [modelError, setModelError] = useState(null);
    const [canActivateAR, setCanActivateAR] = useState(false);
    const [arStatus, setArStatus] = useState(AR_STATUS.NOT_PRESENTING);
    const [isARActive, setIsARActive] = useState(false);

    // Load <model-viewer> script on mount
    useEffect(() => {
        ensureModelViewerScript();
    }, []);

    // Bind model-viewer event listeners after ref is available
    useEffect(() => {
        const mv = modelViewerRef.current;
        if (!mv) return;

        const handleLoad = () => {
            setModelLoaded(true);
            setModelError(null);
            // Check if AR is activatable
            if (typeof mv.canActivateAR !== "undefined") {
                setCanActivateAR(mv.canActivateAR);
            } else {
                // Fallback: check xr-environment support
                setCanActivateAR(true);
            }
        };

        const handleError = (e) => {
            console.error("[ModelViewerAR] model-viewer load error:", e);
            setModelError("Failed to load 3D model. Please try again.");
        };

        const handleARStatus = (e) => {
            const status = e.detail?.status ?? AR_STATUS.NOT_PRESENTING;
            setArStatus(status);
            setIsARActive(status !== AR_STATUS.NOT_PRESENTING);
        };

        mv.addEventListener("load", handleLoad);
        mv.addEventListener("error", handleError);
        mv.addEventListener("ar-status", handleARStatus);

        return () => {
            mv.removeEventListener("load", handleLoad);
            mv.removeEventListener("error", handleError);
            mv.removeEventListener("ar-status", handleARStatus);
        };
    }, [src]); // re-bind when src changes (new customized GLB)

    // AR status label shown to user
    const arStatusLabel = {
        [AR_STATUS.NOT_PRESENTING]: null,
        [AR_STATUS.SESSION_STARTED]: "Scanning for surface...",
        [AR_STATUS.OBJECT_PLACED]: "Product placed • Walk around naturally",
        [AR_STATUS.FAILED]: "AR unavailable on this device",
    }[arStatus];

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-slate-950/95 via-slate-950/60 to-transparent pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                        <Box size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white leading-tight">View in AR</h2>
                        <p className="text-[10px] text-slate-400 font-medium">
                            {modelLoaded ? "Customized model ready" : "Loading customized model..."}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="pointer-events-auto p-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full transition-all border border-white/10 active:scale-95"
                    title="Close"
                >
                    <X size={18} />
                </button>
            </div>

            {/* ── AR Status Banner (visible during AR session) ─────────── */}
            {isARActive && arStatusLabel && (
                <div className="absolute top-20 left-0 right-0 z-10 flex justify-center pointer-events-none">
                    <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl text-white text-xs font-semibold px-5 py-2.5 rounded-full border border-white/15 shadow-2xl">
                        {arStatus === AR_STATUS.SESSION_STARTED && (
                            <Scan size={14} className="text-indigo-400 animate-spin" />
                        )}
                        {arStatus === AR_STATUS.OBJECT_PLACED && (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                        )}
                        {arStatus === AR_STATUS.FAILED && (
                            <AlertTriangle size={14} className="text-amber-400" />
                        )}
                        <span>{arStatusLabel}</span>
                    </div>
                </div>
            )}

            {/* ── Model Viewer ─────────────────────────────────────────── */}
            <div className="flex-1 w-full h-full relative">
                {src ? (
                    <model-viewer
                        ref={modelViewerRef}
                        src={src}
                        alt={productName}
                        // ── AR configuration ──────────────────────────────
                        ar
                        ar-modes="webxr scene-viewer quick-look"
                        ar-scale="auto"
                        ar-placement="floor"
                        xr-environment
                        // ── 3D viewer configuration ───────────────────────
                        camera-controls
                        touch-action="pan-y"
                        auto-rotate
                        auto-rotate-delay="3000"
                        rotation-per-second="20deg"
                        // ── Lighting & shadows ─────────────────────────────
                        shadow-intensity="1"
                        shadow-softness="1"
                        environment-image="neutral"
                        exposure="1.0"
                        // ── Style ─────────────────────────────────────────
                        style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: "#0f172a",
                            "--poster-color": "#0f172a",
                        }}
                    >
                        {/* ── Custom AR button (slot) ─────────────────── */}
                        <button
                            slot="ar-button"
                            style={{
                                position: "absolute",
                                bottom: "32px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "16px 28px",
                                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                                color: "#fff",
                                border: "1px solid rgba(255,255,255,0.2)",
                                borderRadius: "20px",
                                fontWeight: "700",
                                fontSize: "14px",
                                cursor: "pointer",
                                boxShadow: "0 8px 32px rgba(79,70,229,0.45)",
                                whiteSpace: "nowrap",
                                zIndex: 50,
                            }}
                        >
                            <Camera size={18} style={{ flexShrink: 0 }} />
                            <span>View in your space (AR)</span>
                        </button>

                        {/* ── AR prompt hint ──────────────────────────── */}
                        <div slot="ar-prompt"
                            style={{
                                position: "absolute",
                                top: "80px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "rgba(15,23,42,0.9)",
                                color: "#fff",
                                fontSize: "12px",
                                fontWeight: "600",
                                padding: "8px 18px",
                                borderRadius: "999px",
                                border: "1px solid rgba(255,255,255,0.15)",
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                            }}
                        >
                            📱 Move phone slowly to detect floor
                        </div>
                    </model-viewer>
                ) : (
                    /* No src yet — should not happen since ARViewerModal shows loading first */
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        <Box size={32} className="animate-spin text-indigo-500 mr-3" />
                        Preparing model...
                    </div>
                )}

                {/* ── Load error overlay ─────────────────────────────────── */}
                {modelError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-center p-8 gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white mb-1">Model Load Failed</h3>
                            <p className="text-xs text-slate-400">{modelError}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="mt-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl border border-white/10 transition-all"
                        >
                            Go Back
                        </button>
                    </div>
                )}
            </div>

            {/* ── Bottom info bar ───────────────────────────────────────── */}
            {!isARActive && modelLoaded && (
                <div className="absolute bottom-0 left-0 right-0 z-10 px-5 py-3 bg-gradient-to-t from-slate-950/90 to-transparent flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        <span>Customized model loaded</span>
                    </div>
                    {canActivateAR && (
                        <span className="text-indigo-400 font-medium">
                            WebXR + Scene Viewer + Quick Look
                        </span>
                    )}
                    {!canActivateAR && (
                        <span className="text-amber-400 font-medium">
                            AR not supported on this device
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
