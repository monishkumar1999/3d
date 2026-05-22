import React from 'react';
import { Copy, BringToFront, SendToBack, Trash } from 'lucide-react';

export const FloatingTextMoreMenu = ({ onDuplicate, onMoveForward, onMoveBackward, onDelete, setShowMore }) => {
    return (
        <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] flex flex-col gap-0.5">
            <button
                onClick={() => { onDuplicate(); setShowMore(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left"
            >
                <Copy size={13} /> Duplicate
            </button>
            <button
                onClick={() => { onMoveForward(); setShowMore(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left"
            >
                <BringToFront size={13} /> Bring Forward
            </button>
            <button
                onClick={() => { onMoveBackward(); setShowMore(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg text-left"
            >
                <SendToBack size={13} /> Send Backward
            </button>
            <div className="h-px bg-zinc-700 my-1" />
            <button
                onClick={() => { onDelete(); setShowMore(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/10 rounded-lg text-left"
            >
                <Trash size={13} /> Delete
            </button>
        </div>
    );
};

export default FloatingTextMoreMenu;
