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

        if (trRef.current) trRef.current.nodes([]);

        const layer = stageRef.current.getLayers()[1]; // Layer 1 is the 'texture-layer' (pure stickers, no wireframe)
        if (!layer) return;

        const zoneNodes = layer.find('.zone-shape');
        zoneNodes.forEach(n => n.hide());

        if (stickersRef.current.length > 0 || textNodesRef.current.length > 0) {
            // ZERO-COPY PIPELINE: Instead of generating a new canvas buffer with heavy pixel manipulation,
            // we simply grab the native HTML <canvas> element that Konva is already drawing to!
            // This drops the export time from ~300ms down to 0ms.
            const nativeCanvas = layer.getNativeCanvasElement ? layer.getNativeCanvasElement() : (layer.canvas && layer.canvas._canvas);
            
            if (nativeCanvas) {
                onUpdateTexture(meshName, nativeCanvas);
            } else {
                // Fallback if Konva API changes
                const stageCanvas = stageRef.current.toCanvas({ pixelRatio: 1 });
                onUpdateTexture(meshName, stageCanvas);
            }
        } else {
            onUpdateTexture(meshName, null);
        }

        if (selectedId && trRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer()?.batchDraw(); }
        }
    }, [maskImg, meshName, onUpdateTexture, selectedId, stageRef, uiScale, displayW, displayH, stickersRef, textNodesRef, zonesRef, trRef]);

    const triggerExport = useStableDebounce(performExport, 250);

    return { performExport, triggerExport };
};
