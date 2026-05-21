import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Transformer, Rect, Line, Text, Group } from "react-konva";
import useStore from "../../store/useStore";

export const PatternKonva = ({
    meshName, displayW, displayH, uiScale,
    wireframeImg, maskImg, triggerExport,
    stageRef, trRef
}) => {
    const updatePatternState = useStore(state => state.updatePatternState);
    const meshState = useStore(state => state.patternStates[meshName]) || {
        stickers: [], textNodes: [], zones: [], zoneMode: null,
        drawingRect: null, polyPoints: [], cursorPos: null, selectedZoneId: null, selectedId: null
    };

    const {
        stickers, textNodes, zones, zoneMode,
        drawingRect, polyPoints, cursorPos, selectedZoneId, selectedId
    } = meshState;

    const [selectedNodes, setSelectedNodes] = useState([]);

    useEffect(() => {
        if (!stageRef.current) return;
        const animFrame = requestAnimationFrame(() => {
            if (!stageRef.current) return;
            if (!zoneMode && selectedId) {
                const node = stageRef.current.findOne('#' + selectedId);
                if (node) {
                    setSelectedNodes([node]);
                } else {
                    setSelectedNodes([]);
                }
            } else {
                setSelectedNodes([]);
            }
        });
        return () => cancelAnimationFrame(animFrame);
    }, [selectedId, stickers, textNodes, zoneMode, stageRef]);

    // --- QUALITY STRATEGY ---
    // The Konva Stage is displayed at displayW × displayH (~450px) for UI purposes,
    // but internally it coordinates in maskImg.naturalWidth × naturalHeight units (via scaleX/Y = uiScale).
    //
    // For the 3D texture we need at least 2048px output. The pixelRatio here controls the
    // internal canvas backing resolution:
    //   internal canvas width = displayW × pixelRatio
    //
    // We want the internal canvas to be exactly 2048px (good quality, not overkill).
    // A sticker at 50% of the mask width will occupy ~1024px of this → plenty for a chest logo.
    const TEXTURE_SIZE = 2048;
    const customPixelRatio = TEXTURE_SIZE / displayW;

    // Anchor size adapted so handles are comfortably clickable at any uiScale
    const anchorSize = Math.max(8, Math.round(12 / uiScale));

    return (
        <Stage
            width={displayW} height={displayH}
            scaleX={uiScale} scaleY={uiScale}
            pixelRatio={customPixelRatio}
            ref={stageRef}
            style={{ cursor: zoneMode ? (zoneMode === 'rect' ? 'crosshair' : 'cell') : 'default' }}
            onMouseDown={(e) => {
                if (zoneMode === 'rect') {
                    const rawPos = e.target.getStage().getPointerPosition();
                    const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
                    updatePatternState(meshName, { drawingRect: { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y } });
                    return;
                }
                if (!zoneMode && e.target === e.target.getStage()) {
                    updatePatternState(meshName, { selectedId: null });
                    setSelectedNodes([]);
                }
            }}
            onMouseMove={(e) => {
                const rawPos = e.target.getStage().getPointerPosition();
                if (!rawPos) return;
                const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
                if (zoneMode === 'rect' && drawingRect) {
                    updatePatternState(meshName, prev => ({ drawingRect: { ...prev.drawingRect, x1: pos.x, y1: pos.y } }));
                }
                if (zoneMode === 'poly') {
                    updatePatternState(meshName, { cursorPos: pos });
                }
            }}
            onMouseUp={(e) => {
                if (zoneMode === 'rect' && drawingRect) {
                    const x = Math.min(drawingRect.x0, drawingRect.x1);
                    const y = Math.min(drawingRect.y0, drawingRect.y1);
                    const w = Math.abs(drawingRect.x1 - drawingRect.x0);
                    const h = Math.abs(drawingRect.y1 - drawingRect.y0);
                    if (w > 10 && h > 10) {
                        updatePatternState(meshName, prev => ({
                            zones: [...prev.zones, { id: 'z_' + Date.now(), type: 'rect', x, y, w, h }]
                        }));
                    }
                    updatePatternState(meshName, { drawingRect: null });
                    return;
                }
                if (!zoneMode) triggerExport();
            }}
            onClick={(e) => {
                if (zoneMode !== 'poly') return;
                const rawPos = e.target.getStage().getPointerPosition();
                if (!rawPos) return;
                const pos = { x: rawPos.x / uiScale, y: rawPos.y / uiScale };
                if (polyPoints.length >= 6) {
                    const dx = pos.x - polyPoints[0];
                    const dy = pos.y - polyPoints[1];
                    if (Math.sqrt(dx * dx + dy * dy) < 20) {
                        updatePatternState(meshName, prev => ({
                            zones: [...prev.zones, { id: 'z_' + Date.now(), type: 'poly', points: [...prev.polyPoints] }],
                            polyPoints: [],
                            cursorPos: null
                        }));
                        return;
                    }
                }
                updatePatternState(meshName, prev => ({ polyPoints: [...prev.polyPoints, pos.x, pos.y] }));
            }}
            onDblClick={(e) => {
                if (zoneMode !== 'poly' || polyPoints.length < 6) return;
                updatePatternState(meshName, prev => ({
                    zones: [...prev.zones, { id: 'z_' + Date.now(), type: 'poly', points: [...prev.polyPoints] }],
                    polyPoints: [],
                    cursorPos: null
                }));
            }}
        >
            {/* Layer 0: Background wireframe only (never exported) */}
            <Layer name="ui-background">
                {wireframeImg && (
                    <KImage name="wireframe" image={wireframeImg} width={wireframeImg.naturalWidth} height={wireframeImg.naturalHeight}
                        listening={false} opacity={0.8} />
                )}
            </Layer>

            {/* Layer 1: Texture layer — stickers + Transformer */}
            <Layer name="texture-layer">
                <Group clipFunc={(ctx) => {
                    if (zones.length === 0) {
                        ctx.rect(0, 0, maskImg.naturalWidth, maskImg.naturalHeight);
                        return;
                    }
                    zones.forEach(zone => {
                        if (zone.type === 'rect') ctx.rect(zone.x, zone.y, zone.w, zone.h);
                        else if (zone.type === 'poly' && zone.points.length >= 6) {
                            ctx.moveTo(zone.points[0], zone.points[1]);
                            for (let i = 2; i < zone.points.length; i += 2) ctx.lineTo(zone.points[i], zone.points[i + 1]);
                            ctx.closePath();
                        }
                    });
                }}>
                    {stickers.map(s => (
                        <KImage key={s.id} id={s.id} image={s.image} x={s.x} y={s.y} width={s.width} height={s.height}
                            opacity={s.opacity ?? 1} rotation={s.rotation} draggable={!zoneMode} listening={!zoneMode}
                            imageSmoothingEnabled={true}
                            onClick={(e) => {
                                e.cancelBubble = true;
                                updatePatternState(meshName, { selectedId: s.id });
                                setSelectedNodes([e.target]);
                            }}
                            onTap={(e) => {
                                e.cancelBubble = true;
                                updatePatternState(meshName, { selectedId: s.id });
                                setSelectedNodes([e.target]);
                            }}
                            onDragEnd={(e) => {
                                updatePatternState(meshName, prev => ({ stickers: prev.stickers.map(st => st.id === s.id ? { ...st, x: e.target.x(), y: e.target.y() } : st) }));
                                triggerExport();
                            }}
                            onTransformEnd={(e) => {
                                const n = e.target;
                                const newW = Math.max(20, n.width() * n.scaleX());
                                const newH = Math.max(20, n.height() * n.scaleY());
                                n.scaleX(1); n.scaleY(1);
                                updatePatternState(meshName, prev => ({ stickers: prev.stickers.map(st => st.id === s.id ? { ...st, x: n.x(), y: n.y(), width: newW, height: newH, rotation: n.rotation() } : st) }));
                                setTimeout(() => triggerExport(), 50);
                            }}
                        />
                    ))}
                    {textNodes.map(t => (
                        <Text key={t.id} id={t.id} text={t.text} x={t.x} y={t.y} fontSize={t.fontSize} fill={t.fill}
                            fontFamily={t.fontFamily} opacity={t.opacity ?? 1} rotation={t.rotation} draggable={!zoneMode} listening={!zoneMode} fontStyle="bold"
                            onClick={(e) => {
                                e.cancelBubble = true;
                                updatePatternState(meshName, { selectedId: t.id });
                                setSelectedNodes([e.target]);
                            }}
                            onTap={(e) => {
                                e.cancelBubble = true;
                                updatePatternState(meshName, { selectedId: t.id });
                                setSelectedNodes([e.target]);
                            }}
                            onDragEnd={(e) => {
                                updatePatternState(meshName, prev => ({ textNodes: prev.textNodes.map(tn => tn.id === t.id ? { ...tn, x: e.target.x(), y: e.target.y() } : tn) }));
                                triggerExport();
                            }}
                            onTransformEnd={(e) => {
                                const n = e.target;
                                const newSize = n.fontSize() * n.scaleX();
                                n.scaleX(1); n.scaleY(1);
                                updatePatternState(meshName, prev => ({ textNodes: prev.textNodes.map(tn => tn.id === t.id ? { ...tn, x: n.x(), y: n.y(), fontSize: newSize, rotation: n.rotation() } : tn) }));
                                setTimeout(() => triggerExport(), 50);
                            }}
                        />
                    ))}
                </Group>

                {/* Transformer in same layer as stickers for resize to work */}
                <Transformer
                    ref={trRef}
                    nodes={selectedNodes}
                    borderStroke="#4f46e5"
                    anchorStroke="#4f46e5"
                    anchorFill="#ffffff"
                    anchorSize={anchorSize}
                    anchorCornerRadius={3}
                    borderDash={[4 / uiScale, 4 / uiScale]}
                    borderStrokeWidth={2 / uiScale}
                    keepRatio={true}
                    rotateEnabled={true}
                    rotateAnchorOffset={30 / uiScale}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 20 || newBox.height < 20) return oldBox;
                        return newBox;
                    }}
                />
            </Layer>

            {/* Layer 2: Zone overlays + ghost stickers (never exported as texture) */}
            <Layer name="ui-foreground">
                {zones.map(zone => (
                    zone.type === 'rect' ? (
                        <Rect key={zone.id} name="zone-shape" x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                            fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                            stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'} strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                            dash={selectedZoneId === zone.id ? [] : [10, 5]} listening={!!zoneMode}
                            onClick={() => updatePatternState(meshName, prev => ({ selectedZoneId: prev.selectedZoneId === zone.id ? null : zone.id }))} />
                    ) : (
                        <Line key={zone.id} name="zone-shape" points={zone.points} closed
                            fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                            stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'} strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                            dash={selectedZoneId === zone.id ? [] : [10, 5]} listening={!!zoneMode}
                            onClick={() => updatePatternState(meshName, prev => ({ selectedZoneId: prev.selectedZoneId === zone.id ? null : zone.id }))} />
                    )
                ))}

                {zoneMode === 'rect' && drawingRect && (() => {
                    const x = Math.min(drawingRect.x0, drawingRect.x1);
                    const y = Math.min(drawingRect.y0, drawingRect.y1);
                    const w = Math.abs(drawingRect.x1 - drawingRect.x0);
                    const h = Math.abs(drawingRect.y1 - drawingRect.y0);
                    return <Rect name="zone-shape" x={x} y={y} width={w} height={h}
                        fill="rgba(79,70,229,0.1)" stroke="#4f46e5" strokeWidth={5} dash={[16, 8]} listening={false} />;
                })()}

                {zoneMode === 'poly' && polyPoints.length >= 2 && (
                    <>
                        <Line name="zone-shape" points={[...polyPoints, ...(cursorPos ? [cursorPos.x, cursorPos.y] : [])]}
                            stroke="#4f46e5" strokeWidth={4} dash={[12, 6]} fill="rgba(79,70,229,0.1)" closed={false} listening={false} />
                        {polyPoints.length >= 6 && (
                            <Rect name="zone-shape" x={polyPoints[0] - 10} y={polyPoints[1] - 10} width={20} height={20}
                                fill="rgba(79,70,229,0.4)" stroke="#4f46e5" strokeWidth={3} cornerRadius={10} listening={false} />
                        )}
                    </>
                )}

                {/* Ghost overlay for visual reference */}
                <Group opacity={0.12}>
                    {stickers.map(s => <KImage key={s.id + '_dull'} image={s.image} x={s.x} y={s.y} width={s.width} height={s.height} rotation={s.rotation} listening={false} />)}
                    {textNodes.map(t => <Text key={t.id + '_dull'} text={t.text} x={t.x} y={t.y} fontSize={t.fontSize} fill={t.fill} fontFamily={t.fontFamily} rotation={t.rotation} fontStyle="bold" listening={false} />)}
                </Group>
            </Layer>
        </Stage>
    );
};
