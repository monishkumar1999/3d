import React from "react";
import { Image as KImage } from "react-konva";
import { useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

export const StickersGroup = ({ meshName, stickers, zoneMode, setSelectedNodes, triggerExport }) => {
    const dispatch = useDispatch();

    return (
        <>
            {stickers.map(s => (
                <KImage
                    key={s.id}
                    id={s.id}
                    image={s.image}
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    opacity={s.opacity ?? 1}
                    rotation={s.rotation}
                    draggable={!zoneMode}
                    listening={!zoneMode}
                    imageSmoothingEnabled={true}
                    onClick={(e) => {
                        e.cancelBubble = true;
                        dispatch(updatePatternState({ meshName, updates: { selectedId: s.id } }));
                        setSelectedNodes([e.target]);
                    }}
                    onTap={(e) => {
                        e.cancelBubble = true;
                        dispatch(updatePatternState({ meshName, updates: { selectedId: s.id } }));
                        setSelectedNodes([e.target]);
                    }}
                    onDragEnd={(e) => {
                        const nextStickers = stickers.map(st =>
                            st.id === s.id ? { ...st, x: e.target.x(), y: e.target.y() } : st
                        );
                        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
                        triggerExport();
                    }}
                    onTransformEnd={(e) => {
                        const n = e.target;
                        const newW = Math.max(20, n.width() * n.scaleX());
                        const newH = Math.max(20, n.height() * n.scaleY());
                        n.scaleX(1);
                        n.scaleY(1);
                        const nextStickers = stickers.map(st =>
                            st.id === s.id ? { ...st, x: n.x(), y: n.y(), width: newW, height: newH, rotation: n.rotation() } : st
                        );
                        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
                        setTimeout(() => triggerExport(), 50);
                    }}
                />
            ))}
        </>
    );
};

export default StickersGroup;
