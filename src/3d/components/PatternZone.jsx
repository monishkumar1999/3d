import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KImage, Transformer, Rect, Text } from "react-konva";
import { X, Trash, Layers, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
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
                width: 400, height: 400, // Larger default for high-res stage
                rotation: 0
            };
            setStickers(prev => [...prev, newSticker]);
            setSelectedId(newSticker.id);
            if (onStickerAdded) onStickerAdded();
            setTimeout(() => triggerExport(), 150);
        };
    }, [stickerUrl]);

    useEffect(() => {
        if (selectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) {
            trRef.current.nodes([]);
        }
    }, [selectedId, stickers]);

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

        layer.draw();

        // 2. Export full natural size
        const uri = stageRef.current.toDataURL({ 
            pixelRatio: 1,
            x: 0,
            y: 0,
            width: maskImg.naturalWidth,
            height: maskImg.naturalHeight
        });

        // 3. Restore visibility
        if (wireframeNode) wireframeNode.show();
        layer.draw();

        // Export if there is ANY content (stickers or text)
        if (stickersRef.current.length > 0 || textNodesRef.current.length > 0) {
            onUpdateTexture(meshName, uri);
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
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`}>
                    {meshName}
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); triggerExport(); }}
                        className="p-1 hover:bg-indigo-50 text-indigo-400 rounded-full border border-transparent hover:border-indigo-200"
                        title="Force Sync 3D"
                    >
                        <Sparkles size={11} />
                    </button>
                    {(stickers.length > 0 || textNodes.length > 0) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setStickers([]);
                                setTextNodes([]);
                                setSelectedId(null);
                                onUpdateTexture(meshName, null);
                            }}
                            className="p-1 hover:bg-red-50 text-red-400 rounded-full border border-transparent hover:border-red-200"
                        >
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
                        onMouseDown={(e) => {
                            if (e.target === e.target.getStage()) setSelectedId(null);
                        }}
                        onMouseUp={() => triggerExport()}
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

                        {/* Stickers */}
                        {stickers.map((s) => (
                            <KImage
                                key={s.id}
                                id={s.id}
                                image={s.image}
                                x={s.x} y={s.y}
                                width={s.width} height={s.height}
                                opacity={s.opacity ?? 1}
                                rotation={s.rotation}
                                draggable
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

                        {/* Text Nodes */}
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
                                draggable
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
                                        [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
                                        return next;
                                    });
                                }}
                                onMoveBackward={() => {
                                    setTextNodes(prev => {
                                        const idx = prev.findIndex(t => t.id === selectedId);
                                        if (idx === 0) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx-1]] = [next[idx-1], next[idx]];
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
                                        [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
                                        return next;
                                    });
                                }}
                                onMoveBackward={() => {
                                    setStickers(prev => {
                                        const idx = prev.findIndex(s => s.id === selectedId);
                                        if (idx === 0) return prev;
                                        const next = [...prev];
                                        [next[idx], next[idx-1]] = [next[idx-1], next[idx]];
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
