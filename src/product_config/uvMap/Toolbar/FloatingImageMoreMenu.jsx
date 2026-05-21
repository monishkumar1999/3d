import React from 'react';
import { Copy, Trash, Lock, BringToFront, ArrowUp, ArrowDown, SendToBack } from 'lucide-react';

export const FloatingImageMoreMenu = ({
    onDuplicate, onDelete, onMoveToFront, onMoveForward, onMoveBackward, onMoveToBack, setShowMore
}) => {
    return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] flex flex-col gap-0.5">
            <button onClick={() => { onDuplicate(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left transition-colors">
                <Copy size={14} className="text-zinc-500" /> Duplicate
            </button>
            <button onClick={() => { onDelete(); setShowMore(false); }} className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg text-left transition-colors">
                <Trash size={14} /> Delete
            </button>
            <button className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-800 rounded-lg text-left transition-colors cursor-not-allowed opacity-50">
                <Lock size={14} /> Lock
            </button>
            <div className="h-px bg-zinc-700/50 my-1" />
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
    );
};
