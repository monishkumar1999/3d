import { createSlice } from '@reduxjs/toolkit';

const initialPatternState = {
  stickers: [],
  textNodes: [],
  zones: [],
  zoneMode: null,
  drawingRect: null,
  polyPoints: [],
  cursorPos: null,
  selectedZoneId: null,
  selectedId: null,
};

const initialState = {
  phase: 'setup',
  glbUrl: null,
  meshList: [],
  meshTextures: {},
  globalMaterial: { color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false },
  activeStickerUrl: null,
  productName: '',
  subcategory: '',
  patternStates: {},
};

const uvMapSlice = createSlice({
  name: 'uvMap',
  initialState,
  reducers: {
    setPhase: (state, action) => { state.phase = action.payload; },
    setGlbUrl: (state, action) => { state.glbUrl = action.payload; },
    setMeshList: (state, action) => { state.meshList = action.payload; },
    setMeshTextures: (state, action) => { state.meshTextures = action.payload; },
    updateMeshTexture: (state, action) => {
      const { meshName, texture } = action.payload;
      if (!texture) {
        delete state.meshTextures[meshName];
      } else {
        state.meshTextures[meshName] = texture;
      }
    },
    setGlobalMaterial: (state, action) => {
      state.globalMaterial = { ...state.globalMaterial, ...action.payload };
    },
    setActiveStickerUrl: (state, action) => { state.activeStickerUrl = action.payload; },
    setProductName: (state, action) => { state.productName = action.payload; },
    setSubcategory: (state, action) => { state.subcategory = action.payload; },
    initPatternState: (state, action) => {
      const meshName = action.payload;
      if (!state.patternStates[meshName]) {
        state.patternStates[meshName] = { ...initialPatternState };
      }
    },
    updatePatternState: (state, action) => {
      const { meshName, updates } = action.payload;
      if (!state.patternStates[meshName]) {
        state.patternStates[meshName] = { ...initialPatternState };
      }
      state.patternStates[meshName] = {
        ...state.patternStates[meshName],
        ...updates,
      };
    },
    resetProject: () => initialState,
  }
});

export const {
  setPhase, setGlbUrl, setMeshList, setMeshTextures, updateMeshTexture,
  setGlobalMaterial, setActiveStickerUrl, setProductName, setSubcategory,
  initPatternState, updatePatternState, resetProject
} = uvMapSlice.actions;

export default uvMapSlice.reducer;
