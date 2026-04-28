import { memo } from "react";
import { MIN_TEXTURE_REPEAT, MAX_TEXTURE_REPEAT, formatTextureRepeat } from "../pbrUtils";

const SettingsSection = memo(({ selectedSettings, onSettingChange }) => {
    return (
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Texture Repeat</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                        {formatTextureRepeat(selectedSettings.textureRepeat)}x
                    </span>
                </div>
                <input
                    type="range"
                    min={MIN_TEXTURE_REPEAT}
                    max={MAX_TEXTURE_REPEAT}
                    step="0.25"
                    value={selectedSettings.textureRepeat}
                    onChange={(e) => onSettingChange({ textureRepeat: parseFloat(e.target.value) })}
                    className="h-1.5 w-full appearance-none rounded-full bg-zinc-200 accent-indigo-500"
                />
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Normal Strength</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                        {selectedSettings.normalIntensity.toFixed(1)}x
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={selectedSettings.normalIntensity}
                    onChange={(e) => onSettingChange({ normalIntensity: parseFloat(e.target.value) })}
                    className="h-1.5 w-full appearance-none rounded-full bg-zinc-200 accent-indigo-500"
                />
            </div>
        </div>
    );
});

SettingsSection.displayName = "SettingsSection";
export default SettingsSection;
