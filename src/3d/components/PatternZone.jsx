import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KImage, Transformer, Rect, Line, Text, Group } from "react-konva";
import { X, Sparkles, Square, PenLine, Trash2, CheckCheck } from "lucide-react";
import FloatingTextToolbar from "./FloatingTextToolbar";
import FloatingImageToolbar from "./FloatingImageToolbar";

// Stable debounce that always calls the LATEST version of the callback
function useStableDebounce(fn, delay) {
    const fnRef = useRef(fn);
    // Keep ref pointing to the latest fn every render
    fnRef.current = fn;

    const timerRef = useRef(null);
    return useCallback((...args) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            fnRef.current(...args); // always calls latest fn
        }, delay);
    }, [delay]); // stable — only rebuilds if delay changes
}

const PatternZone = ({ meshName, maskUrl, stickerUrl, onUpdateTexture, onStickerAdded, isSelected, onClick }) => {
    const stageRef = useRef(null);
    const uiContainerRef = useRef(null); // Ref for DOM container
    const [maskImg, setMaskImg] = useState(null);
    const [wireframeImg, setWireframeImg] = useState(null);
    const [stickers, setStickers] = useState([]);
    const [textNodes, setTextNodes] = useState([]); // New: Support for text
    const stickersRef = useRef(stickers);
    stickersRef.current = stickers;
    const textNodesRef = useRef(textNodes);
    textNodesRef.current = textNodes;

    const [selectedId, setSelectedId] = useState(null);
    const trRef = useRef(null);

    // ── Zone state ──
    // zones: [{ id, type:'rect'|'poly', x,y,w,h } | { id, type:'poly', points:[x0,y0,...] }]
    const [zones, setZones] = useState([]);
    const zonesRef = useRef(zones);
    zonesRef.current = zones;
    const [zoneMode, setZoneMode] = useState(null); // null | 'rect' | 'poly'
    const [drawingRect, setDrawingRect] = useState(null); // { x0,y0,x1,y1 } while dragging
    const [polyPoints, setPolyPoints] = useState([]); // flat [x0,y0,x1,y1,...] while drawing
    const [cursorPos, setCursorPos] = useState(null); // { x, y } for poly preview
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    // Delete selected zone with keyboard
    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZoneId) {
                setZones(prev => prev.filter(z => z.id !== selectedZoneId));
                setSelectedZoneId(null);
            }
            if (e.key === 'Escape') {
                setDrawingRect(null);
                setPolyPoints([]);
                setCursorPos(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedZoneId]);

    useEffect(() => {
        if (!maskUrl) return;
        import('../utils/maskProcessor').then(({ processWireframeToSolid }) => {
            processWireframeToSolid(maskUrl)
                .then(solidDataUrl => {
                    const img = new window.Image();
                    img.src = solidDataUrl;
                    img.onload = () => setMaskImg(img);
                })
                .catch(() => {
                    const img = new window.Image();
                    img.src = maskUrl;
                    img.onload = () => setMaskImg(img);
                });
        });

        // Load and convert wireframe to white
        const wfImg = new window.Image();
        wfImg.crossOrigin = "Anonymous";
        wfImg.src = maskUrl;
        wfImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = wfImg.naturalWidth;
            canvas.height = wfImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(wfImg, 0, 0);

            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 0) {
                        data[i] = 255;
                        data[i + 1] = 255;
                        data[i + 2] = 255;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                const whiteImg = new window.Image();
                whiteImg.src = canvas.toDataURL('image/png');
                whiteImg.onload = () => setWireframeImg(whiteImg);
            } catch (e) {
                // Fallback if CORS prevents pixel access
                setWireframeImg(wfImg);
            }
        };
        wfImg.onerror = () => setWireframeImg(wfImg);
    }, [maskUrl]);

    useEffect(() => {
        if (!stickerUrl) return;

        if (stickerUrl === '__TEXT_NODE__') {
            const newText = {
                id: 'text_' + Date.now().toString(),
                text: 'DOUBLE CLICK TO EDIT',
                x: maskImg ? maskImg.naturalWidth / 2 - 100 : 500,
                y: maskImg ? maskImg.naturalHeight / 2 - 50 : 500,
                fontSize: 80, // Larger default for high-res stage
                fill: '#ffffff',
                fontFamily: 'Inter',
                rotation: 0
            };
            setTextNodes(prev => [...prev, newText]);
            setSelectedId(newText.id);
            if (onStickerAdded) onStickerAdded();
            setTimeout(() => triggerExport(), 150);
            return;
        }

        const img = new window.Image();
        img.src = stickerUrl;
        img.onload = () => {
            const newSticker = {
                id: 'sticker_' + Date.now().toString(),
                image: img,
                x: maskImg ? maskImg.naturalWidth / 2 - 200 : 500,
                y: maskImg ? maskImg.naturalHeight / 2 - 200 : 500,
                width: 400, height: 400,
                rotation: 0
            };
            setStickers(prev => [...prev, newSticker]);
            setSelectedId(newSticker.id);
            if (onStickerAdded) onStickerAdded();
            setTimeout(() => triggerExport(), 150);
        };
    }, [stickerUrl]);

    // Sync sticker transformer (disabled in zone mode)
    useEffect(() => {
        if (!zoneMode && selectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) {
            trRef.current.nodes([]);
        }
    }, [selectedId, stickers, zoneMode]);

    // Re-export whenever zones change OR when zone drawing mode exits.
    // This ensures 3D model updates automatically when zones are added/removed/cleared,
    // and also when the user first uploads a sticker (no zones = full UV area export).
    useEffect(() => {
        if (!zoneMode) {
            // Small delay so React has re-rendered (zone shapes hidden) before we snapshot
            setTimeout(() => triggerExport(), 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zones, zoneMode]);

    // The actual export function — always reads latest values via refs
    const performExport = useCallback(() => {
        if (!stageRef.current || !maskImg) return;

        // 1. Hide unwanted elements for clean export
        if (trRef.current) trRef.current.nodes([]);

        const layer = stageRef.current.getLayers()[0];
        if (!layer) return;

        // Find wireframe and hide it
        const wireframeNode = layer.findOne('.wireframe');
        if (wireframeNode) wireframeNode.hide();

        // Hide zone visual shapes so they don't appear on the 3D texture
        const zoneNodes = layer.find('.zone-shape');
        zoneNodes.forEach(n => n.hide());

        layer.draw();

        // 2. Export full natural size from Konva stage
        const rawUri = stageRef.current.toDataURL({
            pixelRatio: 1,
            x: 0,
            y: 0,
            width: maskImg.naturalWidth,
            height: maskImg.naturalHeight
        });

        // 3. Restore visibility
        if (wireframeNode) wireframeNode.show();
        zoneNodes.forEach(n => n.show());
        layer.draw();

        // Export if there is ANY content (stickers or text)
        if (stickersRef.current.length > 0 || textNodesRef.current.length > 0) {
            const W = maskImg.naturalWidth;
            const H = maskImg.naturalHeight;

            const stickerImg = new window.Image();
            stickerImg.onload = () => {
                // Composite sticker through the UV mask shape so it is clipped
                // to the UV island only (prevents bleed on the 3D mesh).
                // NOTE: No Y-flip needed — Blender's GLTF exporter already flips UV Y
                // on export (Blender: Y=0 bottom → GLTF: Y=0 top), so HTML canvas
                // Y=0-at-top and GLTF UV Y=0-at-top are already aligned.
                const maskedCanvas = document.createElement('canvas');
                maskedCanvas.width = W;
                maskedCanvas.height = H;
                const maskedCtx = maskedCanvas.getContext('2d');

                maskedCtx.drawImage(stickerImg, 0, 0, W, H);
                // Clip to UV mask shape
                maskedCtx.globalCompositeOperation = 'destination-in';
                maskedCtx.drawImage(maskImg, 0, 0, W, H);
                // If zones are defined, additionally clip to the union of all zones
                if (zonesRef.current.length > 0) {
                    const zoneCanvas = document.createElement('canvas');
                    zoneCanvas.width = W; zoneCanvas.height = H;
                    const zctx = zoneCanvas.getContext('2d');
                    zctx.fillStyle = 'white';
                    zonesRef.current.forEach(zone => {
                        if (zone.type === 'rect') {
                            zctx.fillRect(zone.x, zone.y, zone.w, zone.h);
                        } else if (zone.type === 'poly' && zone.points.length >= 6) {
                            zctx.beginPath();
                            for (let i = 0; i < zone.points.length; i += 2) {
                                if (i === 0) zctx.moveTo(zone.points[i], zone.points[i + 1]);
                                else zctx.lineTo(zone.points[i], zone.points[i + 1]);
                            }
                            zctx.closePath();
                            zctx.fill();
                        }
                    });
                    maskedCtx.globalCompositeOperation = 'destination-in';
                    maskedCtx.drawImage(zoneCanvas, 0, 0);
                }
                maskedCtx.globalCompositeOperation = 'source-over';

                onUpdateTexture(meshName, maskedCanvas.toDataURL('image/png'));
            };
            stickerImg.src = rawUri;
        } else {
            onUpdateTexture(meshName, null);
        }

        // Restore transformer
        if (selectedId && trRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer()?.batchDraw(); }
        }
    }, [maskImg, meshName, onUpdateTexture, selectedId]);

    const triggerExport = useStableDebounce(performExport, 250);

    if (!maskImg) return <div className="w-[300px] h-[300px] bg-black rounded-lg border border-zinc-200 animate-pulse" />;

    // --- UI SCALING ---
    // We keep the Stage at 1:1 logical size (mask dimensions)
    // but scale the container div via CSS to fit our UI.
    const maxSize = 340;
    const uiScale = Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight);
    const displayW = maskImg.naturalWidth * uiScale;
    const displayH = maskImg.naturalHeight * uiScale;

    return (
        <div className="relative group transition-all duration-300 p-2 z-10" onClick={onClick}>
            {/* Controls above canvas */}
            <div className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`}>
                    {meshName}
                    {zones.length > 0 && !zoneMode && (
                        <span className="bg-cyan-100 text-cyan-600 text-[8px] px-1 rounded font-bold border border-cyan-200">{zones.length} zone{zones.length > 1 ? 's' : ''}</span>
                    )}
                </span>
                <div className="flex items-center gap-1">
                    {/* Zone mode toolbar */}
                    {zoneMode ? (
                        <>
                            <span className="text-[9px] text-indigo-500 font-bold mr-1 italic">
                                {zoneMode === 'rect' ? 'Drag to draw rect' : polyPoints.length === 0 ? 'Click to add points' : `${polyPoints.length / 2} points — Double click to close`}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setZoneMode('rect'); setPolyPoints([]); setDrawingRect(null); }}
                                className={`px-2 py-0.5 text-[9px] rounded font-bold border transition-all ${ zoneMode === 'rect' ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-400'}`}>
                                <Square size={9} className="inline mr-1" />Rect
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setZoneMode('poly'); setDrawingRect(null); setPolyPoints([]); }}
                                className={`px-2 py-0.5 text-[9px] rounded font-bold border transition-all ${ zoneMode === 'poly' ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-400'}`}>
                                <PenLine size={9} className="inline mr-1" />Poly
                            </button>
                            {zones.length > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); setZones([]); setSelectedZoneId(null); }}
                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Clear all zones">
                                    <Trash2 size={11} />
                                </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setZoneMode(null); setDrawingRect(null); setPolyPoints([]); setCursorPos(null); }}
                                className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-bold shadow-sm transition-colors">
                                <CheckCheck size={10} />Done
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); setZoneMode('rect'); setSelectedId(null); }}
                            className={`p-1.5 rounded-lg border transition-all ${
                                zones.length > 0 ? 'bg-cyan-50 text-cyan-600 border-cyan-200 shadow-sm' : 'text-zinc-400 hover:bg-zinc-100 border-transparent hover:border-zinc-200'
                            }`}
                            title="Draw customization zones"
                        >
                            <Square size={12} />
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); triggerExport(); }}
                        className="p-1 hover:bg-indigo-50 text-indigo-400 rounded-full" title="Sync 3D">
                        <Sparkles size={11} />
                    </button>
                    {(stickers.length > 0 || textNodes.length > 0) && (
                        <button onClick={(e) => { e.stopPropagation(); setStickers([]); setTextNodes([]); setSelectedId(null); onUpdateTexture(meshName, null); }}
                            className="p-1 hover:bg-red-50 text-red-400 rounded-full">
                            <X size={11} />
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Container with CSS Scaling */}
            <div
                className={`rounded-lg overflow-hidden transition-all duration-300 bg-white border border-zinc-200 ${isSelected ? 'ring-4 ring-indigo-500 shadow-xl scale-[1.02]' : 'shadow-sm'}`}
                style={{
                    width: displayW,
                    height: displayH,
                    position: 'relative'
                }}
            >
                <div
                    ref={uiContainerRef}
                    style={{
                        transform: `scale(${uiScale})`,
                        transformOrigin: '0 0',
                        width: maskImg.naturalWidth,
                        height: maskImg.naturalHeight
                    }}
                >
                    <Stage
                        width={maskImg.naturalWidth}
                        height={maskImg.naturalHeight}
                        ref={stageRef}
                        style={{ cursor: zoneMode ? (zoneMode === 'rect' ? 'crosshair' : 'cell') : 'default' }}
                        onMouseDown={(e) => {
                            if (zoneMode === 'rect') {
                                const pos = e.target.getStage().getPointerPosition();
                                setDrawingRect({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
                                return;
                            }
                            if (!zoneMode && e.target === e.target.getStage()) setSelectedId(null);
                        }}
                        onMouseMove={(e) => {
                            const pos = e.target.getStage().getPointerPosition();
                            if (!pos) return;
                            if (zoneMode === 'rect' && drawingRect) {
                                setDrawingRect(prev => ({ ...prev, x1: pos.x, y1: pos.y }));
                            }
                            if (zoneMode === 'poly') setCursorPos(pos);
                        }}
                        onMouseUp={(e) => {
                            if (zoneMode === 'rect' && drawingRect) {
                                const x = Math.min(drawingRect.x0, drawingRect.x1);
                                const y = Math.min(drawingRect.y0, drawingRect.y1);
                                const w = Math.abs(drawingRect.x1 - drawingRect.x0);
                                const h = Math.abs(drawingRect.y1 - drawingRect.y0);
                                if (w > 10 && h > 10) {
                                    setZones(prev => [...prev, { id: 'z_' + Date.now(), type: 'rect', x, y, w, h }]);
                                }
                                setDrawingRect(null);
                                return;
                            }
                            if (!zoneMode) triggerExport();
                        }}
                        onClick={(e) => {
                            if (zoneMode !== 'poly') return;
                            const pos = e.target.getStage().getPointerPosition();
                            if (!pos) return;
                            // Close polygon if clicking near the first point
                            if (polyPoints.length >= 6) {
                                const dx = pos.x - polyPoints[0];
                                const dy = pos.y - polyPoints[1];
                                if (Math.sqrt(dx * dx + dy * dy) < 20) {
                                    setZones(prev => [...prev, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }]);
                                    setPolyPoints([]);
                                    setCursorPos(null);
                                    return;
                                }
                            }
                            setPolyPoints(prev => [...prev, pos.x, pos.y]);
                        }}
                        onDblClick={(e) => {
                            if (zoneMode !== 'poly' || polyPoints.length < 6) return;
                            setZones(prev => [...prev, { id: 'z_' + Date.now(), type: 'poly', points: [...polyPoints] }]);
                            setPolyPoints([]);
                            setCursorPos(null);
                        }}
                    >
                        <Layer>
                            {/* Transparent base by default */}

                            {/* UV Mesh outline */}
                            {wireframeImg && (
                                <KImage
                                    name="wireframe" // Use name instead of id for class-like selection
                                    image={wireframeImg}
                                    width={wireframeImg.naturalWidth}
                                    height={wireframeImg.naturalHeight}
                                    listening={false}
                                    opacity={1}
                                    shadowColor="#71717a"
                                    shadowBlur={3}
                                    shadowOffsetX={0}
                                    shadowOffsetY={0}
                                    shadowOpacity={0.6}
                                />
                            )}

                            {/* ── ZONES ── */}
                            {/* Saved zones */}
                            {zones.map(zone => (
                                zone.type === 'rect' ? (
                                    <Rect key={zone.id}
                                        name="zone-shape"
                                        x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                                        fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                                        stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'}
                                        strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                                        dash={selectedZoneId === zone.id ? [] : [10, 5]}
                                        listening={!!zoneMode}
                                        onClick={() => setSelectedZoneId(prev => prev === zone.id ? null : zone.id)}
                                    />
                                ) : (
                                    <Line key={zone.id}
                                        name="zone-shape"
                                        points={zone.points}
                                        closed
                                        fill={selectedZoneId === zone.id ? 'rgba(37,99,235,0.1)' : 'rgba(6,182,212,0.05)'}
                                        stroke={selectedZoneId === zone.id ? '#2563eb' : '#06b6d4'}
                                        strokeWidth={selectedZoneId === zone.id ? 4 : 2}
                                        dash={selectedZoneId === zone.id ? [] : [10, 5]}
                                        listening={!!zoneMode}
                                        onClick={() => setSelectedZoneId(prev => prev === zone.id ? null : zone.id)}
                                    />
                                )
                            ))}
                            {/* In-progress rectangle */}
                            {zoneMode === 'rect' && drawingRect && (() => {
                                const x = Math.min(drawingRect.x0, drawingRect.x1);
                                const y = Math.min(drawingRect.y0, drawingRect.y1);
                                const w = Math.abs(drawingRect.x1 - drawingRect.x0);
                                const h = Math.abs(drawingRect.y1 - drawingRect.y0);
                                return <Rect name="zone-shape" x={x} y={y} width={w} height={h}
                                    fill="rgba(79,70,229,0.1)" stroke="#4f46e5" strokeWidth={5} dash={[16, 8]} listening={false} />;
                            })()}
                            {/* In-progress polygon */}
                            {zoneMode === 'poly' && polyPoints.length >= 2 && (
                                <>
                                    <Line
                                        name="zone-shape"
                                        points={[
                                            ...polyPoints,
                                            ...(cursorPos ? [cursorPos.x, cursorPos.y] : [])
                                        ]}
                                        stroke="#4f46e5" strokeWidth={4} dash={[12, 6]}
                                        fill="rgba(79,70,229,0.1)" closed={false} listening={false}
                                    />
                                    {/* First-point close indicator */}
                                    {polyPoints.length >= 6 && (
                                        <Rect
                                            name="zone-shape"
                                            x={polyPoints[0] - 10} y={polyPoints[1] - 10}
                                            width={20} height={20}
                                            fill="rgba(79,70,229,0.4)" stroke="#4f46e5" strokeWidth={3}
                                            cornerRadius={10} listening={false}
                                        />
                                    )}
                                </>
                            )}

                            {/* ── STICKERS & TEXT ── */}
                            
                            {/* 1. Dull version (Background) — shows the full placement but dimmed */}
                            <Group opacity={0.15}>
                                {stickers.map((s) => (
                                    <KImage
                                        key={s.id + '_dull'}
                                        image={s.image}
                                        x={s.x} y={s.y}
                                        width={s.width} height={s.height}
                                        rotation={s.rotation}
                                        listening={false}
                                    />
                                ))}
                                {textNodes.map((t) => (
                                    <Text
                                        key={t.id + '_dull'}
                                        text={t.text}
                                        x={t.x} y={t.y}
                                        fontSize={t.fontSize}
                                        fill={t.fill}
                                        fontFamily={t.fontFamily}
                                        rotation={t.rotation}
                                        fontStyle="bold"
                                        listening={false}
                                    />
                                ))}
                            </Group>

                            {/* 2. Clear version (Clipped) — only visible inside zones */}
                            <Group 
                                clipFunc={(ctx) => {
                                    if (zones.length === 0) {
                                        // If no zones, everything is "clear" (or we could default to nothing clear, 
                                        // but usually "no zones" means the whole area is customized).
                                        // To show everything clear when no zones:
                                        ctx.rect(0, 0, maskImg.naturalWidth, maskImg.naturalHeight);
                                        return;
                                    }
                                    zones.forEach(zone => {
                                        if (zone.type === 'rect') {
                                            ctx.rect(zone.x, zone.y, zone.w, zone.h);
                                        } else if (zone.type === 'poly' && zone.points.length >= 6) {
                                            ctx.moveTo(zone.points[0], zone.points[1]);
                                            for (let i = 2; i < zone.points.length; i += 2) {
                                                ctx.lineTo(zone.points[i], zone.points[i + 1]);
                                            }
                                            ctx.closePath();
                                        }
                                    });
                                }}
                            >
                                {stickers.map((s) => (
                                    <KImage
                                        key={s.id}
                                        id={s.id}
                                        image={s.image}
                                        x={s.x} y={s.y}
                                        width={s.width} height={s.height}
                                        opacity={s.opacity ?? 1}
                                        rotation={s.rotation}
                                        draggable={!zoneMode}
                                        listening={!zoneMode}
                                        onClick={() => setSelectedId(s.id)}
                                        onDragMove={() => triggerExport()}
                                        onDragEnd={(e) => {
                                            const id = e.target.id();
                                            setStickers(prev => prev.map(st =>
                                                st.id === id ? { ...st, x: e.target.x(), y: e.target.y() } : st
                                            ));
                                            triggerExport();
                                        }}
                                        onTransformEnd={(e) => {
                                            const node = e.target;
                                            const id = node.id();
                                            const newW = Math.max(5, node.width() * node.scaleX());
                                            const newH = Math.max(5, node.height() * node.scaleY());
                                            node.scaleX(1); node.scaleY(1);
                                            setStickers(prev => prev.map(st =>
                                                st.id === id ? { ...st, x: node.x(), y: node.y(), width: newW, height: newH, rotation: node.rotation() } : st
                                            ));
                                            setTimeout(() => triggerExport(), 50);
                                        }}
                                    />
                                ))}

                                {textNodes.map((t) => (
                                    <Text
                                        key={t.id}
                                        id={t.id}
                                        text={t.text}
                                        x={t.x} y={t.y}
                                        fontSize={t.fontSize}
                                        fill={t.fill}
                                        fontFamily={t.fontFamily}
                                        opacity={t.opacity ?? 1}
                                        rotation={t.rotation}
                                        draggable={!zoneMode}
                                        listening={!zoneMode}
                                        fontStyle="bold"
                                        onClick={() => setSelectedId(t.id)}
                                        onDragMove={() => triggerExport()}
                                        onDragEnd={(e) => {
                                            const id = e.target.id();
                                            setTextNodes(prev => prev.map(tn =>
                                                tn.id === id ? { ...tn, x: e.target.x(), y: e.target.y() } : tn
                                            ));
                                            triggerExport();
                                        }}
                                        onTransformEnd={(e) => {
                                            const node = e.target;
                                            const id = node.id();
                                            const newSize = node.fontSize() * node.scaleX();
                                            node.scaleX(1); node.scaleY(1);
                                            setTextNodes(prev => prev.map(tn =>
                                                tn.id === id ? { ...tn, x: node.x(), y: node.y(), fontSize: newSize, rotation: node.rotation() } : tn
                                            ));
                                            setTimeout(() => triggerExport(), 50);
                                        }}
                                    />
                                ))}
                            </Group>

                            {/* Sticker Transformer — always rendered, detached in zone mode */}
                            <Transformer
                                ref={trRef}
                                borderStroke="#4f46e5"
                                anchorStroke="#4f46e5"
                                anchorFill="#ffffff"
                                anchorSize={8}
                                borderDash={[2, 2]}
                            />
                        </Layer>
                    </Stage>
                </div>
            </div>

            {/* Floating Toolbars */}
            {selectedId && stageRef.current && (
                (() => {
                    const node = stageRef.current.findOne('#' + selectedId);
                    if (!node) return null;
                    const box = node.getClientRect();
                    // Multiply logical coordinates by uiScale to get screen-relative offset
                    const pos = {
                        top: box.y * uiScale,
                        left: (box.x + box.width / 2) * uiScale
                    };

                    if (selectedId.startsWith('text_')) {
                        const textNode = textNodes.find(t => t.id === selectedId);
                        return (
                            <FloatingTextToolbar
                                sticker={textNode}
                                containerRef={uiContainerRef}
                                position={pos}
                                onChange={(updates) => {
                                    setTextNodes(prev => prev.map(t => t.id === selectedId ? { ...t, ...updates } : t));
                                    setTimeout(() => triggerExport(), 50);
                                }}
                                onDelete={() => {
                                    setTextNodes(prev => prev.filter(t => t.id !== selectedId));
                                    setSelectedId(null);
                                    setTimeout(() => triggerExport(), 50);
                                }}
                                onDuplicate={() => {
                                    const t = textNodes.find(t => t.id === selectedId);
                                    const nt = { ...t, id: 'text_' + Date.now(), x: t.x + 20, y: t.y + 20 };
                                    setTextNodes(prev => [...prev, nt]);
                                    setSelectedId(nt.id);
                                }}
                                onMoveForward={() => {
                                    setTextNodes(prev => {
                                        const idx = prev.findIndex(t => t.id === selectedId);
                                        if (idx === prev.length - 1) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                        return next;
                                    });
                                }}
                                onMoveBackward={() => {
                                    setTextNodes(prev => {
                                        const idx = prev.findIndex(t => t.id === selectedId);
                                        if (idx === 0) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
                                        return next;
                                    });
                                }}
                            />
                        );
                    } else if (selectedId.startsWith('sticker_')) {
                        const sticker = stickers.find(s => s.id === selectedId);
                        return (
                            <FloatingImageToolbar
                                sticker={sticker}
                                containerRef={uiContainerRef}
                                position={pos}
                                onChange={(updates) => {
                                    setStickers(prev => prev.map(s => s.id === selectedId ? { ...s, ...updates } : s));
                                    setTimeout(() => triggerExport(), 50);
                                }}
                                onDelete={() => {
                                    setStickers(prev => prev.filter(s => s.id !== selectedId));
                                    setSelectedId(null);
                                    setTimeout(() => triggerExport(), 50);
                                }}
                                onDuplicate={() => {
                                    const s = stickers.find(s => s.id === selectedId);
                                    const ns = { ...s, id: 'sticker_' + Date.now(), x: s.x + 20, y: s.y + 20 };
                                    setStickers(prev => [...prev, ns]);
                                    setSelectedId(ns.id);
                                }}
                                onMoveForward={() => {
                                    setStickers(prev => {
                                        const idx = prev.findIndex(s => s.id === selectedId);
                                        if (idx === prev.length - 1) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                        return next;
                                    });
                                }}
                                onMoveBackward={() => {
                                    setStickers(prev => {
                                        const idx = prev.findIndex(s => s.id === selectedId);
                                        if (idx === 0) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
                                        return next;
                                    });
                                }}
                                onMoveToFront={() => {
                                    setStickers(prev => {
                                        const idx = prev.findIndex(s => s.id === selectedId);
                                        const item = prev[idx];
                                        return [...prev.filter(s => s.id !== selectedId), item];
                                    });
                                }}
                                onMoveToBack={() => {
                                    setStickers(prev => {
                                        const idx = prev.findIndex(s => s.id === selectedId);
                                        const item = prev[idx];
                                        return [item, ...prev.filter(s => s.id !== selectedId)];
                                    });
                                }}
                            />
                        );
                    }
                    return null;
                })()
            )}
        </div>
    );
};


export default PatternZone;
