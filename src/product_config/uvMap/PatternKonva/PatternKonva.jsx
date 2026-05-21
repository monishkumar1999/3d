import React, { useEffect, useState } from "react";
import { Stage, Layer, Image as KImage, Transformer, Group } from "react-konva";
import { useSelector, useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";
import StickersGroup from "./StickersGroup";
import TextGroup from "./TextGroup";
import ZonesGroup from "./ZonesGroup";

export const PatternKonva = ({
    meshName, displayW, displayH, uiScale, wireframeImg, maskImg, triggerExport, stageRef, trRef
}) => {
    const dispatch = useDispatch();
    const meshState = useSelector(state => state.uvMap.patternStates[meshName]) || {
        stickers: [], textNodes: [], zones: [], zoneMode: null,
        drawingRect: null, polyPoints: [], cursorPos: null, selectedZoneId: null, selectedId: null
    };

    const {
        stickers, textNodes, zones, zoneMode, drawingRect, polyPoints, cursorPos, selectedZoneId, selectedId
    } = meshState;

    const [selectedNodes, setSelectedNodes] = useState([]);

    useEffect(() => {
        if (!stageRef.current) return;
        const animFrame = requestAnimationFrame(() => {
            if (!stageRef.current) return;
            if (!zoneMode && selectedId) {
                const node = stageRef.current.findOne('#' + selectedId);
                setSelectedNodes(node ? [node] : []);
            } else {
                setSelectedNodes([]);
            }
        });
        return () => cancelAnimationFrame(animFrame);
    }, [selectedId, stickers, textNodes, zoneMode, stageRef]);

    const TEXTURE_SIZE = 2048;
    const customPixelRatio = TEXTURE_SIZE / displayW;
    const anchorSize = Math.max(8, Math.round(12 / uiScale));

    const onStageMouseDown = (e) => {
        if (zoneMode === 'rect') {
            const rawPos = e.target.getStage().getPointerPosition();
            const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
            dispatch(updatePatternState({ meshName, updates: { drawingRect: { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y } } }));
            return;
        }
        if (!zoneMode && e.target === e.target.getStage()) {
            dispatch(updatePatternState({ meshName, updates: { selectedId: null } }));
            setSelectedNodes([]);
        }
    };

    const onStageMouseMove = (e) => {
        const rawPos = e.target.getStage().getPointerPosition();
        if (!rawPos) return;
        const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
        if (zoneMode === 'rect' && drawingRect) {
            dispatch(updatePatternState({ meshName, updates: { drawingRect: { ...drawingRect, x1: pos.x, y1: pos.y } } }));
        }
        if (zoneMode === 'poly') {
            dispatch(updatePatternState({ meshName, updates: { cursorPos: pos } }));
        }
    };

    const onStageMouseUp = (e) => {
        if (zoneMode === 'rect' && drawingRect) {
            const x = Math.min(drawingRect.x0, drawingRect.x1);
            const y = Math.min(drawingRect.y0, drawingRect.y1);
            const w = Math.abs(drawingRect.x1 - drawingRect.x0);
            const h = Math.abs(drawingRect.y1 - drawingRect.y0);
            if (w > 10 && h > 10) {
                dispatch(updatePatternState({ meshName, updates: { zones: [...zones, { id: 'z_' + Date.now(), type: 'rect', x, y, w, h }] } }));
            }
            dispatch(updatePatternState({ meshName, updates: { drawingRect: null } }));
            return;
        }
        if (!zoneMode) triggerExport();
    };

    const onStageClick = (e) => {
        if (zoneMode !== 'poly') return;
        const rawPos = e.target.getStage().getPointerPosition();
        if (!rawPos) return;
        const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
        if (polyPoints.length >= 6) {
            const dx = pos.x - polyPoints[0];
            const dy = pos.y - polyPoints[1];
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
                dispatch(updatePatternState({ meshName, updates: { zones: [...zones, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }], polyPoints: [], cursorPos: null } }));
                return;
            }
        }
        dispatch(updatePatternState({ meshName, updates: { polyPoints: [...polyPoints, pos.x, pos.y] } }));
    };

    return (
        <Stage
            width={displayW} height={displayH} scaleX={uiScale} scaleY={uiScale} pixelRatio={customPixelRatio} ref={stageRef}
            style={{ cursor: zoneMode ? (zoneMode === 'rect' ? 'crosshair' : 'cell') : 'default' }}
            onMouseDown={onStageMouseDown} onMouseMove={onStageMouseMove} onMouseUp={onStageMouseUp} onClick={onStageClick}
            onDblClick={() => {
                if (zoneMode === 'poly' && polyPoints.length >= 6) {
                    dispatch(updatePatternState({ meshName, updates: { zones: [...zones, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }], polyPoints: [], cursorPos: null } }));
                }
            }}
        >
            <Layer name="ui-background">
                {wireframeImg && <KImage name="wireframe" image={wireframeImg} width={wireframeImg.naturalWidth} height={wireframeImg.naturalHeight} listening={false} opacity={0.8} />}
            </Layer>

            <Layer name="texture-layer">
                <Group clipFunc={(ctx) => {
                    if (zones.length === 0) { ctx.rect(0, 0, maskImg.naturalWidth, maskImg.naturalHeight); return; }
                    zones.forEach(zone => {
                        if (zone.type === 'rect') ctx.rect(zone.x, zone.y, zone.w, zone.h);
                        else if (zone.type === 'poly' && zone.points.length >= 6) {
                            ctx.moveTo(zone.points[0], zone.points[1]);
                            for (let i = 2; i < zone.points.length; i += 2) ctx.lineTo(zone.points[i], zone.points[i + 1]);
                            ctx.closePath();
                        }
                    });
                }}>
                    <StickersGroup meshName={meshName} stickers={stickers} zoneMode={zoneMode} setSelectedNodes={setSelectedNodes} triggerExport={triggerExport} />
                    <TextGroup meshName={meshName} textNodes={textNodes} zoneMode={zoneMode} setSelectedNodes={setSelectedNodes} triggerExport={triggerExport} />
                </Group>

                <Transformer
                    ref={trRef} nodes={selectedNodes} borderStroke="#4f46e5" anchorStroke="#4f46e5" anchorFill="#ffffff" anchorSize={anchorSize} anchorCornerRadius={3}
                    borderDash={[4 / uiScale, 4 / uiScale]} borderStrokeWidth={2 / uiScale} keepRatio={true} rotateEnabled={true} rotateAnchorOffset={30 / uiScale}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} boundBoxFunc={(oldBox, newBox) => newBox.width < 20 || newBox.height < 20 ? oldBox : newBox}
                />
            </Layer>

            <Layer name="ui-foreground">
                <ZonesGroup meshName={meshName} zones={zones} selectedZoneId={selectedZoneId} zoneMode={zoneMode} drawingRect={drawingRect} polyPoints={polyPoints} cursorPos={cursorPos} stickers={stickers} textNodes={textNodes} />
            </Layer>
        </Stage>
    );
};

export default PatternKonva;
