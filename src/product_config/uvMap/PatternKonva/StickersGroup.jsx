import React, { useState, useEffect } from "react";
import { Image as KImage } from "react-konva";
import { useDispatch } from "react-redux";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

const SingleStickerItem = ({ s, meshName, stickers, zoneMode, setSelectedNodes, triggerExport, dispatch }) => {
    const [imageObj, setImageObj] = useState(s.image || null);

    useEffect(() => {
        if (s.image) {
            setImageObj(s.image);
            return;
        }

        const stickerUrl = s.url || s.src;
        if (stickerUrl) {
            const img = new window.Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                setImageObj(img);
                // Save loaded image object into Redux state
                const nextStickers = stickers.map(item => item.id === s.id ? { ...item, image: img } : item);
                dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
                setTimeout(() => triggerExport(), 100);
            };
            img.onerror = (err) => {
                console.error("Failed to load sticker image from URL:", stickerUrl, err);
            };
            img.src = stickerUrl;
        }
    }, [s.url, s.src, s.image]);

    if (!imageObj) return null;

    return (
        <KImage
            key={s.id}
            id={s.id}
            image={imageObj}
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
    );
};

export const StickersGroup = ({ meshName, stickers, zoneMode, setSelectedNodes, triggerExport }) => {
    const dispatch = useDispatch();

    return (
        <>
            {stickers.map(s => (
                <SingleStickerItem
                    key={s.id}
                    s={s}
                    meshName={meshName}
                    stickers={stickers}
                    zoneMode={zoneMode}
                    setSelectedNodes={setSelectedNodes}
                    triggerExport={triggerExport}
                    dispatch={dispatch}
                />
            ))}
        </>
    );
};

export default StickersGroup;
