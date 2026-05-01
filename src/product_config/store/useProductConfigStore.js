/**
 * useProductConfigStore.js
 *
 * Zustand store for the /product-config feature.
 * Manages: GLB loading, mesh discovery, mesh selection, and PBR texture sets.
 *
 * PBR textures (THREE.Texture) are non-serializable objects. Zustand
 * handles them fine in memory; just do not use persist middleware here.
 */
import { create } from "zustand";
import * as THREE from "three";
import { saveProductConfig, getProductNames, getProductDetails } from "../../api/productConfigApi";

// PBR slot definitions shared with UI components via this file.
export const PBR_SLOTS = [
    { key: "map", label: "Diffuse / Base Color", colorSpace: THREE.SRGBColorSpace },
    { key: "normalMap", label: "Normal Map", colorSpace: THREE.LinearSRGBColorSpace },
    { key: "roughnessMap", label: "Roughness", colorSpace: THREE.LinearSRGBColorSpace },
    { key: "metalnessMap", label: "Metalness", colorSpace: THREE.LinearSRGBColorSpace },
    { key: "aoMap", label: "AO (Ambient Occlusion)", colorSpace: THREE.LinearSRGBColorSpace },
];

export const DEFAULT_PBR_SETTINGS = {
    textureRepeat: 1,
    normalIntensity: 1,
};

let pbrSetCounter = 0;

function createPbrSetId() {
    pbrSetCounter += 1;
    return `pbr-set-${pbrSetCounter}`;
}

function createPbrSet(index, name) {
    return {
        id: createPbrSetId(),
        name: name || `PBR Set ${index}`,
        maps: {},
        settings: { ...DEFAULT_PBR_SETTINGS },
    };
}

function createPbrSetState() {
    const pbrSet = createPbrSet(1);
    return {
        activeSetId: pbrSet.id,
        sets: [pbrSet],
    };
}

function normalizePbrSetState(meshState) {
    if (!meshState?.sets?.length) return createPbrSetState();

    const activeSetExists = meshState.sets.some((pbrSet) => pbrSet.id === meshState.activeSetId);
    return {
        ...meshState,
        activeSetId: activeSetExists ? meshState.activeSetId : meshState.sets[0].id,
    };
}

function updateSetInState(state, meshId, setId, updater) {
    const meshState = normalizePbrSetState(state.pbrSets[meshId]);
    const requestedSetId = setId ?? meshState.activeSetId;
    const targetSetId = meshState.sets.some((pbrSet) => pbrSet.id === requestedSetId)
        ? requestedSetId
        : meshState.activeSetId;

    return {
        ...state.pbrSets,
        [meshId]: {
            ...meshState,
            activeSetId: targetSetId,
            sets: meshState.sets.map((pbrSet) => (
                pbrSet.id === targetSetId ? updater(pbrSet) : pbrSet
            )),
        },
    };
}

function pbrSetHasMaps(pbrSet) {
    return Object.values(pbrSet?.maps ?? {}).some(Boolean);
}

function isDefaultPbrSetName(name) {
    return /^PBR Set \d+$/.test(name ?? "");
}

function getPbrSetNameFromFile(file, fallback) {
    const name = file?.name?.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
    return name || fallback;
}

function loadTextureFromFile(file, colorSpace) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace = colorSpace;
            tex.flipY = false;
            tex.needsUpdate = true;
            URL.revokeObjectURL(url);
            resolve(tex);
        });
    });
}

function loadTextureFromUrl(url, colorSpace) {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace = colorSpace;
            tex.flipY = false;
            tex.needsUpdate = true;
            resolve(tex);
        });
    });
}

