import React, { useEffect, useState } from "react";
import { Stage, Layer, Image as KImage, Transformer, Group } from "react-konva";
import { useSelector, useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";
import StickersGroup from "./StickersGroup";
import TextGroup from "./TextGroup";
import ZonesGroup from "./ZonesGroup";
import useStageEvents from "./useStageEvents";

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

    const {
        onStageMouseDown, onStageMouseMove, onStageMouseUp, onStageClick, onStageDblClick
    } = useStageEvents({
        meshName, dispatch, zoneMode, drawingRect, polyPoints, zones, uiScale, setSelectedNodes, triggerExport
    });

    const TEXTURE_SIZE = 2048;
    const customPixelRatio = TEXTURE_SIZE / displayW;
    const anchorSize = Math.max(4, Math.round(6 / uiScale));
    const borderStrokeWidth = Math.max(0.5, 1 / uiScale);
    const anchorStrokeWidth = Math.max(0.5, 1 / uiScale);
    const rotateAnchorOffset = Math.round(15 / uiScale);
    const anchorCornerRadius = Math.max(1, Math.round(2 / uiScale));

    return (
        <Stage
            width={displayW} height={displayH} scaleX={uiScale} scaleY={uiScale} pixelRatio={customPixelRatio} ref={stageRef}
            style={{ cursor: zoneMode ? (zoneMode === 'rect' ? 'crosshair' : 'cell') : 'default' }}
            onMouseDown={onStageMouseDown} onMouseMove={onStageMouseMove} onMouseUp={onStageMouseUp} onClick={onStageClick}
            onDblClick={onStageDblClick}
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
                    ref={trRef} nodes={selectedNodes} borderStroke="#4f46e5" anchorStroke="#4f46e5" anchorFill="#ffffff"
                    anchorSize={anchorSize} anchorStrokeWidth={anchorStrokeWidth} anchorCornerRadius={anchorCornerRadius}
                    borderStrokeWidth={borderStrokeWidth} keepRatio={true} rotateEnabled={true} rotateAnchorOffset={rotateAnchorOffset}
                    rotateAnchorSize={anchorSize} rotateAnchorStroke="#4f46e5" rotateAnchorStrokeWidth={anchorStrokeWidth} rotateAnchorFill="#ffffff"
                    rotationSnaps={[0, 90, 180, 270]}
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
