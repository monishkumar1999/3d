import { configureStore } from '@reduxjs/toolkit';
import loaderReducer from './loaderSlice';

export const store = configureStore({
  reducer: {
    loader: loaderReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Turn off serializable check if we want to store non-serializable objects or prevent warning noise
    }),
});

export default store;
