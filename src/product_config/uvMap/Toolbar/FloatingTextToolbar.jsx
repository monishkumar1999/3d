import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Scaling, Droplet, MoreHorizontal, Pencil } from 'lucide-react';
import { useScreenPosition } from "./useScreenPosition";
import { FontSelector, FONTS } from "./FontSelector";
import { ColorPicker } from "./ColorPicker";
import FloatingTextMoreMenu from "./FloatingTextMoreMenu";
import EditTextForm from "./EditTextForm";

const FloatingTextToolbar = ({
    sticker, onChange, onDuplicate, onDelete, onMoveForward, onMoveBackward, position, containerRef
}) => {
    const [showFonts, setShowFonts] = useState(false);
    const [showColors, setShowColors] = useState(false);
    const [showOpacity, setShowOpacity] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showEditText, setShowEditText] = useState(false);
    const toolbarRef = useRef(null);
    const [zIndex, setZIndex] = useState(500);
    const screenPos = useScreenPosition(containerRef, position);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowFonts(false); setShowColors(false); setShowMore(false); setShowEditText(false); setShowOpacity(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    if (!sticker || !screenPos) return null;

    return createPortal(
        <div
            ref={toolbarRef} className="fixed flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
            style={{ left: screenPos.left, top: screenPos.top, transform: 'translate(-50%, -100%) translateY(-12px)', zIndex }}
            onMouseDown={(e) => { e.stopPropagation(); setZIndex(1000); }} onTouchStart={(e) => { e.stopPropagation(); setZIndex(1000); }}
        >
            <div className="flex items-center gap-1 p-1 bg-[#1e1e1e] rounded-full shadow-2xl border border-zinc-700/50 text-white">
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowEditText(!showEditText); setShowFonts(false); setShowColors(false); setShowMore(false); setShowOpacity(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showEditText ? 'bg-indigo-600' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
                        title="Edit Text"
                    ><Pencil size={14} /></button>
                    {showEditText && <EditTextForm initialValue={sticker.text || ''} onSave={(val) => { onChange({ text: val }); setShowEditText(false); }} onCancel={() => setShowEditText(false)} />}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowFonts(!showFonts); setShowColors(false); setShowMore(false); setShowEditText(false); setShowOpacity(false); }}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-full transition-colors text-xs font-medium" title="Font Family"
                    >
                        <span className="max-w-[80px] truncate" style={{ fontFamily: sticker.fontFamily }}>{FONTS.find(f => f.family === sticker.fontFamily)?.name || 'Font'}</span>
                        <ChevronDown size={12} className="text-zinc-500" />
                    </button>
                    {showFonts && <FontSelector activeFamily={sticker.fontFamily} onSelect={(fam) => { onChange({ fontFamily: fam }); setShowFonts(false); }} />}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <div className="flex items-center gap-1 px-2">
                    <span className="text-zinc-500"><Scaling size={12} /></span>
                    <input
                        type="number" min="10" max="200" value={Math.round(sticker.fontSize)}
                        onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                        className="w-10 bg-transparent text-center text-xs font-medium focus:outline-none focus:bg-zinc-800 rounded px-0 py-1"
                    />
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); setShowFonts(false); setShowMore(false); setShowEditText(false); setShowOpacity(false); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors" title="Text Color"
                    ><div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: sticker.fill }} /></button>
                    {showColors && <ColorPicker currentColor={sticker.fill} onSelectColor={(col) => onChange({ fill: col })} />}
                </div>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowOpacity(!showOpacity); setShowFonts(false); setShowColors(false); setShowMore(false); setShowEditText(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showOpacity ? 'bg-zinc-800' : 'hover:bg-zinc-800 text-zinc-300'}`} title="Opacity"
                    >
                        <div className="relative">
                            <Droplet size={16} />
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-zinc-500" style={{ width: '12px', opacity: (sticker.opacity ?? 1) }} />
                        </div>
                    </button>
                    {showOpacity && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-4 z-[200] flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider"><span>Opacity</span><span>{Math.round((sticker.opacity ?? 1) * 100)}%</span></div>
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
                        onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); setShowFonts(false); setShowColors(false); setShowEditText(false); setShowOpacity(false); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    ><MoreHorizontal size={16} /></button>
                    {showMore && <FloatingTextMoreMenu onDuplicate={onDuplicate} onMoveForward={onMoveForward} onMoveBackward={onMoveBackward} onDelete={onDelete} setShowMore={setShowMore} />}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default React.memo(FloatingTextToolbar);