export const useProductConfigStore = create((set, get) => ({
    glbUrl: null,
    glbFile: null,          // raw File — needed for multipart upload
    fileName: null,
    availableProducts: [],
    _pendingConfig: null,
    _prevBlobUrl: null,

    isSaving: false,
    saveError: null,
    saveSuccess: false,
    createdProductId: null,  // set after a successful first-time create

    loadGlb: (file) => {
        if (!file || !file.name.toLowerCase().endsWith(".glb")) return;

        const prev = get()._prevBlobUrl;
        if (prev) URL.revokeObjectURL(prev);

        const url = URL.createObjectURL(file);
        set({
            glbUrl: url,
            glbFile: file,          // keep raw File for upload
            fileName: file.name,
            _prevBlobUrl: url,
            meshes: [],
            selectedMeshId: null,
            pbrSets: {},
            saveError: null,
            saveSuccess: false,
        });
    },

    resetGlb: () => {
        const prev = get()._prevBlobUrl;
        if (prev) URL.revokeObjectURL(prev);

        set({
            glbUrl: null,
            glbFile: null,
            fileName: null,
            availableProducts: [],
            _prevBlobUrl: null,
            meshes: [],
            selectedMeshId: null,
            pbrSets: {},
            saveError: null,
            saveSuccess: false,
        });
    },

    fetchProductDetails: async (id) => {
        set({ isSaving: true, saveError: null });
        try {
            console.log("Fetching product details for:", id);
            const res = await getProductDetails(id);
            console.log("API Response:", res.data);
            
            if (res.data?.success) {
                const product = res.data.product;
                set({ 
                    glbUrl: product.base_model_url,
                    fileName: product.name,
                    createdProductId: product.id,
                    _pendingConfig: product.configuration,
                    isSaving: false
                });
            } else {
                set({ isSaving: false, saveError: res.data?.message || "Failed to fetch product data" });
            }
        } catch (err) {
            console.error("fetchProductDetails error:", err);
            set({ isSaving: false, saveError: "Network error: check if backend is running" });
        }
    },

    fetchProductNames: async () => {
        try {
            const res = await getProductNames();
            if (res.data?.success) {
                set({ availableProducts: res.data.products || [] });
            }
        } catch (err) {
            console.error("Failed to fetch product names:", err);
        }
    },

    meshes: [],
    selectedMeshId: null,

    setMeshes: async (meshes) => {
        const state = get();
        const meshIds = new Set(meshes.map((mesh) => mesh.id));
        const nextPbrSets = { ...state.pbrSets };

        meshes.forEach((mesh) => {
            if (!nextPbrSets[mesh.id]) {
                nextPbrSets[mesh.id] = normalizePbrSetState(null);
            }
        });

        set({
            meshes,
            selectedMeshId: meshIds.has(state.selectedMeshId) ? state.selectedMeshId : null,
            pbrSets: nextPbrSets,
        });

        // Apply pending config if exists
        if (state._pendingConfig) {
            const config = state._pendingConfig;
            set({ _pendingConfig: null });

            const newPbrSets = { ...nextPbrSets };
            
            for (const meshConf of (config.meshes || [])) {
                // Find matching mesh in discovered meshes
                const actualMesh = meshes.find(m => m.label === meshConf.name || m.id === meshConf.name);
                if (!actualMesh) continue;

                const sets = await Promise.all((meshConf.sets || []).map(async (setConf, idx) => {
                    const maps = {};
                    for (const slot of PBR_SLOTS) {
                        const url = setConf.maps?.[slot.key];
                        if (url) {
                            maps[slot.key] = await loadTextureFromUrl(url, slot.colorSpace);
                        }
                    }
                    return {
                        id: idx + 1,
                        name: setConf.name || `Set ${idx + 1}`,
                        maps,
                        settings: {
                            textureRepeat: setConf.textureRepeat || 1,
                            normalIntensity: setConf.normalIntensity || 1,
                        }
                    };
                }));

                if (sets.length > 0) {
                    newPbrSets[actualMesh.id] = {
                        activeSetId: sets[0].id,
                        sets
                    };
                }
            }
            set({ pbrSets: newPbrSets });
        }
    },

    selectMesh: (meshId) => set({ selectedMeshId: meshId }),
    // Proxy for the UI to latch onto a set state if no mesh is explicitly selected
    getGlobalSetState: () => {
        const { meshes, pbrSets } = get();
        if (meshes.length === 0) return null;
        return pbrSets[meshes[0].id] || normalizePbrSetState(null);
    },

    // Shape: { [meshId]: { activeSetId, sets: [{ id, name, maps, settings }] } }
    pbrSets: {},

    addPbrSet: (meshId) => {
        const { meshes } = get();
        const targets = meshes.map(m => m.id);

        set((state) => {
            const nextPbrSets = { ...state.pbrSets };
            
            targets.forEach(tId => {
                const meshState = normalizePbrSetState(nextPbrSets[tId]);
                // Create a completely FRESH set (no copying from active set)
                const nextId = Math.max(0, ...meshState.sets.map((s) => s.id)) + 1;
                const pbrSet = {
                    ...createPbrSet(nextId, `PBR Set ${nextId}`),
                    settings: { ...DEFAULT_PBR_SETTINGS },
                    maps: {},
                };

                nextPbrSets[tId] = {
                    ...meshState,
                    activeSetId: pbrSet.id,
                    sets: [...meshState.sets, pbrSet],
                };
            });

            return { pbrSets: nextPbrSets };
        });
    },

    selectPbrSet: (meshId, setId) => {
        const { meshes } = get();
        // meshId and setId here are coming from the UI (usually the first mesh as proxy)
        const sourceMeshId = meshId || (meshes[0]?.id);
        if (!sourceMeshId || !setId) return;

        set((state) => {
            const currentMeshState = normalizePbrSetState(state.pbrSets[sourceMeshId]);
            const selectedIndex = currentMeshState.sets.findIndex(s => s.id === setId);

            if (selectedIndex === -1) return {};

            // Sync by index across ALL meshes
            const nextPbrSets = { ...state.pbrSets };
            meshes.forEach(m => {
                const mState = normalizePbrSetState(nextPbrSets[m.id]);
                const targetSet = mState.sets[selectedIndex] || mState.sets[0];
                nextPbrSets[m.id] = { ...mState, activeSetId: targetSet.id };
            });

            return { pbrSets: nextPbrSets };
        });
    },

    updatePbrSet: (meshId, setId, patch) => {
        const { meshes } = get();
        const sourceMeshId = meshId || (meshes[0]?.id);
        if (!sourceMeshId || !setId || !patch) return;

        set((state) => {
            const currentMeshState = normalizePbrSetState(state.pbrSets[sourceMeshId]);
            const selectedIndex = currentMeshState.sets.findIndex(s => s.id === setId);

            if (selectedIndex === -1) return {};

            const nextPbrSets = { ...state.pbrSets };

            meshes.forEach(tId => {
                const mState = normalizePbrSetState(nextPbrSets[tId]);
                const targetSet = mState.sets[selectedIndex];
                if (targetSet) {
                    nextPbrSets[tId] = {
                        ...mState,
                        sets: mState.sets.map(s => s.id === targetSet.id ? { ...s, ...patch } : s)
                    };
                }
            });

            return { pbrSets: nextPbrSets };
        });
    },

    removePbrSet: (meshId, setId) => {
        const { meshes } = get();
        const sourceMeshId = meshId || (meshes[0]?.id);
        if (!sourceMeshId || !setId) return;

        set((state) => {
            const currentMeshState = normalizePbrSetState(state.pbrSets[sourceMeshId]);
            const selectedIndex = currentMeshState.sets.findIndex(s => s.id === setId);

            if (selectedIndex === -1) return {};

            const nextPbrSets = { ...state.pbrSets };

            meshes.forEach(tId => {
                const mState = normalizePbrSetState(nextPbrSets[tId]);
                if (mState.sets.length <= 1) return;

                const targetSet = mState.sets[selectedIndex];
                if (!targetSet) return;

                const sets = mState.sets.filter((s) => s.id !== targetSet.id);
                const activeSetId = mState.activeSetId === targetSet.id ? sets[0].id : mState.activeSetId;

                nextPbrSets[tId] = { ...mState, activeSetId, sets };
            });

            return { pbrSets: nextPbrSets };
        });
    },

    applyMap: async (meshId, setId, slot, file) => {
        if (!meshId || !slot) return;

        const files = Array.isArray(file) ? file.filter(Boolean) : file ? [file] : [];

        if (files.length === 0) {
            set((state) => ({
                pbrSets: updateSetInState(state, meshId, setId, (pbrSet) => ({
                    ...pbrSet,
                    maps: { ...pbrSet.maps, [slot.key]: null },
                })),
            }));
            return;
        }

        const loadedMaps = await Promise.all(
            files.map(async (mapFile) => ({
                file: mapFile,
                texture: await loadTextureFromFile(mapFile, slot.colorSpace),
            }))
        );

        set((state) => ({
            pbrSets: (() => {
                const meshState = normalizePbrSetState(state.pbrSets[meshId]);
                const textureData = loadedMaps[0];
                if (!textureData) return state.pbrSets;

                const targetSetId = setId ?? meshState.activeSetId;
                const setIndex = meshState.sets.findIndex((pbrSet) => pbrSet.id === targetSetId);
                if (setIndex === -1) return state.pbrSets;

                const nextSets = [...meshState.sets];
                const currentSet = nextSets[setIndex];
                const shouldRenameSet = !pbrSetHasMaps(currentSet) && isDefaultPbrSetName(currentSet.name);

                nextSets[setIndex] = {
                    ...currentSet,
                    name: shouldRenameSet
                        ? getPbrSetNameFromFile(textureData.file, currentSet.name)
                        : currentSet.name,
                    maps: { ...currentSet.maps, [slot.key]: textureData.texture },
                };

                return {
                    ...state.pbrSets,
                    [meshId]: {
                        ...meshState,
                        activeSetId: targetSetId,
                        sets: nextSets,
                    },
                };
            })(),
        }));
    },

    clearMeshPbr: (meshId) =>
        set((state) => {
            if (!meshId) return {};

            return {
                pbrSets: {
                    ...state.pbrSets,
                    [meshId]: createPbrSetState(),
                },
            };
        }),

    clearPbrSet: (meshId, setId) => {
        if (!meshId) return;

        set((state) => ({
            pbrSets: updateSetInState(state, meshId, setId, (pbrSet) => ({
                ...pbrSet,
                maps: {},
                settings: { ...DEFAULT_PBR_SETTINGS },
            })),
        }));
    },

    updatePbrSettings: (meshId, setId, patch) => {
        if (!meshId) return;

        set((state) => ({
            pbrSets: updateSetInState(state, meshId, setId, (pbrSet) => ({
                ...pbrSet,
                settings: {
                    ...DEFAULT_PBR_SETTINGS,
                    ...pbrSet.settings,
                    ...patch,
                },
            })),
        }));
    },

    /**
     * saveConfig({ productId, productName })
     *
     * Both create and update go through POST /product/config/save.
     * The backend distinguishes them by the presence of product_id vs product_name:
     *   - product_id present  → UPDATE existing product
     *   - product_name only   → CREATE new product (first-time)
     *
     * After a successful first-time create the returned product_id is stored
     * in `createdProductId` so subsequent saves become updates.
     */
    saveConfig: async ({ productId, productName } = {}) => {
        const { glbFile, meshes, pbrSets } = get();
        const isCreate = !productId;

        if (!glbFile && isCreate) {
            set({ saveError: "Please load a GLB model first.", saveSuccess: false });
            return;
        }


        if (isCreate && !productName?.trim()) {
            set({ saveError: "Please enter a product name.", saveSuccess: false });
            return;
        }

        set({ isSaving: true, saveError: null, saveSuccess: false });

        try {
            const fd = new FormData();
            fd.append("glb_file", glbFile);

            // Backend uses product_id (update) OR product_name (create) to decide
            if (productId)              fd.append("product_id",   productId);
            if (isCreate && productName) fd.append("product_name", productName.trim());

            // Build mesh + PBR texture entries
            const blobPromises = [];

            meshes.forEach((mesh, meshIdx) => {
                fd.append(`meshes[${meshIdx}][name]`, mesh.label ?? mesh.id);

                const meshState = normalizePbrSetState(pbrSets[mesh.id]);
                meshState.sets.forEach((pbrSet, setIdx) => {
                    const prefix = `meshes[${meshIdx}][sets][${setIdx}]`;
                    fd.append(`${prefix}[name]`,            pbrSet.name ?? `Set ${setIdx + 1}`);
                    fd.append(`${prefix}[textureRepeat]`,   pbrSet.settings?.textureRepeat  ?? 1);
                    fd.append(`${prefix}[normalIntensity]`, pbrSet.settings?.normalIntensity ?? 1);

                    PBR_SLOTS.forEach((slot) => {
                        const tex = pbrSet.maps?.[slot.key];
                        if (tex?.image) {
                            const canvas = document.createElement("canvas");
                            canvas.width  = tex.image.width  || 512;
                            canvas.height = tex.image.height || 512;
                            canvas.getContext("2d").drawImage(tex.image, 0, 0);
                            blobPromises.push(
                                new Promise((res) =>
                                    canvas.toBlob((blob) => {
                                        if (blob) fd.append(`${prefix}[${slot.key}]`, blob, `${slot.key}.png`);
                                        res();
                                    }, "image/png")
                                )
                            );
                        }
                    });
                });
            });

            // Wait for ALL canvas.toBlob() calls to resolve before sending
            await Promise.all(blobPromises);

            // Single endpoint handles create AND update
            const response = await saveProductConfig(fd);

            // If this was a first-time create, store the returned product_id
            if (isCreate) {
                const newId = response?.data?.product_id ?? response?.data?.product?.id ?? null;
                if (newId) set({ createdProductId: newId });
            }

            set({ isSaving: false, saveSuccess: true, saveError: null });
            setTimeout(() => set({ saveSuccess: false }), 3000);
        } catch (err) {
            const msg = err?.response?.data?.message ?? err?.message ?? "Save failed.";
            set({ isSaving: false, saveError: msg, saveSuccess: false });
        }
    },
}));