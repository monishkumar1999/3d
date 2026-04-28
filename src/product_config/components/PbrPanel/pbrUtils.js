/**
 * pbrUtils.js
 * Shared constants and helpers for the PBR Panel
 */
export const MIN_TEXTURE_REPEAT = 0.25;
export const MAX_TEXTURE_REPEAT = 8;

export function formatTextureRepeat(value) {
    const formatted = Number(value ?? 1.0).toFixed(2);
    return formatted.replace(/\.?0+$/, "");
}

export function getActiveSetState(meshSetState) {
    const sets = meshSetState?.sets ?? [];
    const activeSetId = meshSetState?.activeSetId ?? sets[0]?.id ?? null;
    const activeSet = sets.find((pbrSet) => pbrSet.id === activeSetId) ?? sets[0] ?? null;

    return {
        sets,
        activeSet,
        activeSetId: activeSet?.id ?? activeSetId,
    };
}

export function hasTextureMaps(maps) {
    return Object.values(maps ?? {}).some(Boolean);
}

export function hasSetData(pbrSet) {
    return Boolean(pbrSet && hasTextureMaps(pbrSet.maps));
}

export function hasMeshSetData(meshSetState) {
    const sets = meshSetState?.sets ?? [];
    return sets.length > 1 || sets.some(hasSetData);
}

export function getSetName(pbrSet, index) {
    const name = pbrSet?.name?.trim();
    return name || `PBR Set ${index + 1}`;
}
