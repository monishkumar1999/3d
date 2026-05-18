import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isLoading: false,
  title: 'Loading',
  message: 'Please wait...',
  progress: null, // null for indeterminate, or 0-100 for determinate loading
  type: 'default', // 'default' | 'texture' | 'model' | 'save' | 'process'
};

const loaderSlice = createSlice({
  name: 'loader',
  initialState,
  reducers: {
    startLoading: (state, action) => {
      state.isLoading = true;
      state.title = action.payload?.title || 'Loading';
      state.message = action.payload?.message || 'Please wait while we process your request...';
      state.progress = action.payload?.progress !== undefined ? action.payload.progress : null;
      state.type = action.payload?.type || 'default';
    },
    updateProgress: (state, action) => {
      state.progress = action.payload;
    },
    updateMessage: (state, action) => {
      state.message = action.payload;
    },
    stopLoading: (state) => {
      state.isLoading = false;
      state.title = 'Loading';
      state.message = 'Please wait...';
      state.progress = null;
      state.type = 'default';
    },
  },
});

export const { startLoading, updateProgress, updateMessage, stopLoading } = loaderSlice.actions;

export const selectLoaderState = (state) => state.loader;

export default loaderSlice.reducer;
