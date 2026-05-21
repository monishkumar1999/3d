import React from 'react';
import AttractiveColorPicker from "../../../components/ui/AttractiveColorPicker";

const PRESET_COLORS = [
    "#000000", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"
];

export const ColorPicker = ({ currentColor, onSelectColor }) => {
    return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-[#1e1e1e] border border-zinc-700/50 rounded-2xl shadow-xl z-[200] w-56">
            <div className="flex flex-wrap gap-1.5 justify-center mb-3 p-1">
                {PRESET_COLORS.map(c => (
                    <button
                        key={c}
                        onClick={() => onSelectColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${currentColor === c ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                    />
                ))}
            </div>

            <div className="border-t border-zinc-800 pt-3">
                <AttractiveColorPicker
                    color={currentColor}
                    onChange={onSelectColor}
                    className="border-none shadow-none p-0 bg-transparent"
                />
            </div>
        </div>
    );
};
