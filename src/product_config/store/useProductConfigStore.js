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
import { saveProductConfig, getProductNames, getProductDetails, deleteVariant } from "../../api/productConfigApi";
import { store as reduxStore } from "../../store/redux/store";
import { startLoading, stopLoading, updateProgress, updateMessage } from "../../store/redux/loaderSlice";


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
    transmission: 0,
    opacity: 1,
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
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        new THREE.TextureLoader().load(
            url,
            (tex) => {
                tex.colorSpace = colorSpace || THREE.NoColorSpace;
                tex.flipY = false;
                tex.needsUpdate = true;
                URL.revokeObjectURL(url);
                resolve(tex);
            },
            undefined, // onProgress
            (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            }
        );
    });
}

function loadTextureFromUrl(url, colorSpace) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
            url,
            (tex) => {
                tex.colorSpace = colorSpace || THREE.NoColorSpace;
                tex.flipY = false;
                tex.needsUpdate = true;
                resolve(tex);
            },
            undefined,
            (err) => reject(err)
        );
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
        reduxStore.dispatch(startLoading({
            title: "Fetching Product Data",
            message: "Retrieving configuration and variants from database...",
            type: "process",
            progress: 20
        }));
        try {
            console.log("Fetching product details for:", id);
            const res = await getProductDetails(id);
            console.log("API Response:", res.data);

            reduxStore.dispatch(updateProgress(60));

            if (res.data?.success) {
                const product = res.data.product;
                
                reduxStore.dispatch(updateMessage("Processing and loading 3D model..."));
                reduxStore.dispatch(updateProgress(80));

                set({
                    glbUrl: product.base_model_url,
                    fileName: product.name,
                    createdProductId: product.id,
                    _pendingVariants: product.variants,
                    isSaving: false
                });

                // If there are no variants/textures to load, we stop the loading modal now.
                // Otherwise, setMeshes will take over the loader and stop it when done!
                const hasVariants = product.variants && product.variants.length > 0;
                if (!hasVariants) {
                    reduxStore.dispatch(stopLoading());
                }
            } else {
                set({ isSaving: false, saveError: res.data?.message || "Failed to fetch product data" });
                reduxStore.dispatch(stopLoading());
            }
        } catch (err) {
            console.error("fetchProductDetails error:", err);
            set({ isSaving: false, saveError: "Network error: check if backend is running" });
            reduxStore.dispatch(stopLoading());
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

        // Apply pending variants if they exist
        if (state._pendingVariants && state._pendingVariants.length > 0) {
            const variants = state._pendingVariants;
            set({ _pendingVariants: null });

            const newPbrSets = { ...nextPbrSets };

            // First, ensure all meshes have the correct number of sets (one per variant)
            meshes.forEach(m => {
                newPbrSets[m.id] = {
                    activeSetId: null,
                    sets: variants.map((v, idx) => ({
                        id: v.id || (idx + 1),
                        name: v.name || `Set ${idx + 1}`,

                        maps: {},
                        settings: { ...DEFAULT_PBR_SETTINGS }
                    }))
                };
                if (newPbrSets[m.id].sets.length > 0) {
                    newPbrSets[m.id].activeSetId = newPbrSets[m.id].sets[0].id;
                }
            });

            // Let's count how many texture maps we need to fetch in total
            let totalTexturesCount = 0;
            let loadedTexturesCount = 0;

            variants.forEach(variant => {
                (variant.textures || []).forEach(texture => {
                    const actualMesh = meshes.find(m => m.name === texture.meshName || m.label === texture.meshName);
                    if (!actualMesh) return;

                    PBR_SLOTS.forEach(slot => {
                        if (texture[slot.key]) {
                            totalTexturesCount++;
                        }
                    });
                });
            });

            console.log(`[Store] Total pending variant textures to load: ${totalTexturesCount}`);

            if (totalTexturesCount > 0) {
                reduxStore.dispatch(startLoading({
                    title: "Loading Product Textures",
                    message: `Loading 0 of ${totalTexturesCount} texture maps...`,
                    type: "texture",
                    progress: 0
                }));

                // Now, populate the maps from the textures
                for (let vIdx = 0; vIdx < variants.length; vIdx++) {
                    const variant = variants[vIdx];
                    const setId = vIdx + 1;

                    for (const texture of (variant.textures || [])) {
                        // Find matching mesh by meshName
                        const actualMesh = meshes.find(m => m.name === texture.meshName || m.label === texture.meshName);
                        if (!actualMesh) continue;

                        const pbrSet = newPbrSets[actualMesh.id].sets[vIdx];
                        if (!pbrSet) continue;

                        // Load textures for each slot
                        for (const slot of PBR_SLOTS) {
                            const url = texture[slot.key];
                            if (url) {
                                try {
                                    pbrSet.maps[slot.key] = await loadTextureFromUrl(url, slot.colorSpace);
                                } catch (err) {
                                    console.error(`Failed to load texture from url: ${url}`, err);
                                }
                                loadedTexturesCount++;
                                const progressPercent = Math.round((loadedTexturesCount / totalTexturesCount) * 100);
                                reduxStore.dispatch(updateProgress(progressPercent));
                                reduxStore.dispatch(updateMessage(`Loaded ${loadedTexturesCount} of ${totalTexturesCount} texture maps...`));
                            }
                        }

                        // Apply settings
                        pbrSet.settings = {
                            textureRepeat: parseFloat(texture.textureRepeat) || 1,
                            normalIntensity: parseFloat(texture.normalIntensity) || 1,
                            transmission: parseFloat(texture.transmission) || 0,
                            opacity: texture.opacity !== undefined && texture.opacity !== null ? parseFloat(texture.opacity) : 1,
                        };
                    }
                }

                set({ pbrSets: newPbrSets });

                // Texture loading fully complete! Stop loader after a tiny delay for smooth animation.
                reduxStore.dispatch(updateMessage("All textures loaded successfully!"));
                reduxStore.dispatch(updateProgress(100));
                setTimeout(() => {
                    reduxStore.dispatch(stopLoading());
                }, 600);
            } else {
                set({ pbrSets: newPbrSets });
                reduxStore.dispatch(stopLoading());
            }
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
                const mState = normalizePbrSetState(nextPbrSets[tId.id]);
                const targetSet = mState.sets[selectedIndex];
                if (targetSet) {
                    nextPbrSets[tId.id] = {
                        ...mState,
                        sets: mState.sets.map(s => s.id === targetSet.id ? { ...s, ...patch } : s)
                    };
                }
            });

            return { pbrSets: nextPbrSets };
        });
    },

    removePbrSet: async (meshId, setId) => {
        const { meshes } = get();
        const sourceMeshId = meshId || (meshes[0]?.id);
        if (!sourceMeshId || !setId) return;

        // If it's a real DB ID (not our local string format), call API
        const isLocal = typeof setId === "string" && setId.startsWith("pbr-set-");
        if (!isLocal) {
            try {
                await deleteVariant(setId);
            } catch (err) {
                console.error("Failed to delete variant from server:", err);
                // Continue with local removal anyway, or handle error as needed
            }
        }

        set((state) => {
            const currentMeshState = normalizePbrSetState(state.pbrSets[sourceMeshId]);
            const selectedIndex = currentMeshState.sets.findIndex(s => s.id === setId);

            if (selectedIndex === -1) return {};

            const nextPbrSets = { ...state.pbrSets };

            meshes.forEach(tId => {
                const mState = normalizePbrSetState(nextPbrSets[tId.id]);
                if (mState.sets.length <= 1) return;

                const targetSet = mState.sets[selectedIndex];
                if (!targetSet) return;

                const sets = mState.sets.filter((s) => s.id !== targetSet.id);
                const activeSetId = mState.activeSetId === targetSet.id ? sets[0].id : mState.activeSetId;

                nextPbrSets[tId.id] = { ...mState, activeSetId, sets };
            });

            return { pbrSets: nextPbrSets };
        });
    },


    applyMap: async (meshId, setId, slot, filesInput) => {
        if (!meshId || !slot) return;

        const files = Array.from(filesInput ?? []).filter(Boolean);

        // CASE: CLEAR SLOT
        if (files.length === 0) {
            console.log(`[Store] Clearing slot: ${slot.key} for mesh: ${meshId}`);
            set((state) => ({
                pbrSets: updateSetInState(state, meshId, setId, (pbrSet) => {
                    const newMaps = { ...pbrSet.maps };
                    if (newMaps[slot.key]) {
                        if (newMaps[slot.key].dispose) newMaps[slot.key].dispose();
                        delete newMaps[slot.key];
                    }
                    return { ...pbrSet, maps: newMaps };
                }),
            }));
            return;
        }

        // CASE: UPLOAD
        console.log(`[Store] Uploading ${files.length} file(s) for slot: ${slot.key}`);

        reduxStore.dispatch(startLoading({
            title: "Applying Texture",
            message: `Processing and loading texture for ${slot.label}...`,
            type: "texture",
            progress: 10
        }));

        try {
            const loadedMaps = await Promise.all(
                files.map(async (file, index) => {
                    try {
                        const texture = await loadTextureFromFile(file, slot.colorSpace);
                        const percent = 10 + Math.round(((index + 1) / files.length) * 80);
                        reduxStore.dispatch(updateProgress(percent));
                        return { file, texture };
                    } catch (err) {
                        console.error(`[Store] Failed to load texture: ${file.name}`, err);
                        return null;
                    }
                })
            ).then(results => results.filter(Boolean));

            if (loadedMaps.length === 0) {
                set({ saveError: "Failed to load image file(s)." });
                reduxStore.dispatch(stopLoading());
                return;
            }

            reduxStore.dispatch(updateProgress(90));

            set((state) => {
                const nextPbrSets = { ...state.pbrSets };
                const meshState = normalizePbrSetState(nextPbrSets[meshId]);
                const targetSetId = setId ?? meshState.activeSetId;
                const setIndex = meshState.sets.findIndex(s => s.id === targetSetId);

                if (setIndex === -1) return {};

                const nextSets = [...meshState.sets];
                const currentSet = { ...nextSets[setIndex] };
                const nextMaps = { ...currentSet.maps };

                // Primary slot update
                if (nextMaps[slot.key]?.dispose) nextMaps[slot.key].dispose();
                nextMaps[slot.key] = loadedMaps[0].texture;

                // Auto-rename set if it's still using a default name
                let nextSetName = currentSet.name;
                if (!pbrSetHasMaps(currentSet) && isDefaultPbrSetName(currentSet.name)) {
                    nextSetName = getPbrSetNameFromFile(loadedMaps[0].file, currentSet.name);
                }

                nextSets[setIndex] = {
                    ...currentSet,
                    name: nextSetName,
                    maps: nextMaps
                };

                console.log(`[Store] Successfully updated ${slot.key} for set ${targetSetId}`);

                return {
                    pbrSets: {
                        ...nextPbrSets,
                        [meshId]: {
                            ...meshState,
                            activeSetId: targetSetId,
                            sets: nextSets
                        }
                    }
                };
            });

            reduxStore.dispatch(updateProgress(100));
            setTimeout(() => {
                reduxStore.dispatch(stopLoading());
            }, 300);
        } catch (globalErr) {
            console.error("[Store] applyMap global error:", globalErr);
            set({ saveError: "An unexpected error occurred during upload." });
            reduxStore.dispatch(stopLoading());
        }
    },

    applyMapToAll: async (setId, slot, filesInput) => {
        const { meshes, selectedMeshId } = get();
        if (!slot || meshes.length === 0) return;

        // Sets have unique IDs per mesh. We must find the index of the set using the source mesh.
        const sourceMeshId = selectedMeshId || meshes[0]?.id;

        const files = Array.from(filesInput ?? []).filter(Boolean);
        let texture = null;

        if (files.length > 0) {
            reduxStore.dispatch(startLoading({
                title: "Applying Texture to All Meshes",
                message: `Loading master texture for ${slot.label}...`,
                type: "texture",
                progress: 20
            }));

            try {
                texture = await loadTextureFromFile(files[0], slot.colorSpace);
                reduxStore.dispatch(updateProgress(50));
            } catch (err) {
                console.error("[Store] applyMapToAll load error:", err);
                set({ saveError: "Failed to load texture for all meshes." });
                reduxStore.dispatch(stopLoading());
                return;
            }
        }

        set((state) => {
            const nextPbrSets = { ...state.pbrSets };
            const sourceMeshState = normalizePbrSetState(nextPbrSets[sourceMeshId]);
            const targetSetId = setId ?? sourceMeshState.activeSetId;
            const selectedIndex = sourceMeshState.sets.findIndex(s => s.id === targetSetId);

            if (selectedIndex === -1) return {};

            const totalMeshes = meshes.length;
            meshes.forEach((m, idx) => {
                const meshState = normalizePbrSetState(nextPbrSets[m.id]);
                // target the same index for this mesh
                const setIndex = selectedIndex < meshState.sets.length ? selectedIndex : meshState.sets.length - 1;
                
                if (setIndex >= 0) {
                    const nextSets = [...meshState.sets];
                    const currentSet = { ...nextSets[setIndex] };
                    const nextMaps = { ...currentSet.maps };
                    
                    if (files.length === 0) {
                        // Clear slot
                        if (nextMaps[slot.key]?.dispose) nextMaps[slot.key].dispose();
                        delete nextMaps[slot.key];
                    } else if (texture) {
                        if (nextMaps[slot.key]?.dispose) nextMaps[slot.key].dispose();
                        // Clone the texture so each mesh has its own instance. 
                        // This prevents one mesh's .dispose() from breaking others.
                        const clonedTexture = texture.clone();
                        clonedTexture.needsUpdate = true;
                        nextMaps[slot.key] = clonedTexture;
                    }
                    
                    // Auto-rename set if it's still using a default name
                    let nextSetName = currentSet.name;
                    if (files.length > 0 && !pbrSetHasMaps(currentSet) && isDefaultPbrSetName(currentSet.name)) {
                        nextSetName = getPbrSetNameFromFile(files[0], currentSet.name);
                    }

                    nextSets[setIndex] = { ...currentSet, name: nextSetName, maps: nextMaps };
                    nextPbrSets[m.id] = { ...meshState, sets: nextSets };
                }

                const percent = 50 + Math.round(((idx + 1) / totalMeshes) * 45);
                reduxStore.dispatch(updateProgress(percent));
            });

            return { pbrSets: nextPbrSets };
        });

        reduxStore.dispatch(updateProgress(100));
        setTimeout(() => {
            reduxStore.dispatch(stopLoading());
        }, 300);
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
    saveConfig: async ({ productId, productName, variantName } = {}) => {
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

        reduxStore.dispatch(startLoading({
            title: "Saving Configuration",
            message: "Initializing save operation...",
            type: "save",
            progress: 5
        }));

        try {
            const fd = new FormData();
            fd.append("glb_file", glbFile);

            // Backend uses product_id (update) OR product_name (create) to decide
            if (productId) fd.append("product_id", productId);
            if (isCreate && productName) fd.append("product_name", productName.trim());

            // Variant name — optional override for the variant naming
            if (variantName) fd.append("variant_name", variantName);

            // Build mesh + PBR texture entries
            const blobPromises = [];
            const totalMeshes = meshes.length;

            meshes.forEach((mesh, meshIdx) => {
                fd.append(`meshes[${meshIdx}][name]`, mesh.label ?? mesh.id);

                const meshState = normalizePbrSetState(pbrSets[mesh.id]);
                meshState.sets.forEach((pbrSet, setIdx) => {
                    const prefix = `meshes[${meshIdx}][sets][${setIdx}]`;
                    fd.append(`${prefix}[name]`, pbrSet.name ?? `Set ${setIdx + 1}`);
                    fd.append(`${prefix}[textureRepeat]`, pbrSet.settings?.textureRepeat ?? 1);
                    fd.append(`${prefix}[normalIntensity]`, pbrSet.settings?.normalIntensity ?? 1);
                    fd.append(`${prefix}[transmission]`, pbrSet.settings?.transmission ?? 0);
                    fd.append(`${prefix}[opacity]`, pbrSet.settings?.opacity ?? 1);

                    PBR_SLOTS.forEach((slot) => {
                        const tex = pbrSet.maps?.[slot.key];
                        if (tex?.image) {
                            const canvas = document.createElement("canvas");
                            canvas.width = tex.image.width || 512;
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
            reduxStore.dispatch(updateMessage("Converting textures to PNG format..."));
            reduxStore.dispatch(updateProgress(30));

            await Promise.all(blobPromises);

            reduxStore.dispatch(updateMessage("Uploading files and saving to database..."));
            reduxStore.dispatch(updateProgress(60));

            // Single endpoint handles create AND update
            const response = await saveProductConfig(fd);

            // If this was a first-time create, store the returned product_id
            if (isCreate) {
                const newId = response?.data?.product_id ?? response?.data?.product?.id ?? null;
                if (newId) set({ createdProductId: newId });
            }

            set({ isSaving: false, saveSuccess: true, saveError: null });

            reduxStore.dispatch(updateMessage("Saved successfully!"));
            reduxStore.dispatch(updateProgress(100));
            setTimeout(() => {
                reduxStore.dispatch(stopLoading());
            }, 600);

            setTimeout(() => set({ saveSuccess: false }), 3000);
        } catch (err) {
            const msg = err?.response?.data?.message ?? err?.message ?? "Save failed.";
            set({ isSaving: false, saveError: msg, saveSuccess: false });
            reduxStore.dispatch(stopLoading());
        }
    },
}));