import React from "react";
import { X, Sparkles, Square, PenLine, Trash2, CheckCheck } from "lucide-react";
import useStore from "../../store/useStore";

export const PatternHeader = ({ meshName, isSelected, triggerExport, onUpdateTexture }) => {
    const updatePatternState = useStore(state => state.updatePatternState);
    const meshState = useStore(state => state.patternStates[meshName]) || {
        stickers: [], textNodes: [], zones: [], zoneMode: null,
        polyPoints: [], selectedZoneId: null
    };

    const { stickers, textNodes, zones, zoneMode, polyPoints } = meshState;

    return (
        <div className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
            <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`}>
                {meshName}
                {zones.length > 0 && !zoneMode && (
                    <span className="bg-cyan-100 text-cyan-600 text-[8px] px-1 rounded font-bold border border-cyan-200">
                        {zones.length} zone{zones.length > 1 ? 's' : ''}
                    </span>
                )}
            </span>
            <div className="flex items-center gap-1">
                {zoneMode ? (
                    <>
                        <span className="text-[9px] text-indigo-500 font-bold mr-1 italic">
                            {zoneMode === 'rect' ? 'Drag to draw rect' : polyPoints.length === 0 ? 'Click to add points' : `${polyPoints.length / 2} points — Double click to close`}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { zoneMode: 'rect', polyPoints: [], drawingRect: null }); }}
                            className={`px-2 py-0.5 text-[9px] rounded font-bold border transition-all ${zoneMode === 'rect' ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-400'}`}>
                            <Square size={9} className="inline mr-1" />Rect
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { zoneMode: 'poly', drawingRect: null, polyPoints: [] }); }}
                            className={`px-2 py-0.5 text-[9px] rounded font-bold border transition-all ${zoneMode === 'poly' ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-400'}`}>
                            <PenLine size={9} className="inline mr-1" />Poly
                        </button>
                        {zones.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { zones: [], selectedZoneId: null }); }}
                                className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Clear all zones">
                                <Trash2 size={11} />
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { zoneMode: null, drawingRect: null, polyPoints: [], cursorPos: null }); }}
                            className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-bold shadow-sm transition-colors">
                            <CheckCheck size={10} />Done
                        </button>
                    </>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { zoneMode: 'rect', selectedId: null }); }}
                        className={`p-1.5 rounded-lg border transition-all ${zones.length > 0 ? 'bg-cyan-50 text-cyan-600 border-cyan-200 shadow-sm' : 'text-zinc-400 hover:bg-zinc-100 border-transparent hover:border-zinc-200'}`}
                        title="Draw customization zones"
                    >
                        <Square size={12} />
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); triggerExport(); }}
                    className="p-1 hover:bg-indigo-50 text-indigo-400 rounded-full" title="Sync 3D">
                    <Sparkles size={11} />
                </button>
                {(stickers.length > 0 || textNodes.length > 0) && (
                    <button onClick={(e) => { e.stopPropagation(); updatePatternState(meshName, { stickers: [], textNodes: [], selectedId: null }); onUpdateTexture(meshName, null); }}
                        className="p-1 hover:bg-red-50 text-red-400 rounded-full">
                        <X size={11} />
                    </button>
                )}
            </div>
        </div>
    );
};
