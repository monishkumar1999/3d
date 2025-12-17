import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Phase Management
  phase: 1, // 1: Model, 2: UV, 3: Arrangement, 4: Design
  setPhase: (phase) => set({ phase }),

  // Phase 1: Mesh Data (from GLB)
  glbUrl: null,
  meshes: [], // [{ id, name, materialIndex, uvChannel }]
  globalMaterial: { color: '#ffffff', roughness: 0.5, metalness: 0.0 }, // Added missing state
  setGlbUrl: (url) => set({ glbUrl: url }),
  setMeshes: (meshes) => set({ meshes }),

  // Admin / Material Configuration
  materialSettings: {
    roughness: 0.75,
    metalness: 0.0,
    sheen: 0.6,
    sheenRoughness: 0.7,
  },
  setMaterialSetting: (key, value) =>
    set((state) => ({
      materialSettings: {
        ...state.materialSettings,
        [key]: value
      }
    })),
  saveMaterialConfiguration: () => {
    const settings = get().materialSettings;
    console.log("Saving Configuration:", JSON.stringify(settings, null, 2));
    // In a real app, this would POST to an API
    alert("Configuration Saved! (Check Console)");
  },

  // Phase 2: UV Islands (from SVG)
  uvIslands: [], // [{ id, pathData, meshId, layout: {x,y,scale,rotation} }]
  setUvIslands: (islands) => set({ uvIslands: islands }),
  updateUvLayout: (id, layout) => set(state => ({
    uvIslands: state.uvIslands.map(island =>
      island.id === id ? { ...island, layout: { ...island.layout, ...layout } } : island
    )
  })),
  linkMeshToIsland: (islandId, meshId) => set(state => ({
    uvIslands: state.uvIslands.map(island =>
      island.id === islandId ? { ...island, meshId } : island
    )
  })),
  updateUvIsland: (id, props) => set(state => ({
    uvIslands: state.uvIslands.map(island =>
      island.id === id ? { ...island, ...props } : island
    )
  })),

  // Phase 3 & 4: Shared Atlas State
  atlasCanvas: null, // HTMLCanvasElement
  atlasVersion: 0,
  setAtlasCanvas: (canvas) => set({ atlasCanvas: canvas }),
  notifyAtlasUpdate: () => set(state => ({ atlasVersion: state.atlasVersion + 1 })),

  // Phase 4: Design Elements
  designElements: [], // [{ id, type: 'sticker'|'text', url, text, transform: {...}, uvIslandId }]
  addDesignElement: (el) => set(state => ({ designElements: [...state.designElements, el] })),
  updateDesignElement: (id, props) => set(state => ({
    designElements: state.designElements.map(el =>
      el.id === id ? { ...el, ...props } : el
    )
  })),
  removeDesignElement: (id) => set(state => ({
    designElements: state.designElements.filter(el => el.id !== id)
  })),

  // UI State
  activeStickerUrl: null, // Temp holder for drag-n-drop
  setActiveStickerUrl: (url) => set({ activeStickerUrl: url }),
}));

export default useStore;
