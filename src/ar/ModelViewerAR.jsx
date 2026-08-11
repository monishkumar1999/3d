/**
 * ModelViewerAR.jsx
 * 
 * Official Google <model-viewer> AR integration matching https://modelviewer.dev/examples/augmentedreality/
 * Provides native WebXR, Google Scene Viewer (Android), and Apple Quick Look (iOS)
 * with real-world floor locking, physics-based ground shadows, interactive gesture controls, and AR prompts.
 */

import React, { useEffect, useState } from "react";
import { Camera, X, Box, Smartphone, CheckCircle, ExternalLink } from "lucide-react";

export default function ModelViewerAR({ glbUrl, onClose }) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Ensure Google model-viewer web component script is loaded dynamically if needed
        if (!customElements.get("model-viewer")) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
            document.head.appendChild(script);
        }
    }, []);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-between font-sans">
            {/* Top Navigation Bar */}
            <div className="w-full p-4 flex items-center justify-between z-50 bg-gradient-to-b from-slate-900/90 to-transparent backdrop-blur-md border-b border-white/10">
                <div className="flex items-center gap-2 text-white">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                        <Box size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-wide">Google WebXR & AR Viewer</h2>
                        <p className="text-[11px] text-slate-400 font-medium">Real-World Surface Anchored</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2.5 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-xl text-white rounded-full transition-all shadow-lg border border-white/20 active:scale-95"
                    title="Close AR Viewer"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Main Interactive <model-viewer> Area */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-slate-900">
                {glbUrl ? (
                    <model-viewer
                        src={glbUrl}
                        alt="3D AR Model"
                        ar
                        ar-modes="webxr scene-viewer quick-look"
                        ar-scale="auto"
                        ar-placement="floor"
                        camera-controls
                        touch-action="pan-y"
                        shadow-intensity="1.2"
                        shadow-softness="0.4"
                        exposure="1.0"
                        environment-image="neutral"
                        auto-rotate
                        onLoad={() => setIsLoaded(true)}
                        style={{ width: "100%", height: "100%", backgroundColor: "#0f172a" }}
                    >
                        {/* Custom Animated AR Launch Button */}
                        <button
                            slot="ar-button"
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-sm shadow-2xl shadow-indigo-500/50 transition-all hover:scale-105 active:scale-95 border border-white/20 z-50 cursor-pointer text-nowrap"
                        >
                            <Camera size={20} className="animate-pulse text-indigo-200" />
                            <span>View in your space (AR)</span>
                        </button>

                        {/* AR Prompt Guidance */}
                        <div slot="ar-prompt" className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-40">
                            <div className="bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-2 animate-bounce">
                                <Smartphone size={16} className="text-indigo-400" />
                                <span>Move phone slowly around floor to track surface</span>
                            </div>
                        </div>
                    </model-viewer>
                ) : (
                    <div className="text-slate-400 text-sm flex flex-col items-center gap-2">
                        <Box size={32} className="animate-spin text-indigo-500" />
                        <span>Loading 3D Model...</span>
                    </div>
                )}
            </div>

            {/* Bottom Info Banner */}
            <div className="w-full p-4 bg-slate-900/90 border-t border-white/10 backdrop-blur-md flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-400" />
                    <span>Floor lock enabled • WebXR & SceneViewer active</span>
                </div>
                <a
                    href="https://modelviewer.dev/examples/augmentedreality/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 underline"
                >
                    <span>Google ModelViewer Docs</span>
                    <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );
}
