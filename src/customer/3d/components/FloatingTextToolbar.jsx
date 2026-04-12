import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Type, Palette, AlignLeft, AlignCenter, AlignRight, MoreHorizontal, Trash, Copy, Check, ChevronDown, MoveHorizontal, Scaling, BringToFront, SendToBack, Droplet, Pencil } from 'lucide-react';
import AttractiveColorPicker from "../../components/ui/AttractiveColorPicker";

const FONTS = [
    { name: "Inter", family: "Inter" },
    { name: "Roboto", family: "Roboto" },
    { name: "Lato", family: "Lato" },
    { name: "Montserrat", family: "Montserrat" },
    { name: "Poppins", family: "Poppins" },
    { name: "Open Sans", family: "Open Sans" },
    { name: "Oswald", family: "Oswald" },
    { name: "Playfair", family: "Playfair Display" },
    { name: "Merriweather", family: "Merriweather" },
    { name: "Lora", family: "Lora" },
    { name: "Cinzel", family: "Cinzel" },
    { name: "Bebas Neue", family: "Bebas Neue" },
    { name: "Anton", family: "Anton" },
    { name: "Righteous", family: "Righteous" },
    { name: "Lobster", family: "Lobster" },
    { name: "Pacifico", family: "Pacifico" },
    { name: "Dancing Script", family: "Dancing Script" },
    { name: "Satisfaction", family: "Satisfy" },
    { name: "Caveat", family: "Caveat" },
    { name: "Indie Flower", family: "Indie Flower" },
    { name: "Sacramento", family: "Sacramento" },
    { name: "Permanent Marker", family: "Permanent Marker" },
    { name: "Inconsolata", family: "Inconsolata" },
];

const PRESET_COLORS = [
    "#000000", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"
];

