/**
 * usePbrTextures.js
 * Manages per-mesh PBR texture state.
 * Returns:
 *   pbrMap   — { meshName: { map, normalMap, roughnessMap, metalnessMap, aoMap } }
 *   applyMap — (meshName, slot, threeTexture | null) => void
 *   clearMesh — (meshName) => void
 */
import { useState, useCallback } from "react";
import * as THREE from "three";

// PBR slots supported
export const PBR_SLOTS = [
    { key: "map",          label: "Diffuse / Base Color", colorSpace: THREE.SRGBColorSpace },
    { key: "normalMap",    label: "Normal Map",           colorSpace: THREE.LinearSRGBColorSpace },
    { key: "roughnessMap", label: "Roughness",            colorSpace: THREE.LinearSRGBColorSpace },
    { key: "metalnessMap", label: "Metalness",            colorSpace: THREE.LinearSRGBColorSpace },
    { key: "aoMap",        label: "AO (Ambient Occlusion)", colorSpace: THREE.LinearSRGBColorSpace },
];

export function usePbrTextures() {
    // { meshName: { map: THREE.Texture | null, normalMap: ..., ... } }
    const [pbrMap, setPbrMap] = useState({});

    /** Load a file into a THREE.Texture and store it */
    const loadTextureFromFile = useCallback((file, colorSpace) => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const loader = new THREE.TextureLoader();
            loader.load(url, (tex) => {
                tex.colorSpace  = colorSpace;
                tex.flipY       = false;
                tex.needsUpdate = true;
                URL.revokeObjectURL(url);
                resolve(tex);
            });
        });
    }, []);

    const applyMap = useCallback(async (meshName, slot, file) => {
        if (!file) {
            // Clear slot
            setPbrMap(prev => ({
                ...prev,
                [meshName]: { ...prev[meshName], [slot.key]: null },
            }));
            return;
        }
        const tex = await loadTextureFromFile(file, slot.colorSpace);
        setPbrMap(prev => ({
            ...prev,
            [meshName]: { ...prev[meshName], [slot.key]: tex },
        }));
    }, [loadTextureFromFile]);

    const clearMesh = useCallback((meshName) => {
        setPbrMap(prev => {
            const next = { ...prev };
            delete next[meshName];
            return next;
        });
    }, []);

    return { pbrMap, applyMap, clearMesh };
}
