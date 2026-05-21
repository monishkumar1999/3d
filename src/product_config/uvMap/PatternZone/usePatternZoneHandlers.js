import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { initPatternState, updatePatternState } from "../../../store/redux/uvMapSlice";

export const usePatternZoneHandlers = ({
    meshName, stickerUrl, maskImg, triggerExport, onStickerAdded, selectedZoneId
}) => {
    const dispatch = useDispatch();
    const onStickerAddedRef = useRef(onStickerAdded);
    onStickerAddedRef.current = onStickerAdded;

    useEffect(() => {
        dispatch(initPatternState(meshName));
    }, [meshName, dispatch]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
                dispatch(updatePatternState({
                    meshName,
                    updates: { selectedZoneId: null }
                }));
            }
            if (e.key === 'Escape') {
                dispatch(updatePatternState({
                    meshName,
                    updates: { drawingRect: null, polyPoints: [], cursorPos: null }
                }));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedZoneId, meshName, dispatch]);

    useEffect(() => {
        if (!stickerUrl) return;
        if (stickerUrl === '__TEXT_NODE__') {
            const newText = {
                id: 'text_' + Date.now(), text: 'DOUBLE CLICK TO EDIT',
                x: maskImg ? maskImg.naturalWidth / 2 - 100 : 500, y: maskImg ? maskImg.naturalHeight / 2 - 50 : 500,
                fontSize: 80, fill: '#ffffff', fontFamily: 'Inter', rotation: 0
            };
            dispatch(updatePatternState({
                meshName,
                updates: { textNodes: [newText], selectedId: newText.id }
            }));
            if (onStickerAddedRef.current) onStickerAddedRef.current();
            setTimeout(() => triggerExport(), 150);
            return;
        }

        const img = new window.Image();
        img.src = stickerUrl;
        img.decode().then(() => {
            const maskW = maskImg ? maskImg.naturalWidth : 1000;
            const maskH = maskImg ? maskImg.naturalHeight : 1000;
            const baseSize = Math.min(maskW, maskH) * 0.5;
            const imgAspect = img.naturalWidth / (img.naturalHeight || 1);
            const stickerW = imgAspect >= 1 ? baseSize : baseSize * imgAspect;
            const stickerH = imgAspect >= 1 ? baseSize / imgAspect : baseSize;

            const newSticker = {
                id: 'sticker_' + Date.now(), image: img,
                x: maskW / 2 - stickerW / 2, y: maskH / 2 - stickerH / 2,
                width: stickerW, height: stickerH, rotation: 0
            };
            dispatch(updatePatternState({
                meshName,
                updates: { stickers: [newSticker], selectedId: newSticker.id }
            }));
            if (onStickerAddedRef.current) onStickerAddedRef.current();
            setTimeout(() => triggerExport(), 150);
        }).catch(err => {
            console.error("Failed to decode image asynchronously:", err);
        });
    }, [stickerUrl, maskImg, meshName, dispatch, triggerExport]);
};
