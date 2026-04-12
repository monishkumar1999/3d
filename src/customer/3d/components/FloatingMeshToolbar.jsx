import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Droplet } from 'lucide-react';
import AttractiveColorPicker from "../../components/ui/AttractiveColorPicker";

const PRESET_COLORS = [
    "#000000", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"
];

const FloatingMeshToolbar = ({
    meshName,
    currentColor,
    onColorChange,
    position, // { top, left }
    containerRef
}) => {
    const [showColors, setShowColors] = useState(false);
    const toolbarRef = useRef(null);
    const [screenPos, setScreenPos] = useState(null);
    const [zIndex, setZIndex] = useState(500); // Must be higher than modal z-[300]

    // Calculate screen position
    useLayoutEffect(() => {
        if (!containerRef?.current) return;

        const updatePosition = () => {
            if (!containerRef?.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setScreenPos({
                left: rect.left + position.left,
                top: rect.top + position.top
            });
        };

        // Use requestAnimationFrame to ensure DOM is settled
        const rafId = requestAnimationFrame(() => {
            updatePosition();
        });

        // Continuously update for first 500ms to handle modal animations
        const intervalId = setInterval(updatePosition, 50);
        const timeoutId = setTimeout(() => clearInterval(intervalId), 500);

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            cancelAnimationFrame(rafId);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [containerRef, position.left, position.top]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
                setShowColors(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // If no position provided, don't render (or render hidden)
    if (!position || !screenPos) return null;

    return createPortal(
        <div
            ref={toolbarRef}
            className="fixed flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: screenPos.left,
                top: screenPos.top,
                transform: 'translate(-50%, -100%) translateY(-12px)',
                zIndex: zIndex
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                setZIndex(1000);
            }}
        >
            <div className="flex items-center gap-2 p-1.5 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">

                {/* Mesh Name Label */}
                <div className="px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-r border-zinc-700 pr-2">
                    {meshName || 'Mesh'}
                </div>

                {/* Color Selector */}
                <div className="relative">
                    <button
                        onClick={() => setShowColors(!showColors)}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 rounded-full transition-colors"
                        title="Change Base Color"
                    >
                        <div
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: currentColor || '#ffffff' }}
                        />
                        <Palette size={14} className="text-zinc-400" />
                    </button>

                    {showColors && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#1e1e1e] border border-zinc-700/50 rounded-2xl shadow-xl p-3 z-[200]">
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { onColorChange(c); }}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${currentColor === c ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent hover:border-zinc-500'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>

                            <div className="border-t border-zinc-800 pt-3">
                                <AttractiveColorPicker
                                    color={currentColor || '#ffffff'}
                                    onChange={onColorChange}
                                    className="border-none shadow-none p-0 bg-transparent"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2 mt-3 border-t border-zinc-700/50">
                                <span className="text-[10px] text-zinc-500 font-mono">{currentColor || '#FFFFFF'}</span>
                                <span className="text-[10px] text-zinc-400 font-medium">Base Color</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Arrow/Pointer */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1e1e1e] mt-[-1px] brightness-150" />
        </div>,
        document.body
    );
};

export default FloatingMeshToolbar;
