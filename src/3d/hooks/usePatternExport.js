import { useCallback, useRef } from "react";
import useStore from "../../store/useStore";

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
    stickersRef, textNodesRef, zonesRef, meshName, onUpdateTexture, trRef
}) => {
    const EXPORT_SIZE = 2048;

    const performExport = useCallback(async () => {
        if (!stageRef.current || !maskImg) return;

        // Read selectedId directly from the store — never stale
        const currentSelectedId = useStore.getState().patternStates[meshName]?.selectedId;

        // Step 1: Hide transformer so it doesn't bake into the texture
        if (trRef.current) trRef.current.nodes([]);

        const textureLayer = stageRef.current.getLayers()[1];
        if (!textureLayer) return;

        const hasContent = stickersRef.current.length > 0 || textNodesRef.current.length > 0;

        if (!hasContent) {
            onUpdateTexture(meshName, null);
        } else {
            // Redraw layer with transformer hidden
            textureLayer.batchDraw();

            const exportPixelRatio = EXPORT_SIZE / displayW;

            const exportCanvas = textureLayer.toCanvas({
                pixelRatio: exportPixelRatio,
                imageSmoothingEnabled: true,
            });

            onUpdateTexture(meshName, exportCanvas);
        }

        // Step 2: Restore transformer on the selected node
        if (currentSelectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + currentSelectedId);
            if (node) {
                trRef.current.nodes([node]);
                trRef.current.getLayer()?.batchDraw();
            }
        }

    }, [maskImg, meshName, onUpdateTexture, stageRef, uiScale, displayW, displayH, stickersRef, textNodesRef, zonesRef, trRef]);

    const triggerExport = useStableDebounce(performExport, 250);

    return { performExport, triggerExport };
};
