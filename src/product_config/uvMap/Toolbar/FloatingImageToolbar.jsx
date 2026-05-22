import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Droplet } from 'lucide-react';
import { useScreenPosition } from "./useScreenPosition";
import { FloatingImageMoreMenu } from "./FloatingImageMoreMenu";

const FloatingImageToolbar = ({
    sticker, onChange, onDuplicate, onDelete, onMoveToFront, onMoveForward, onMoveBackward, onMoveToBack, position, containerRef
}) => {
    const [showMore, setShowMore] = useState(false);
    const [showOpacity, setShowOpacity] = useState(false);
    const toolbarRef = useRef(null);
    const [zIndex, setZIndex] = useState(500);
    const screenPos = useScreenPosition(containerRef, position);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowMore(false); setShowOpacity(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    if (!sticker || !screenPos) return null;

    return createPortal(
        <div
            ref={toolbarRef}
            className="fixed flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
            style={{ left: screenPos.left, top: screenPos.top, transform: 'translate(-50%, -100%) translateY(-12px)', zIndex }}
            onMouseDown={(e) => { e.stopPropagation(); setZIndex(1000); }}
            onTouchStart={(e) => { e.stopPropagation(); setZIndex(1000); }}
        >
            <div className="flex items-center gap-1 p-1 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowOpacity(!showOpacity); setShowMore(false); }}
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
                                type="range" min="0" max="1" step="0.01" value={sticker.opacity ?? 1}
                                onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); setShowOpacity(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showMore ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {showMore && (
                        <FloatingImageMoreMenu
                            onDuplicate={onDuplicate} onDelete={onDelete} onMoveToFront={onMoveToFront}
                            onMoveForward={onMoveForward} onMoveBackward={onMoveBackward} onMoveToBack={onMoveToBack}
                            setShowMore={setShowMore}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default React.memo(FloatingImageToolbar);
