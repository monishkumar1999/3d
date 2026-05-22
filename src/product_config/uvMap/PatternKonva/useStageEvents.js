import { useCallback } from "react";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

export const useStageEvents = ({
    meshName,
    dispatch,
    zoneMode,
    drawingRect,
    polyPoints,
    zones,
    uiScale,
    setSelectedNodes,
    triggerExport
}) => {
    const onStageMouseDown = useCallback((e) => {
        if (zoneMode === 'rect') {
            const rawPos = e.target.getStage().getPointerPosition();
            const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
            dispatch(updatePatternState({
                meshName,
                updates: { drawingRect: { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y } }
            }));
            return;
        }
        if (!zoneMode && e.target === e.target.getStage()) {
            dispatch(updatePatternState({ meshName, updates: { selectedId: null } }));
            setSelectedNodes([]);
        }
    }, [zoneMode, uiScale, dispatch, meshName, setSelectedNodes]);

    const onStageMouseMove = useCallback((e) => {
        const rawPos = e.target.getStage().getPointerPosition();
        if (!rawPos) return;
        const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
        if (zoneMode === 'rect' && drawingRect) {
            dispatch(updatePatternState({
                meshName,
                updates: { drawingRect: { ...drawingRect, x1: pos.x, y1: pos.y } }
            }));
        }
        if (zoneMode === 'poly') {
            dispatch(updatePatternState({ meshName, updates: { cursorPos: pos } }));
        }
    }, [zoneMode, drawingRect, uiScale, dispatch, meshName]);

    const onStageMouseUp = useCallback(() => {
        if (zoneMode === 'rect' && drawingRect) {
            const x = Math.min(drawingRect.x0, drawingRect.x1);
            const y = Math.min(drawingRect.y0, drawingRect.y1);
            const w = Math.abs(drawingRect.x1 - drawingRect.x0);
            const h = Math.abs(drawingRect.y1 - drawingRect.y0);
            if (w > 10 && h > 10) {
                dispatch(updatePatternState({
                    meshName,
                    updates: { zones: [...zones, { id: 'z_' + Date.now(), type: 'rect', x, y, w, h }] }
                }));
            }
            dispatch(updatePatternState({ meshName, updates: { drawingRect: null } }));
            return;
        }
        if (!zoneMode) triggerExport();
    }, [zoneMode, drawingRect, zones, dispatch, meshName, triggerExport]);

    const onStageClick = useCallback((e) => {
        if (zoneMode !== 'poly') return;
        const rawPos = e.target.getStage().getPointerPosition();
        if (!rawPos) return;
        const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
        if (polyPoints.length >= 6) {
            const dx = pos.x - polyPoints[0];
            const dy = pos.y - polyPoints[1];
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
                dispatch(updatePatternState({
                    meshName,
                    updates: {
                        zones: [...zones, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }],
                        polyPoints: [],
                        cursorPos: null
                    }
                }));
                return;
            }
        }
        dispatch(updatePatternState({
            meshName,
            updates: { polyPoints: [...polyPoints, pos.x, pos.y] }
        }));
    }, [zoneMode, polyPoints, zones, uiScale, dispatch, meshName]);

    const onStageDblClick = useCallback(() => {
        if (zoneMode === 'poly' && polyPoints.length >= 6) {
            dispatch(updatePatternState({
                meshName,
                updates: {
                    zones: [...zones, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }],
                    polyPoints: [],
                    cursorPos: null
                }
            }));
        }
    }, [zoneMode, polyPoints, zones, dispatch, meshName]);

    return { onStageMouseDown, onStageMouseMove, onStageMouseUp, onStageClick, onStageDblClick };
};

export default useStageEvents;