const FloatingTextToolbar = ({
    sticker,
    onChange,
    onDuplicate,
    onDelete,
    onMoveForward,
    onMoveBackward,
    position, // { top, left } relative to container
    containerRef // Ref to the container element
}) => {
    const [showFonts, setShowFonts] = useState(false);
    const [showColors, setShowColors] = useState(false);
    const [showOpacity, setShowOpacity] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showEditText, setShowEditText] = useState(false); // Inline text editing
    const [editTextValue, setEditTextValue] = useState(''); // Text value being edited
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

        // Update on scroll/resize
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
                setShowFonts(false);
                setShowColors(false);
                setShowMore(false);
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
                transform: 'translate(-50%, -100%) translateY(-12px)', // Center horizontally above the target
                zIndex: zIndex
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                setZIndex(1000); // Bring to front
            }}
            onTouchStart={(e) => {
                e.stopPropagation();
                setZIndex(1000);
            }}
            onMouseLeave={() => setZIndex(100)}
        >
            {/* Toolbar Content */}
            {/* Toolbar Body */}
            <div className="flex items-center gap-1 p-1 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">

                {/* Edit Text Button */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showEditText;
                            setShowEditText(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowMore(false);
                                setShowOpacity(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showEditText;
                            setShowEditText(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowMore(false);
                                setShowOpacity(false);
                            }
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showEditText ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
                        title="Edit Text"
                    >
                        <Pencil size={14} />
                    </button>

                    {showEditText && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-3 z-[200]">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Edit Text</div>
                            <input
                                type="text"
                                value={editTextValue}
                                onChange={(e) => setEditTextValue(e.target.value)}
                                autoFocus
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editTextValue.trim()) {
                                        updateSticker('text', editTextValue.trim());
                                        setShowEditText(false);
                                    }
                                }}
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setShowEditText(false)}
                                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (editTextValue.trim()) {
                                            updateSticker('text', editTextValue.trim());
                                            setShowEditText(false);
                                        }
                                    }}
                                    disabled={!editTextValue.trim()}
                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-[10px] font-bold transition-all"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />


                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showFonts;
                            setShowFonts(nextState);
                            if (nextState) {
                                setShowColors(false);
                                setShowMore(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showFonts;
                            setShowFonts(nextState);
                            if (nextState) {
                                setShowColors(false);
                                setShowMore(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-full transition-colors text-xs font-medium"
                        title="Font Family"
                    >
                        <span className="max-w-[80px] truncate" style={{ fontFamily: sticker.fontFamily }}>
                            {FONTS.find(f => f.family === sticker.fontFamily)?.name || 'Font'}
                        </span>
                        <ChevronDown size={12} className="text-zinc-500" />
                    </button>

                    {showFonts && (
                        <div className="absolute top-full left-0 mt-2 w-48 max-h-60 overflow-y-auto bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] custom-scrollbar">
                            {FONTS.map(font => (
                                <button
                                    key={font.family}
                                    onClick={() => { updateSticker('fontFamily', font.family); setShowFonts(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${sticker.fontFamily === font.family ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                                >
                                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                                    {sticker.fontFamily === font.family && <Check size={10} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                {/* Font Size */}
                <div className="flex items-center gap-1 px-2 group">
                    <span className="text-zinc-500"><Scaling size={12} /></span>
                    <input
                        type="number"
                        min="10"
                        max="200"
                        value={Math.round(sticker.fontSize)}
                        onChange={(e) => updateSticker('fontSize', Number(e.target.value))}
                        className="w-10 bg-transparent text-center text-xs font-medium focus:outline-none focus:bg-zinc-800 rounded px-0 py-1"
                    />
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                {/* Color Picker */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showColors;
                            setShowColors(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowMore(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showColors;
                            setShowColors(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowMore(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors"
                        title="Text Color"
                    >
                        <div
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: sticker.fill }}
                        />
                    </button>
                    {showColors && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-[#1e1e1e] border border-zinc-700/50 rounded-2xl shadow-xl z-[200] w-56">
                            <div className="flex flex-wrap gap-1.5 justify-center mb-3 p-1">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { updateSticker('fill', c); }}
                                        className={`w-6 h-6 rounded-full border-2 transition-all ${sticker.fill === c ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>

                            <div className="border-t border-zinc-800 pt-3">
                                <AttractiveColorPicker
                                    color={sticker.fill}
                                    onChange={(color) => updateSticker('fill', color)}
                                    className="border-none shadow-none p-0 bg-transparent"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                {/* Opacity Selector */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showOpacity;
                            setShowOpacity(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowMore(false);
                                setShowEditText(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showOpacity;
                            setShowOpacity(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowMore(false);
                                setShowEditText(false);
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


                <div className="w-px h-4 bg-zinc-700 mx-1" />

                {/* Alignment - Simple Toggle for now, or Cycle */}
                {/* Not fully implemented in PatternZone's Text yet (Konva Text has align prop: left, center, right) 
                     Assuming Konva Text nodes support 'align' prop usage.
                 */}
                {/* <button
                    onClick={() => {
                        const nextAlign = sticker.align === 'center' ? 'right' : sticker.align === 'right' ? 'left' : 'center';
                        updateSticker('align', nextAlign);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    title="Alignment"
                >
                     {sticker.align === 'left' && <AlignLeft size={14} />}
                     {sticker.align === 'right' && <AlignRight size={14} />}
                     {(sticker.align === 'center' || !sticker.align) && <AlignCenter size={14} />}
                </button> 

                <div className="w-px h-4 bg-zinc-700 mx-1" /> */}

                {/* More Menu */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showMore;
                            setShowMore(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        onTouchEnd={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            const nextState = !showMore;
                            setShowMore(nextState);
                            if (nextState) {
                                setShowFonts(false);
                                setShowColors(false);
                                setShowEditText(false);
                                setShowOpacity(false);
                            }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    >
                        <MoreHorizontal size={16} />
                    </button>
                    {showMore && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] flex flex-col gap-0.5">
                            <button onClick={() => { onDuplicate(); setShowMore(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left">
                                <Copy size={13} /> Duplicate
                            </button>
                            <button onClick={() => { onMoveForward(); setShowMore(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left">
                                <BringToFront size={13} /> Bring Forward
                            </button>
                            <button onClick={() => { onMoveBackward(); setShowMore(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left">
                                <SendToBack size={13} /> Send Backward
                            </button>
                            <div className="h-px bg-zinc-700 my-1" />
                            <button onClick={() => { onDelete(); setShowMore(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg text-left">
                                <Trash size={13} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Arrow/Pointer (Optional visual flair) */}
            <div className="w-3 h-3 bg-[#1e1e1e] border-b border-r border-zinc-700/50 rotate-45 -mt-1.5 z-40"></div>
        </div>,
        document.body
    );
};

export default React.memo(FloatingTextToolbar);
