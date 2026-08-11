/**
 * ARViewerModal.jsx
 * 
 * Fullscreen AR Modal Container.
 * Renders ARManager in a full-screen overlay for immersive AR experiences.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Box } from "lucide-react";
import ARManager from "./ARManager";
import ModelViewerAR from "./ModelViewerAR";

export default function ARViewerModal({ isOpen, onClose, modelComponent, modelProps, glbUrl }) {
    const [viewerMode, setViewerMode] = useState("modelviewer"); // 'modelviewer' | 'webxr'

    if (!isOpen) return null;

    const urlToUse = glbUrl || modelProps?.url;

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col pointer-events-auto">
            {/* Top Switcher Bar */}
            <div className="absolute top-4 left-4 z-[100000] flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/20 shadow-2xl">
                <button
                    onClick={() => setViewerMode("modelviewer")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewerMode === "modelviewer"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                            : "text-slate-300 hover:text-white"
                        }`}
                >
                    <Sparkles size={14} />
                    <span>Google ModelViewer</span>
                </button>
                <button
                    onClick={() => setViewerMode("webxr")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewerMode === "webxr"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                            : "text-slate-300 hover:text-white"
                        }`}
                >
                    <Box size={14} />
                    <span>R3F WebXR</span>
                </button>
            </div>

            {/* Viewer Content */}
            {viewerMode === "modelviewer" && urlToUse ? (
                <ModelViewerAR glbUrl={urlToUse} onClose={onClose} />
            ) : (
                <>
                    {/* Modal Top Close Button for WebXR mode */}
                    <div className="absolute top-4 right-4 z-[100000]">
                        <button
                            onClick={onClose}
                            className="p-3 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-xl text-white rounded-full transition-all shadow-xl border border-white/20"
                            title="Close AR Viewer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 w-full h-full bg-transparent">
                        <ARManager
                            modelComponent={modelComponent}
                            modelProps={modelProps}
                            className="w-full h-full relative bg-transparent"
                        />
                    </div>
                </>
            )}
        </div>,
        document.body
    );
}
