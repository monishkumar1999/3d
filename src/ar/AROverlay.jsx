/**
 * AROverlay.jsx
 * 
 * User Interface Overlay for WebXR AR Sessions.
 * Displays step-by-step instructions, surface tracking status, repositioning controls,
 * and elegant fallback popups for non-WebXR mobile/desktop browsers.
 */

import React from "react";
import { Camera, RefreshCw, Maximize2, LogOut, AlertTriangle, Scan, CheckCircle2, Touchpad } from "lucide-react";

export default function AROverlay({
    isARActive,
    isARSupported,
    isPlaced,
    isRepositioning,
    reticleVisible,
    scale,
    onEnterAR,
    onExitAR,
    onPlace,
    onReposition,
    onResetScale,
    showUnsupportedModal,
    onCloseUnsupportedModal,
}) {
    return (
        <div id="ar-overlay-root" className="fixed inset-0 pointer-events-none z-[100001] flex flex-col justify-between p-6">
            {!isARActive ? (
                // 1. Outside AR Session Overlay (Trigger view)
                <div className="w-full h-full flex flex-col items-center justify-end pointer-events-auto">
                    <button
                        onClick={onEnterAR}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-sm shadow-2xl shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 border border-white/20 mb-8"
                    >
                        <Camera size={20} className="animate-pulse" />
                        <span>Start Camera & View in AR</span>
                    </button>

                    {/* Unsupported WebXR Device Modal */}
                    {showUnsupportedModal && (
                        <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn pointer-events-auto">
                            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-inner">
                                    <AlertTriangle size={28} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-xl font-bold text-slate-900">WebXR AR Not Supported</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                        Real-world surface tracking requires a WebXR-compatible mobile browser (e.g. Chrome on Android or WebXR iOS Viewer) with camera permissions enabled.
                                    </p>
                                </div>
                                <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 font-medium text-left flex flex-col gap-1.5">
                                    <div>• <strong>Android:</strong> Open in Google Chrome with <a href="https://play.google.com/store/apps/details?id=com.google.ar.core" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Google Play Services for AR (ARCore)</a> installed.</div>
                                    <div>• <strong>iOS (iPhone):</strong> Apple Safari requires USDZ QuickLook or WebXR Viewer.</div>
                                    <div>• <strong>Desktop:</strong> Standard 3D OrbitControls viewer is active below.</div>
                                </div>
                                <div className="flex w-full gap-2 mt-1">
                                    <a
                                        href="https://play.google.com/store/apps/details?id=com.google.ar.core"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all text-center border border-indigo-200"
                                    >
                                        Get ARCore
                                    </a>
                                    <button
                                        onClick={onCloseUnsupportedModal}
                                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all text-center shadow-md active:scale-95"
                                    >
                                        3D Preview
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // 2. Active WebXR AR Session Overlay Controls
                <>
                    {/* Top Status & Guidance Bar */}
                    <div className="w-full flex flex-col items-center gap-2 pointer-events-auto">
                        <div className="bg-slate-900/85 backdrop-blur-xl border border-white/20 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 text-white text-xs font-semibold tracking-wide">
                            {!isPlaced || isRepositioning ? (
                                reticleVisible ? (
                                    <>
                                        <Touchpad size={16} className="text-emerald-400 animate-bounce" />
                                        <span>Surface Detected! Tap screen to place model</span>
                                    </>
                                ) : (
                                    <>
                                        <Scan size={16} className="text-indigo-400 animate-spin" />
                                        <span>Scanning room floor/table... Point phone down</span>
                                    </>
                                )
                            ) : (
                                <>
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span>Object Anchored • Walk around naturally</span>
                                </>
                            )}
                        </div>

                        {isPlaced && !isRepositioning && (
                            <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-[11px] text-white/90 border border-white/10 font-medium">
                                Pinch with 2 fingers to scale ({Math.round(scale * 100)}%) • Rotate with 2 fingers
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Toolbar */}
                    <div className="w-full flex items-center justify-between pointer-events-auto gap-3">
                        {/* Exit AR */}
                        <button
                            onClick={onExitAR}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900/85 hover:bg-slate-900 backdrop-blur-xl text-white border border-white/20 rounded-2xl text-xs font-bold shadow-xl transition-all active:scale-95"
                        >
                            <LogOut size={16} />
                            <span>Exit AR</span>
                        </button>

                        <div className="flex items-center gap-2">
                            {/* Reposition Toggle */}
                            {isPlaced && !isRepositioning && (
                                <button
                                    onClick={onReposition}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600/90 hover:bg-indigo-600 backdrop-blur-xl text-white border border-white/20 rounded-2xl text-xs font-bold shadow-xl transition-all active:scale-95"
                                >
                                    <RefreshCw size={16} />
                                    <span>Reposition</span>
                                </button>
                            )}

                            {/* Reset Scale */}
                            {isPlaced && scale !== 1.0 && (
                                <button
                                    onClick={onResetScale}
                                    className="flex items-center justify-center gap-2 px-3.5 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white border border-white/20 rounded-2xl text-xs font-bold shadow-xl transition-all active:scale-95"
                                    title="Reset to 100% scale"
                                >
                                    <Maximize2 size={16} />
                                    <span>Reset Scale</span>
                                </button>
                            )}

                            {/* Manual Place Button if reticle is active */}
                            {(!isPlaced || isRepositioning) && reticleVisible && (
                                <button
                                    onClick={onPlace}
                                    className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-extrabold shadow-xl shadow-emerald-500/30 transition-all active:scale-95"
                                >
                                    <span>Place Model Here</span>
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
