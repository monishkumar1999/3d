import React, { useState } from 'react';

export const EditTextForm = ({ initialValue, onSave, onCancel }) => {
    const [value, setValue] = useState(initialValue);

    return (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-3 z-[200]">
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Edit Text</div>
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && value.trim()) {
                        onSave(value.trim());
                    }
                }}
            />
            <div className="flex gap-2 mt-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={() => { if (value.trim()) onSave(value.trim()); }}
                    disabled={!value.trim()}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-[10px] font-bold transition-all"
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default EditTextForm;
