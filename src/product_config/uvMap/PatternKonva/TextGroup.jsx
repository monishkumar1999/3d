import React from "react";
import { Text } from "react-konva";
import { useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

export const TextGroup = ({ meshName, textNodes, zoneMode, setSelectedNodes, triggerExport }) => {
    const dispatch = useDispatch();

    return (
        <>
            {textNodes.map(t => (
                <Text
                    key={t.id}
                    id={t.id}
                    text={t.text}
                    x={t.x}
                    y={t.y}
                    fontSize={t.fontSize}
                    fill={t.fill}
                    fontFamily={t.fontFamily}
                    opacity={t.opacity ?? 1}
                    rotation={t.rotation}
                    draggable={!zoneMode}
                    listening={!zoneMode}
                    fontStyle="bold"
                    onClick={(e) => {
                        e.cancelBubble = true;
                        dispatch(updatePatternState({ meshName, updates: { selectedId: t.id } }));
                        setSelectedNodes([e.target]);
                    }}
                    onTap={(e) => {
                        e.cancelBubble = true;
                        dispatch(updatePatternState({ meshName, updates: { selectedId: t.id } }));
                        setSelectedNodes([e.target]);
                    }}
                    onDragEnd={(e) => {
                        const nextText = textNodes.map(tn =>
                            tn.id === t.id ? { ...tn, x: e.target.x(), y: e.target.y() } : tn
                        );
                        dispatch(updatePatternState({ meshName, updates: { textNodes: nextText } }));
                        triggerExport();
                    }}
                    onTransformEnd={(e) => {
                        const n = e.target;
                        const newSize = n.fontSize() * n.scaleX();
                        n.scaleX(1);
                        n.scaleY(1);
                        const nextText = textNodes.map(tn =>
                            tn.id === t.id ? { ...tn, x: n.x(), y: n.y(), fontSize: newSize, rotation: n.rotation() } : tn
                        );
                        dispatch(updatePatternState({ meshName, updates: { textNodes: nextText } }));
                        setTimeout(() => triggerExport(), 50);
                    }}
                />
            ))}
        </>
    );
};

export default TextGroup;
