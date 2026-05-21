import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { PatternHeader } from "./PatternHeader";
import PatternKonva from "../PatternKonva/PatternKonva";
import FloatingTextToolbar from "../Toolbar/FloatingTextToolbar";
import FloatingImageToolbar from "../Toolbar/FloatingImageToolbar";
import { usePatternMasks } from "../hooks/usePatternMasks";
import { usePatternExport } from "../hooks/usePatternExport";
import { usePatternZoneHandlers } from "./usePatternZoneHandlers";
import { updatePatternState } from "../../../store/redux/uvMapSlice";

const PatternZone = ({ meshName, maskUrl, stickerUrl, onUpdateTexture, onStickerAdded, isSelected, onClick }) => {
    const stageRef = useRef(null);
    const uiContainerRef = useRef(null);
    const trRef = useRef(null);
    const dispatch = useDispatch();

    const { maskImg, wireframeImg } = usePatternMasks(maskUrl);

    const meshState = useSelector(state => state.uvMap.patternStates[meshName]) || {
        stickers: [], textNodes: [], zones: [], zoneMode: null,
        drawingRect: null, polyPoints: [], cursorPos: null, selectedZoneId: null, selectedId: null
    };

    const { stickers, textNodes, zones, zoneMode, selectedZoneId, selectedId } = meshState;

    const stickersRef = useRef(stickers); stickersRef.current = stickers;
    const textNodesRef = useRef(textNodes); textNodesRef.current = textNodes;
    const zonesRef = useRef(zones); zonesRef.current = zones;

    const maxSize = 450;
    const uiScale = maskImg ? Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight) : 1;
    const displayW = maskImg ? maskImg.naturalWidth * uiScale : 300;
    const displayH = maskImg ? maskImg.naturalHeight * uiScale : 300;

    const { triggerExport } = usePatternExport({
        stageRef, maskImg, uiScale, displayW, displayH,
        stickersRef, textNodesRef, zonesRef, meshName, onUpdateTexture, trRef
    });

    usePatternZoneHandlers({
        meshName, stickerUrl, maskImg, triggerExport, onStickerAdded, selectedZoneId
    });

    useEffect(() => {
        if (!zoneMode) setTimeout(() => triggerExport(), 100);
    }, [zones, zoneMode]);

    if (!maskImg) return <div className="w-[300px] h-[300px] bg-black rounded-lg animate-pulse" />;

    const onTextChange = (upds) => {
        const nextText = textNodes.map(t => t.id === selectedId ? { ...t, ...upds } : t);
        dispatch(updatePatternState({ meshName, updates: { textNodes: nextText } }));
        setTimeout(() => triggerExport(), 50);
    };

    const onTextDelete = () => {
        const nextText = textNodes.filter(t => t.id !== selectedId);
        dispatch(updatePatternState({ meshName, updates: { textNodes: nextText, selectedId: null } }));
        setTimeout(() => triggerExport(), 50);
    };

    const onTextDuplicate = () => {
        const t = textNodes.find(t => t.id === selectedId);
        if (!t) return;
        const nt = { ...t, id: 'text_' + Date.now(), x: t.x + 20, y: t.y + 20 };
        dispatch(updatePatternState({ meshName, updates: { textNodes: [...textNodes, nt], selectedId: nt.id } }));
    };

    const onTextMoveForward = () => {
        const i = textNodes.findIndex(t => t.id === selectedId);
        if (i === -1 || i === textNodes.length - 1) return;
        const n = [...textNodes];
        [n[i], n[i + 1]] = [n[i + 1], n[i]];
        dispatch(updatePatternState({ meshName, updates: { textNodes: n } }));
    };

    const onTextMoveBackward = () => {
        const i = textNodes.findIndex(t => t.id === selectedId);
        if (i === -1 || i === 0) return;
        const n = [...textNodes];
        [n[i], n[i - 1]] = [n[i - 1], n[i]];
        dispatch(updatePatternState({ meshName, updates: { textNodes: n } }));
    };

    const onStickerChange = (upds) => {
        const nextStickers = stickers.map(s => s.id === selectedId ? { ...s, ...upds } : s);
        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
        setTimeout(() => triggerExport(), 50);
    };

    const onStickerDelete = () => {
        const nextStickers = stickers.filter(s => s.id !== selectedId);
        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers, selectedId: null } }));
        setTimeout(() => triggerExport(), 50);
    };

    const onStickerDuplicate = () => {
        const s = stickers.find(s => s.id === selectedId);
        if (!s) return;
        const ns = { ...s, id: 'sticker_' + Date.now(), x: s.x + 20, y: s.y + 20 };
        dispatch(updatePatternState({ meshName, updates: { stickers: [...stickers, ns], selectedId: ns.id } }));
    };

    const onStickerMoveForward = () => {
        const i = stickers.findIndex(s => s.id === selectedId);
        if (i === -1 || i === stickers.length - 1) return;
        const n = [...stickers];
        [n[i], n[i + 1]] = [n[i + 1], n[i]];
        dispatch(updatePatternState({ meshName, updates: { stickers: n } }));
    };

    const onStickerMoveBackward = () => {
        const i = stickers.findIndex(s => s.id === selectedId);
        if (i === -1 || i === 0) return;
        const n = [...stickers];
        [n[i], n[i - 1]] = [n[i - 1], n[i]];
        dispatch(updatePatternState({ meshName, updates: { stickers: n } }));
    };

    const onStickerMoveToFront = () => {
        const i = stickers.findIndex(s => s.id === selectedId);
        if (i === -1) return;
        const nextStickers = [...stickers.filter(s => s.id !== selectedId), stickers[i]];
        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
    };

    const onStickerMoveToBack = () => {
        const i = stickers.findIndex(s => s.id === selectedId);
        if (i === -1) return;
        const nextStickers = [stickers[i], ...stickers.filter(s => s.id !== selectedId)];
        dispatch(updatePatternState({ meshName, updates: { stickers: nextStickers } }));
    };

    const getFloatingToolbar = () => {
        if (!selectedId || !stageRef.current) return null;
        const node = stageRef.current.findOne('#' + selectedId);
        if (!node) return null;
        const box = node.getClientRect();
        const pos = { top: box.y, left: box.x + box.width / 2 };

        if (selectedId.startsWith('text_')) {
            return (
                <FloatingTextToolbar
                    sticker={textNodes.find(t => t.id === selectedId)} containerRef={uiContainerRef} position={pos}
                    onChange={onTextChange} onDelete={onTextDelete} onDuplicate={onTextDuplicate}
                    onMoveForward={onTextMoveForward} onMoveBackward={onTextMoveBackward}
                />
            );
        } else if (selectedId.startsWith('sticker_')) {
            return (
                <FloatingImageToolbar
                    sticker={stickers.find(s => s.id === selectedId)} containerRef={uiContainerRef} position={pos}
                    onChange={onStickerChange} onDelete={onStickerDelete} onDuplicate={onStickerDuplicate}
                    onMoveForward={onStickerMoveForward} onMoveBackward={onStickerMoveBackward}
                    onMoveToFront={onStickerMoveToFront} onMoveToBack={onStickerMoveToBack}
                />
            );
        }
        return null;
    };

    return (
        <div className="relative group transition-all duration-300 p-2 z-10" onClick={onClick}>
            <PatternHeader meshName={meshName} isSelected={isSelected} triggerExport={triggerExport} onUpdateTexture={onUpdateTexture} />

            <div ref={uiContainerRef} className={`rounded-lg overflow-hidden transition-all duration-300 bg-black border border-zinc-200 ${isSelected ? 'ring-4 ring-indigo-500 shadow-xl scale-[1.02]' : 'shadow-sm'}`} style={{ width: displayW, height: displayH, position: 'relative' }}>
                <PatternKonva meshName={meshName} displayW={displayW} displayH={displayH} uiScale={uiScale} wireframeImg={wireframeImg} maskImg={maskImg} triggerExport={triggerExport} stageRef={stageRef} trRef={trRef} />
            </div>

            {getFloatingToolbar()}
        </div>
    );
};

export default PatternZone;
