/**
 * ARViewerModal.jsx
 *
 * Fullscreen AR Modal Orchestrator.
 *
 * Flow:
 *   1. User clicks "View in AR" in ThreeDCanvas
 *   2. ARViewerModal opens
 *   3. useCustomizedGlb hook exports customized scene -> binary GLB -> Blob URL
 *   4. Loading spinner shown while export runs
 *   5. ModelViewerAR receives Blob URL and launches Google <model-viewer>
 *   6. User taps "View in your space (AR)" to launch native AR
 *
 * AR Mode Priority (handled entirely by <model-viewer>):
 *   WebXR -> Android Scene Viewer -> iOS Quick Look
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, AlertTriangle, X } from "lucide-react";
import { useCustomizedGlb } from "./useCustomizedGlb";
import ModelViewerAR from "./ModelViewerAR";

export default function ARViewerModal({ isOpen, onClose, modelComponent, modelProps, glbUrl }) {
    const { customGlbUrl, isExporting, exportError, triggerExport } = useCustomizedGlb({
        modelComponent,
        modelProps,
        fallbackGlbUrl: glbUrl,
    });

    // Trigger GLB export every time the modal is opened
    useEffect(() => {
        if (isOpen) {
            triggerExport();
        }
    }, [isOpen, triggerExport]);

    if (!isOpen) return null;

    // Use the freshly-exported Blob URL, falling back to base GLB only if export fails
    const finalSrc = customGlbUrl || (exportError ? glbUrl || modelProps?.url : null);

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col pointer-events-auto">

            {/* Loading State (exporting GLB) */}
            {(isExporting || (!customGlbUrl && !exportError)) && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-white p-8">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/10 transition-all active:scale-95"
                    >
                        <X size={18} />
                    </button>
                    <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <RefreshCw size={32} className="animate-spin" />
                    </div>
                    <div className="text-center max-w-xs space-y-2">
                        <h3 className="text-base font-bold text-white">Preparing Customized AR Model</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Baking your design — colors, materials, stickers, and textures — into a self-contained 3D file for AR.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>This only takes a moment</span>
                    </div>
                </div>
            )}

            {/* Export Error State */}
            {exportError && !isExporting && !finalSrc && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-white p-8">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-white/10 transition-all"
                    >
                        <X size={18} />
                    </button>
                    <div className="w-20 h-20 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="text-center max-w-xs space-y-2">
                        <h3 className="text-base font-bold text-white">AR Export Failed</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">{exportError}</p>
                    </div>
                    <button
                        onClick={triggerExport}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
                    >
                        Retry Export
                    </button>
                </div>
            )}

            {/* Google model-viewer AR */}
            {finalSrc && !isExporting && (
                <ModelViewerAR
                    src={finalSrc}
                    productName={modelProps?.productName || "Product"}
                    onClose={onClose}
                />
            )}
        </div>,
        document.body
    );
}
