/**
 * ARViewerModal.jsx
 * 
 * Fullscreen AR Modal Container.
 * Renders ARManager in a full-screen overlay for immersive AR experiences.
 */

import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ARManager from "./ARManager";

export default function ARViewerModal({ isOpen, onClose, modelComponent, modelProps }) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-transparent flex flex-col pointer-events-auto">
            {/* Modal Top Bar */}
            <div className="absolute top-4 right-4 z-[100000]">
                <button
                    onClick={onClose}
                    className="p-3 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-xl text-white rounded-full transition-all shadow-xl border border-white/20"
                    title="Close AR Viewer"
                >
                    <X size={20} />
                </button>
            </div>

            {/* AR Canvas */}
            <div className="flex-1 w-full h-full bg-transparent">
                <ARManager
                    modelComponent={modelComponent}
                    modelProps={modelProps}
                    className="w-full h-full relative bg-transparent"
                />
            </div>
        </div>,
        document.body
    );
}
