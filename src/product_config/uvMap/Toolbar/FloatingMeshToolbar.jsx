import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from 'lucide-react';
import AttractiveColorPicker from "../../../components/ui/AttractiveColorPicker";
import { useScreenPosition } from "./useScreenPosition";

const PRESET_COLORS = [
    "#000000", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"
];

const FloatingMeshToolbar = ({
    meshName, currentColor, onColorChange, position, containerRef
}) => {
    const [showColors, setShowColors] = useState(false);
    const toolbarRef = useRef(null);
    const [zIndex, setZIndex] = useState(500);
    const screenPos = useScreenPosition(containerRef, position);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowColors(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    if (!position || !screenPos) return null;

    return createPortal(
        <div
            ref={toolbarRef} className="fixed flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
            style={{ left: screenPos.left, top: screenPos.top, transform: 'translate(-50%, -100%) translateY(-12px)', zIndex }}
            onMouseDown={(e) => { e.stopPropagation(); setZIndex(1000); }}
        >
            <div className="flex items-center gap-2 p-1.5 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">
                <div className="px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-r border-zinc-700 pr-2">
                    {meshName || 'Mesh'}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowColors(!showColors)}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 rounded-full transition-colors"
                        title="Change Base Color"
                    >
                        <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: currentColor || '#ffffff' }} />
                        <Palette size={14} className="text-zinc-400" />
                    </button>

                    {showColors && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#1e1e1e] border border-zinc-700/50 rounded-2xl shadow-xl p-3 z-[200]">
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c} onClick={() => onColorChange(c)}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${currentColor === c ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent hover:border-zinc-500'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="border-t border-zinc-800 pt-3">
                                <AttractiveColorPicker color={currentColor || '#ffffff'} onChange={onColorChange} className="border-none shadow-none p-0 bg-transparent" />
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-3 border-t border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 font-mono">{currentColor || '#FFFFFF'}</span>
                                <span className="text-[10px] text-zinc-400 font-medium">Base Color</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FloatingMeshToolbar;
