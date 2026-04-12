/**
 * useProductConfigStore.js
 *
 * Zustand store for the /product-config feature.
 * Manages: GLB loading, mesh discovery, mesh selection, and PBR textures.
 *
 * PBR textures (THREE.Texture) are non-serializable objects — Zustand
 * handles them fine in memory; just don't use persist middleware here.
 */
import { create } from "zustand";
import * as THREE from "three";

// ── PBR slot definitions (shared with UI components via this file) ──
export const PBR_SLOTS = [
    { key: "map",          label: "Diffuse / Base Color",    colorSpace: THREE.SRGBColorSpace        },
    { key: "normalMap",    label: "Normal Map",              colorSpace: THREE.LinearSRGBColorSpace  },
    { key: "roughnessMap", label: "Roughness",               colorSpace: THREE.LinearSRGBColorSpace  },
    { key: "metalnessMap", label: "Metalness",               colorSpace: THREE.LinearSRGBColorSpace  },
    { key: "aoMap",        label: "AO (Ambient Occlusion)",  colorSpace: THREE.LinearSRGBColorSpace  },
];

// ── Helper: load a File into a THREE.Texture ──────────────────────────
function loadTextureFromFile(file, colorSpace) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace  = colorSpace;
            tex.flipY       = false;
            tex.needsUpdate = true;
            URL.revokeObjectURL(url);
            resolve(tex);
        });
    });
}

// ── Store ─────────────────────────────────────────────────────────────
export const useProductConfigStore = create((set, get) => ({

    // ── GLB ────────────────────────────────────────────────────────
    glbUrl:       null,   // blob URL of loaded .glb
    fileName:     null,   // original file name (display only)
    _prevBlobUrl: null,   // internal — tracks URL to revoke on next load

    loadGlb: (file) => {
        if (!file || !file.name.toLowerCase().endsWith(".glb")) return;
        const prev = get()._prevBlobUrl;
        if (prev) URL.revokeObjectURL(prev);
        const url = URL.createObjectURL(file);
        set({
            glbUrl:       url,
            fileName:     file.name,
            _prevBlobUrl: url,
            meshNames:    [],
            selectedMesh: null,
            pbrMap:       {},
        });
    },

    resetGlb: () => {
        const prev = get()._prevBlobUrl;
        if (prev) URL.revokeObjectURL(prev);
        set({ glbUrl: null, fileName: null, _prevBlobUrl: null, meshNames: [], selectedMesh: null, pbrMap: {} });
    },

    // ── Meshes ─────────────────────────────────────────────────────
    meshNames:    [],   // string[]  — populated by GlbModelPbr after scene parse
    selectedMesh: null, // string | null

    setMeshNames:  (names) => set({ meshNames: names }),
    selectMesh:    (name)  => set({ selectedMesh: name }),

    // ── PBR textures ───────────────────────────────────────────────
    // Shape: { [meshName]: { map?: Texture, normalMap?: Texture, ... } }
    pbrMap: {},

    /** Upload a file for a given mesh+slot. Pass file=null to clear the slot. */
    applyMap: async (meshName, slot, file) => {
        if (!file) {
            set((s) => ({
                pbrMap: {
                    ...s.pbrMap,
                    [meshName]: { ...s.pbrMap[meshName], [slot.key]: null },
                },
            }));
            return;
        }
        const tex = await loadTextureFromFile(file, slot.colorSpace);
        set((s) => ({
            pbrMap: {
                ...s.pbrMap,
                [meshName]: { ...s.pbrMap[meshName], [slot.key]: tex },
            },
        }));
    },

    /** Remove all PBR textures for a mesh */
    clearMeshPbr: (meshName) =>
        set((s) => {
            const next = { ...s.pbrMap };
            delete next[meshName];
            return { pbrMap: next };
        }),
}));
