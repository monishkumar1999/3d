import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite config for building the SDK in library mode
// Usage: npm run build:sdk
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "sdk-dist",
        emptyOutDir: true,
        lib: {
            entry: path.resolve(__dirname, "src/sdkComponent/sdk.jsx"),
            name: "ProductConfigListSDK", // Global variable: window.ProductConfigListSDK
            fileName: "product-config-list-sdk",
            formats: ["umd"],
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
});
