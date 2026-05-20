import React, { useEffect, useRef } from "react";
import { PatternHeader } from "./PatternHeader";
import { PatternKonva } from "./PatternKonva";
import FloatingTextToolbar from "./FloatingTextToolbar";
import FloatingImageToolbar from "./FloatingImageToolbar";
import { usePatternMasks } from "../hooks/usePatternMasks";
import { usePatternExport } from "../hooks/usePatternExport";
import useStore from "../../store/useStore";

const PatternZone = ({ meshName, maskUrl, stickerUrl, onUpdateTexture, onStickerAdded, isSelected, onClick }) => {
    const stageRef = useRef(null);
    const uiContainerRef = useRef(null);
    const trRef = useRef(null);

    const { maskImg, wireframeImg } = usePatternMasks(maskUrl);

    const initPatternState = useStore(state => state.initPatternState);
    const updatePatternState = useStore(state => state.updatePatternState);
    const meshState = useStore(state => state.patternStates[meshName]) || {
        stickers: [], textNodes: [], zones: [], zoneMode: null,
        drawingRect: null, polyPoints: [], cursorPos: null, selectedZoneId: null, selectedId: null
    };

    const { stickers, textNodes, zones, zoneMode, selectedZoneId, selectedId } = meshState;

    // Use Refs to pass the latest arrays to the export function without closure stales
    const stickersRef = useRef(stickers); stickersRef.current = stickers;
    const textNodesRef = useRef(textNodes); textNodesRef.current = textNodes;
    const zonesRef = useRef(zones); zonesRef.current = zones;
    const onStickerAddedRef = useRef(onStickerAdded); onStickerAddedRef.current = onStickerAdded;

    useEffect(() => {
        initPatternState(meshName);
    }, [meshName, initPatternState]);

    const maxSize = 450;
    const uiScale = maskImg ? Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight) : 1;
    const displayW = maskImg ? maskImg.naturalWidth * uiScale : 300;
    const displayH = maskImg ? maskImg.naturalHeight * uiScale : 300;

    const { triggerExport } = usePatternExport({
        stageRef, maskImg, uiScale, displayW, displayH,
        stickersRef, textNodesRef, zonesRef, meshName, onUpdateTexture, selectedId, trRef
    });

    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
                updatePatternState(meshName, prev => ({ zones: prev.zones.filter(z => z.id !== selectedZoneId), selectedZoneId: null }));
            }
            if (e.key === 'Escape') {
                updatePatternState(meshName, { drawingRect: null, polyPoints: [], cursorPos: null });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedZoneId, meshName, updatePatternState]);

    useEffect(() => {
        if (!stickerUrl) return;
        if (stickerUrl === '__TEXT_NODE__') {
            const newText = {
                id: 'text_' + Date.now(), text: 'DOUBLE CLICK TO EDIT',
                x: maskImg ? maskImg.naturalWidth / 2 - 100 : 500, y: maskImg ? maskImg.naturalHeight / 2 - 50 : 500,
                fontSize: 80, fill: '#ffffff', fontFamily: 'Inter', rotation: 0
            };
            updatePatternState(meshName, prev => ({ textNodes: [...prev.textNodes, newText], selectedId: newText.id }));
            if (onStickerAddedRef.current) onStickerAddedRef.current();
            setTimeout(() => triggerExport(), 150);
            return;
        }
        const img = new window.Image();
        img.src = stickerUrl;
        img.decode().then(() => {
            // Size sticker proportional to mask (50% of shorter mask dimension) and preserve aspect ratio
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
            updatePatternState(meshName, prev => ({ stickers: [...prev.stickers, newSticker], selectedId: newSticker.id }));
            if (onStickerAddedRef.current) onStickerAddedRef.current();
            setTimeout(() => triggerExport(), 150);
        }).catch(err => {
            console.error("Failed to decode image asynchronously:", err);
            // Fallback for extremely weird formats
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
            updatePatternState(meshName, prev => ({ stickers: [...prev.stickers, newSticker], selectedId: newSticker.id }));
            if (onStickerAddedRef.current) onStickerAddedRef.current();
            setTimeout(() => triggerExport(), 150);
        });
    }, [stickerUrl, maskImg, meshName, updatePatternState, triggerExport]);

    useEffect(() => {
        if (!zoneMode && selectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) {
            trRef.current.nodes([]);
        }
    }, [selectedId, stickers, zoneMode]);

    useEffect(() => {
        if (!zoneMode) setTimeout(() => triggerExport(), 100);
    }, [zones, zoneMode]);

    if (!maskImg) return <div className="w-[300px] h-[300px] bg-black rounded-lg animate-pulse" />;

    return (
        <div className="relative group transition-all duration-300 p-2 z-10" onClick={onClick}>
            <PatternHeader
                meshName={meshName} isSelected={isSelected} triggerExport={triggerExport} onUpdateTexture={onUpdateTexture}
            />

            <div ref={uiContainerRef} className={`rounded-lg overflow-hidden transition-all duration-300 bg-black border border-zinc-200 ${isSelected ? 'ring-4 ring-indigo-500 shadow-xl scale-[1.02]' : 'shadow-sm'}`}
                style={{ width: displayW, height: displayH, position: 'relative' }}>
                <PatternKonva
                    meshName={meshName} displayW={displayW} displayH={displayH} uiScale={uiScale}
                    wireframeImg={wireframeImg} maskImg={maskImg} triggerExport={triggerExport}
                    stageRef={stageRef} trRef={trRef}
                />
            </div>

            {selectedId && stageRef.current && (() => {
                const node = stageRef.current.findOne('#' + selectedId);
                if (!node) return null;
                const box = node.getClientRect();
                const pos = { top: box.y, left: box.x + box.width / 2 };

                if (selectedId.startsWith('text_')) {
                    return <FloatingTextToolbar sticker={textNodes.find(t => t.id === selectedId)} containerRef={uiContainerRef} position={pos}
                        onChange={(upds) => { updatePatternState(meshName, prev => ({ textNodes: prev.textNodes.map(t => t.id === selectedId ? { ...t, ...upds } : t) })); setTimeout(() => triggerExport(), 50); }}
                        onDelete={() => { updatePatternState(meshName, prev => ({ textNodes: prev.textNodes.filter(t => t.id !== selectedId), selectedId: null })); setTimeout(() => triggerExport(), 50); }}
                        onDuplicate={() => { const t = textNodes.find(t => t.id === selectedId); const nt = { ...t, id: 'text_' + Date.now(), x: t.x + 20, y: t.y + 20 }; updatePatternState(meshName, prev => ({ textNodes: [...prev.textNodes, nt], selectedId: nt.id })); }}
                        onMoveForward={() => updatePatternState(meshName, prev => { const i = prev.textNodes.findIndex(t => t.id === selectedId); if (i === prev.textNodes.length - 1) return prev; const n = [...prev.textNodes];[n[i], n[i + 1]] = [n[i + 1], n[i]]; return { textNodes: n }; })}
                        onMoveBackward={() => updatePatternState(meshName, prev => { const i = prev.textNodes.findIndex(t => t.id === selectedId); if (i === 0) return prev; const n = [...prev.textNodes];[n[i], n[i - 1]] = [n[i - 1], n[i]]; return { textNodes: n }; })} />
                } else if (selectedId.startsWith('sticker_')) {
                    return <FloatingImageToolbar sticker={stickers.find(s => s.id === selectedId)} containerRef={uiContainerRef} position={pos}
                        onChange={(upds) => { updatePatternState(meshName, prev => ({ stickers: prev.stickers.map(s => s.id === selectedId ? { ...s, ...upds } : s) })); setTimeout(() => triggerExport(), 50); }}
                        onDelete={() => { updatePatternState(meshName, prev => ({ stickers: prev.stickers.filter(s => s.id !== selectedId), selectedId: null })); setTimeout(() => triggerExport(), 50); }}
                        onDuplicate={() => { const s = stickers.find(s => s.id === selectedId); const ns = { ...s, id: 'sticker_' + Date.now(), x: s.x + 20, y: s.y + 20 }; updatePatternState(meshName, prev => ({ stickers: [...prev.stickers, ns], selectedId: ns.id })); }}
                        onMoveForward={() => updatePatternState(meshName, prev => { const i = prev.stickers.findIndex(s => s.id === selectedId); if (i === prev.stickers.length - 1) return prev; const n = [...prev.stickers];[n[i], n[i + 1]] = [n[i + 1], n[i]]; return { stickers: n }; })}
                        onMoveBackward={() => updatePatternState(meshName, prev => { const i = prev.stickers.findIndex(s => s.id === selectedId); if (i === 0) return prev; const n = [...prev.stickers];[n[i], n[i - 1]] = [n[i - 1], n[i]]; return { stickers: n }; })}
                        onMoveToFront={() => updatePatternState(meshName, prev => { const i = prev.stickers.findIndex(s => s.id === selectedId); return { stickers: [...prev.stickers.filter(s => s.id !== selectedId), prev.stickers[i]] }; })}
                        onMoveToBack={() => updatePatternState(meshName, prev => { const i = prev.stickers.findIndex(s => s.id === selectedId); return { stickers: [prev.stickers[i], ...prev.stickers.filter(s => s.id !== selectedId)] }; })} />
                }
                return null;
            })()}
        </div>
    );
};

export default PatternZone;
