import React from "react";
import { Rect, Line, Group, Image as KImage, Text } from "react-konva";
import { useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

export const ZonesGroup = ({
    meshName, zones, selectedZoneId, zoneMode, drawingRect, polyPoints, cursorPos, stickers, textNodes
}) => {
    const dispatch = useDispatch();

    return (
        <>
            {zones.map(zone => (
                zone.type === 'rect' ? (
                    <Rect
                        key={zone.id}
                        name="zone-shape"
                        x={zone.x}
                        y={zone.y}
                        width={zone.w}
                        height={zone.h}
                        fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                        stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'}
                        strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                        dash={selectedZoneId === zone.id ? [] : [10, 5]}
                        listening={!!zoneMode}
                        onClick={() => {
                            const nextId = selectedZoneId === zone.id ? null : zone.id;
                            dispatch(updatePatternState({ meshName, updates: { selectedZoneId: nextId } }));
                        }}
                    />
                ) : (
                    <Line
                        key={zone.id}
                        name="zone-shape"
                        points={zone.points}
                        closed
                        fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                        stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'}
                        strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                        dash={selectedZoneId === zone.id ? [] : [10, 5]}
                        listening={!!zoneMode}
                        onClick={() => {
                            const nextId = selectedZoneId === zone.id ? null : zone.id;
                            dispatch(updatePatternState({ meshName, updates: { selectedZoneId: nextId } }));
                        }}
                    />
                )
            ))}

            {zoneMode === 'rect' && drawingRect && (() => {
                const x = Math.min(drawingRect.x0, drawingRect.x1);
                const y = Math.min(drawingRect.y0, drawingRect.y1);
                const w = Math.abs(drawingRect.x1 - drawingRect.x0);
                const h = Math.abs(drawingRect.y1 - drawingRect.y0);
                return <Rect name="zone-shape" x={x} y={y} width={w} height={h} fill="rgba(79,70,229,0.1)" stroke="#4f46e5" strokeWidth={5} dash={[16, 8]} listening={false} />;
            })()}

            {zoneMode === 'poly' && polyPoints.length >= 2 && (
                <>
                    <Line
                        name="zone-shape"
                        points={[...polyPoints, ...(cursorPos ? [cursorPos.x, cursorPos.y] : [])]}
                        stroke="#4f46e5"
                        strokeWidth={4}
                        dash={[12, 6]}
                        fill="rgba(79,70,229,0.1)"
                        closed={false}
                        listening={false}
                    />
                    {polyPoints.length >= 6 && (
                        <Rect name="zone-shape" x={polyPoints[0] - 10} y={polyPoints[1] - 10} width={20} height={20} fill="rgba(79,70,229,0.4)" stroke="#4f46e5" strokeWidth={3} cornerRadius={10} listening={false} />
                    )}
                </>
            )}

            <Group opacity={0.12}>
                {stickers.map(s => <KImage key={s.id + '_dull'} image={s.image} x={s.x} y={s.y} width={s.width} height={s.height} rotation={s.rotation} listening={false} />)}
                {textNodes.map(t => <Text key={t.id + '_dull'} text={t.text} x={t.x} y={t.y} fontSize={t.fontSize} fill={t.fill} fontFamily={t.fontFamily} rotation={t.rotation} fontStyle="bold" listening={false} />)}
            </Group>
        </>
    );
};

export default ZonesGroup;
