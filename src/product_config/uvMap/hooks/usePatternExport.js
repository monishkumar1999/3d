import { useCallback, useRef } from "react";
import store from "../../../store/redux/store";

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

        // Read selectedId from the Redux store
        const currentSelectedId = store.getState().uvMap.patternStates[meshName]?.selectedId;

        // Step 1: Hide transformer so it doesn't bake into the texture
        if (trRef.current) trRef.current.nodes([]);

        const hasContent = stickersRef.current.length > 0 || textNodesRef.current.length > 0;

        if (!hasContent) {
            onUpdateTexture(meshName, null);
        } else {
            // Render directly to an offscreen canvas at the mask's native resolution
            // This bypasses Konva's stage scale and avoids coordinate transform issues
            const natW = maskImg.naturalWidth;
            const natH = maskImg.naturalHeight;
            const scale = EXPORT_SIZE / Math.max(natW, natH);
            const canvasW = Math.round(natW * scale);
            const canvasH = Math.round(natH * scale);

            const offscreen = document.createElement('canvas');
            offscreen.width = canvasW;
            offscreen.height = canvasH;
            const ctx = offscreen.getContext('2d');

            // Apply zone clipping if zones exist
            const currentZones = zonesRef.current;
            if (currentZones && currentZones.length > 0) {
                ctx.beginPath();
                currentZones.forEach(zone => {
                    if (zone.type === 'rect') {
                        ctx.rect(zone.x * scale, zone.y * scale, zone.w * scale, zone.h * scale);
                    } else if (zone.type === 'poly' && zone.points.length >= 6) {
                        ctx.moveTo(zone.points[0] * scale, zone.points[1] * scale);
                        for (let i = 2; i < zone.points.length; i += 2) {
                            ctx.lineTo(zone.points[i] * scale, zone.points[i + 1] * scale);
                        }
                        ctx.closePath();
                    }
                });
                ctx.clip();
            }

            // Draw stickers at their exact internal-coordinate positions
            const stickers = stickersRef.current;
            for (const s of stickers) {
                if (!s.image) continue;
                ctx.save();
                // Translate to sticker center, rotate, then draw centered
                const cx = (s.x + s.width / 2) * scale;
                const cy = (s.y + s.height / 2) * scale;
                ctx.translate(cx, cy);
                if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180);
                ctx.globalAlpha = s.opacity ?? 1;
                ctx.drawImage(
                    s.image,
                    (-s.width / 2) * scale,
                    (-s.height / 2) * scale,
                    s.width * scale,
                    s.height * scale
                );
                ctx.restore();
            }

            // Draw text nodes
            const textNodes = textNodesRef.current;
            for (const t of textNodes) {
                ctx.save();
                const tx = t.x * scale;
                const ty = t.y * scale;
                ctx.translate(tx, ty);
                if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
                ctx.globalAlpha = t.opacity ?? 1;
                ctx.font = `${(t.fontStyle || '')} ${(t.fontWeight || '')} ${(t.fontSize || 80) * scale}px ${t.fontFamily || 'Inter'}`.trim();
                ctx.fillStyle = t.fill || '#ffffff';
                ctx.textBaseline = 'top';
                ctx.fillText(t.text || '', 0, 0);
                ctx.restore();
            }

            onUpdateTexture(meshName, offscreen);
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
