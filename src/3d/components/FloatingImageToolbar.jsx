import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash, Copy, BringToFront, SendToBack, ArrowUp, ArrowDown, Lock, Droplet } from 'lucide-react';

const FloatingImageToolbar = ({
    sticker,
    onChange,
    onDuplicate,
    onDelete,
    onMoveToFront,
    onMoveForward,
    onMoveBackward,
    onMoveToBack,
    position, // { top, left }
    containerRef
}) => {
    const [showMore, setShowMore] = useState(false);
    const [showOpacity, setShowOpacity] = useState(false);
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
                setShowMore(false);
                setShowOpacity(false); // Close opacity popover too
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateSticker = (key, value) => {
        onChange({ [key]: value });
    };

    if (!sticker || !screenPos) return null;

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
            onTouchStart={(e) => {
                e.stopPropagation();
                setZIndex(1000);
            }}
        >
            {/* Toolbar Body */}
            <div className="flex items-center gap-1 p-1 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">

                {/* Opacity Selector - NEW */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showOpacity;
                            setShowOpacity(nextState);
                            if (nextState) {
                                setShowMore(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showOpacity;
                            setShowOpacity(nextState);
                            if (nextState) {
                                setShowMore(false);
                            }
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showOpacity ? 'bg-zinc-800' : 'hover:bg-zinc-800 text-zinc-300'}`}
                        title="Opacity"
                    >
                        <div className="relative">
                            <Droplet size={16} />
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-zinc-500" style={{ width: '12px', opacity: (sticker.opacity ?? 1) }} />
                        </div>
                    </button>

                    {showOpacity && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-4 z-[200] flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                <span>Opacity</span>
                                <span>{Math.round((sticker.opacity ?? 1) * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={sticker.opacity ?? 1}
                                onChange={(e) => updateSticker('opacity', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />




                {/* More Menu */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showMore;
                            setShowMore(nextState);
                            if (nextState) {
                                setShowOpacity(false); // Close other menus
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showMore;
                            setShowMore(nextState);
                            if (nextState) {
                                setShowOpacity(false);
                            }
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showMore ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {/* Expanded Menu - Matching the reference image style */}
                    {showMore && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] flex flex-col gap-0.5">

                            {/* Actions Group */}
                            <button onClick={() => { onDuplicate(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                                <Copy size={14} className="text-zinc-500" /> Duplicate
                            </button>
                            <button onClick={() => { onDelete(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg text-left transition-colors">
                                <Trash size={14} /> Delete
                            </button>

                            {/* Placeholder for Lock - Just visual for now or can implement logic later */}
                            <button className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-800 rounded-lg text-left transition-colors cursor-not-allowed opacity-50">
                                <Lock size={14} /> Lock
                            </button>

                            <div className="h-px bg-zinc-700/50 my-1" />

                            {/* Layering Group */}
                            <button onClick={() => { onMoveToFront(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                                <BringToFront size={14} className="text-zinc-500" /> Bring to front
                            </button>
                            <button onClick={() => { onMoveForward(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                                <ArrowUp size={14} className="text-zinc-500" /> Bring forward
                            </button>
                            <button onClick={() => { onMoveBackward(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                                <ArrowDown size={14} className="text-zinc-500" /> Send backward
                            </button>
                            <button onClick={() => { onMoveToBack(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                                <SendToBack size={14} className="text-zinc-500" /> Send to back
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Pointer */}
            <div className="w-3 h-3 bg-[#1e1e1e] border-b border-r border-zinc-700/50 rotate-45 -mt-1.5 z-40"></div>
        </div>,
        document.body
    );
};

export default React.memo(FloatingImageToolbar);
