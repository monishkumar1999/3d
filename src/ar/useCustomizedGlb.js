/**
 * useCustomizedGlb.js
 *
 * React hook that exports the current customized Three.js scene to a binary GLB.
 * Returns a browser-local Blob/Object URL safe to pass directly to <model-viewer src>.
 *
 * Lifecycle:
 *   - Exports lazily when triggerExport() is called
 *   - Revokes previous Blob URL before creating a new one
 *   - Revokes on unmount
 *   - Does NOT re-export if modelProps reference has not changed since last export
 */

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * @param {Object} options
 * @param {React.ComponentType} options.modelComponent  DynamicModel component
 * @param {Object}              options.modelProps       Props passed to DynamicModel
 * @param {string|null}         options.fallbackGlbUrl  Base GLB URL to use while exporting or on failure
 * @returns {{ customGlbUrl: string|null, isExporting: boolean, exportError: string|null, triggerExport: Function }}
 */
export function useCustomizedGlb({ modelComponent, modelProps, fallbackGlbUrl }) {
    const [customGlbUrl, setCustomGlbUrl] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState(null);

    // Track the last modelProps reference exported — avoid re-exporting unchanged state
    const lastExportedPropsRef = useRef(null);
    // Current blob URL — keep a ref so we can revoke after unmount
    const blobUrlRef = useRef(null);
    // Guard against double-export
    const exportingRef = useRef(false);

    /** Cleanly revoke blob URL if it exists */
    const revokePrevious = useCallback(() => {
        if (blobUrlRef.current) {
            try { URL.revokeObjectURL(blobUrlRef.current); } catch (_) { }
            blobUrlRef.current = null;
        }
    }, []);

    // Revoke on unmount
    useEffect(() => {
        return () => { revokePrevious(); };
    }, [revokePrevious]);

    /**
     * triggerExport — called by ARViewerModal when user opens AR.
     *
     * Loads the base GLB, applies all user customizations (colors, PBR,
     * canvas textures, sticker overlays) directly via headless Three.js,
     * then uses GLTFExporter to produce a self-contained binary .glb Blob.
     */
    const triggerExport = useCallback(async () => {
        if (!modelComponent || !modelProps) return;
        if (exportingRef.current) return;

        // Reuse cached URL if modelProps reference unchanged
        if (lastExportedPropsRef.current === modelProps && blobUrlRef.current) {
            return;
        }

        exportingRef.current = true;
        setIsExporting(true);
        setExportError(null);

        try {
            const arrayBuffer = await exportSceneToGlb(modelProps);
            revokePrevious();
            const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            lastExportedPropsRef.current = modelProps;
            setCustomGlbUrl(url);
        } catch (err) {
            console.error("[useCustomizedGlb] GLB export failed:", err);
            setExportError("Failed to prepare AR model. " + (err?.message || "Unknown error."));
        } finally {
            setIsExporting(false);
            exportingRef.current = false;
        }
    }, [modelComponent, modelProps, revokePrevious]);

    return { customGlbUrl, isExporting, exportError, triggerExport };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: headless Three.js GLB builder
// Loads base GLB → applies all customizations → exports binary .glb
// This avoids the R3F Canvas + blind timeout race condition entirely.
// ─────────────────────────────────────────────────────────────────────────────

async function exportSceneToGlb(modelProps) {
    const THREE = await import("three");
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter");

    const {
        url,
        meshColors = {},
        meshMaterials = {},
        meshTextures = {},
        baseTextures = {},
        pbrTextures,
        materialProps,
        globalMaterial,
    } = modelProps;

    if (!url) throw new Error("No GLB URL in modelProps");

    // ── 1. Load the base GLB ─────────────────────────────────────────────────
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });

    const scene = gltf.scene;

    // ── 2. Apply all user customizations directly ────────────────────────────
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";

    const stickerTag = "__stickerOverlay__";

    scene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.userData[stickerTag]) return; // skip sticker overlays

        const meshName = child.name;
        const meshMat = meshMaterials[meshName] || {};
        const gMat = globalMaterial || {};

        // ── Build a MeshStandardMaterial (GLTF-compatible) ──────────────────
        const orig = Array.isArray(child.material) ? child.material[0] : child.material;
        const mat = new THREE.MeshStandardMaterial();

        // Copy original base properties
        if (orig?.color) mat.color.copy(orig.color);
        if (orig?.map) mat.map = orig.map;
        if (orig?.normalMap) mat.normalMap = orig.normalMap;
        if (orig?.roughnessMap) mat.roughnessMap = orig.roughnessMap;
        if (orig?.metalnessMap) mat.metalnessMap = orig.metalnessMap;
        if (orig?.aoMap) mat.aoMap = orig.aoMap;
        mat.roughness = orig?.roughness ?? 0.5;
        mat.metalness = orig?.metalness ?? 0;
        mat.transparent = orig?.transparent ?? false;
        mat.opacity = orig?.opacity ?? 1;

        // ── PBR overrides from editor ────────────────────────────────────────
        if (meshMat.roughness !== undefined) mat.roughness = Number(meshMat.roughness);
        else if (gMat.roughness !== undefined) mat.roughness = Number(gMat.roughness);

        if (meshMat.metalness !== undefined) mat.metalness = Number(meshMat.metalness);
        else if (gMat.metalness !== undefined) mat.metalness = Number(gMat.metalness);

        if (meshMat.opacity !== undefined) {
            mat.opacity = Number(meshMat.opacity);
            if (mat.opacity < 1) mat.transparent = true;
        }

        // ── Mesh / global color ──────────────────────────────────────────────
        if (meshColors[meshName]) {
            mat.color.set(meshColors[meshName]);
        } else if (materialProps?.color) {
            mat.color.set(materialProps.color);
        }

        // ── Base texture variant ─────────────────────────────────────────────
        const bTexEntry = baseTextures[meshName];
        if (bTexEntry) {
            if (bTexEntry.map) mat.map = bTexEntry.map;
            if (bTexEntry.normalMap) mat.normalMap = bTexEntry.normalMap;
            if (bTexEntry.roughnessMap) { mat.roughnessMap = bTexEntry.roughnessMap; mat.roughness = 1; }
            if (bTexEntry.metalnessMap) { mat.metalnessMap = bTexEntry.metalnessMap; mat.metalness = 1; }
            if (bTexEntry.aoMap) mat.aoMap = bTexEntry.aoMap;
        }

        // ── Canvas UV / sticker composited texture ───────────────────────────
        // meshTextures[meshName] is a THREE.CanvasTexture whose .image is an HTMLCanvasElement
        const canvasTex = meshTextures[meshName];
        if (canvasTex) {
            const srcCanvas = canvasTex.image ?? canvasTex.source?.data;
            if (srcCanvas && typeof srcCanvas.toDataURL === "function") {
                const newTex = new THREE.CanvasTexture(srcCanvas);
                newTex.flipY = canvasTex.flipY ?? true;
                newTex.colorSpace = canvasTex.colorSpace ?? THREE.SRGBColorSpace;
                newTex.needsUpdate = true;
                mat.map = newTex;
            } else {
                // Already a usable texture object
                mat.map = canvasTex;
                if (mat.map) mat.map.needsUpdate = true;
            }
        }

        mat.needsUpdate = true;
        child.material = mat;
    });

    // ── 3. Export to binary GLB ──────────────────────────────────────────────
    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
        exporter.parse(
            scene,
            (result) => {
                if (result instanceof ArrayBuffer) {
                    resolve(result);
                } else {
                    // Fallback: JSON mode — wrap as text
                    const bytes = new TextEncoder().encode(JSON.stringify(result));
                    resolve(bytes.buffer);
                }
            },
            (error) => reject(error),
            {
                binary: true,          // single .glb bundle
                embedImages: true,     // all textures embedded in binary
                forceIndices: false,
                includeCustomExtensions: false,
            }
        );
    });
}
