import { useCallback, useRef } from "react";

// Stable debounce that always calls the LATEST version of the callback
function useStableDebounce(fn, delay) {
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const timerRef = useRef(null);
    return useCallback((...args) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            fnRef.current(...args);
        }, delay);
    }, [delay]);
}

export const usePatternExport = ({
    stageRef, maskImg, uiScale, displayW, displayH,
    stickersRef, textNodesRef, zonesRef, meshName, onUpdateTexture, selectedId, trRef
}) => {
    const performExport = useCallback(async () => {
        if (!stageRef.current || !maskImg) return;

        // Step 1: Hide transformer handles so they don't appear on the 3D model
        if (trRef.current) trRef.current.nodes([]);

        const layer = stageRef.current.getLayers()[1]; // Layer 1 = 'texture-layer'
        if (!layer) return;

        // Step 2: Redraw the layer cleanly (no handles, no zone shapes)
        layer.batchDraw();

        if (stickersRef.current.length > 0 || textNodesRef.current.length > 0) {
            // SNAPSHOT APPROACH: Copy the current canvas to a NEW offscreen canvas.
            // This is critical — if we pass the live native canvas directly to THREE.js,
            // Three uploads it to the GPU on the NEXT frame, by which time the transformer
            // handles have already been restored — causing them to appear on the 3D model.
            const nativeCanvas = layer.getNativeCanvasElement
                ? layer.getNativeCanvasElement()
                : (layer.canvas && layer.canvas._canvas);

            if (nativeCanvas) {
                // Create a clean snapshot canvas that won't be mutated after this point
                const snapshot = document.createElement('canvas');
                snapshot.width = nativeCanvas.width;
                snapshot.height = nativeCanvas.height;
                const ctx = snapshot.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(nativeCanvas, 0, 0);
                onUpdateTexture(meshName, snapshot);
            } else {
                // Fallback: Konva's own toCanvas (already a clean copy)
                const exportCanvas = layer.toCanvas({ pixelRatio: 1 });
                onUpdateTexture(meshName, exportCanvas);
            }
        } else {
            onUpdateTexture(meshName, null);
        }

        // Step 3: Restore transformer on the selected node AFTER snapshot is taken
        if (selectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) {
                trRef.current.nodes([node]);
                trRef.current.getLayer()?.batchDraw();
            }
        }

    }, [maskImg, meshName, onUpdateTexture, selectedId, stageRef, uiScale, displayW, displayH, stickersRef, textNodesRef, zonesRef, trRef]);

    const triggerExport = useStableDebounce(performExport, 250);

    return { performExport, triggerExport };
};
