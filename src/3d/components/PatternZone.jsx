import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KImage, Transformer, Rect } from "react-konva";
import { X } from "lucide-react";

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
    const [maskImg, setMaskImg] = useState(null);
    const [wireframeImg, setWireframeImg] = useState(null);
    const [stickers, setStickers] = useState([]);
    const stickersRef = useRef(stickers); // ref always has latest stickers
    stickersRef.current = stickers;

    const [selectedId, setSelectedId] = useState(null);
    const trRef = useRef(null);

    // Ratios — computed fresh on every render call but stored in ref for export
    const ratioRef = useRef(1);

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
        const img = new window.Image();
        img.src = stickerUrl;
        img.onload = () => {
            const newSticker = {
                id: Date.now().toString(),
                image: img,
                x: 50, y: 50,
                width: 120, height: 120,
                rotation: 0
            };
            setStickers(prev => [...prev, newSticker]);
            setSelectedId(newSticker.id);
            if (onStickerAdded) onStickerAdded();
            // Export after sticker is placed
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

        // Hide transformer handles for clean export
        if (trRef.current) trRef.current.nodes([]);

        // Force Konva to flush the layer draw so the transformer is truly hidden
        // before we capture the canvas pixel data.
        const layer = stageRef.current.getLayers()[0];
        if (layer) layer.draw();

        const ratio = ratioRef.current;
        const exportRatio = ratio > 0 ? (1 / ratio) : 2;
        const uri = stageRef.current.toDataURL({ pixelRatio: exportRatio });

        // Always export (stickersRef.current is always fresh)
        if (stickersRef.current.length > 0) {
            onUpdateTexture(meshName, uri);
        } else {
            onUpdateTexture(meshName, null);
        }

        // Restore transformer after export
        if (selectedId && trRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer()?.batchDraw(); }
        }
    }, [maskImg, meshName, onUpdateTexture, selectedId]);

    const triggerExport = useStableDebounce(performExport, 250);

    if (!maskImg) return <div className="w-[300px] h-[300px] bg-black rounded-lg border border-zinc-200 animate-pulse" />;

    const maxSize = 340;
    const ratio = Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight);
    ratioRef.current = ratio; // keep ref updated
    const w = maskImg.naturalWidth * ratio;
    const h = maskImg.naturalHeight * ratio;

    return (
        <div className="relative group transition-all duration-300 p-2 z-10" onClick={onClick}>
            {/* Controls above canvas */}
            <div className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-indigo-600' : 'text-zinc-500'}`}>
                    {meshName}
                </span>
                <div className="flex items-center gap-1.5">
                    {stickers.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setStickers([]);
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

            {/* Canvas — always black background */}
            <div
                className={`rounded-lg overflow-hidden transition-all duration-300 bg-black border border-zinc-200 ${isSelected ? 'ring-4 ring-indigo-500 shadow-xl scale-[1.02]' : 'shadow-sm'}`}
                style={{ width: w, height: h }}
            >
                <Stage
                    width={w} height={h}
                    scaleX={ratio} scaleY={ratio}
                    ref={stageRef}
                    onMouseDown={(e) => {
                        if (e.target === e.target.getStage()) setSelectedId(null);
                    }}
                    onMouseUp={() => triggerExport()}
                >
                    <Layer>
                        {/* Always black base */}
                        <Rect
                            width={maskImg.naturalWidth}
                            height={maskImg.naturalHeight}
                            fill="#000000"
                            listening={false}
                        />

                        {/* UV Mesh outline */}
                        {wireframeImg && (
                            <KImage
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
                        {stickers.map((s, i) => (
                            <KImage
                                key={s.id}
                                id={s.id}
                                image={s.image}
                                x={s.x} y={s.y}
                                width={s.width} height={s.height}
                                rotation={s.rotation}
                                draggable
                                onClick={() => setSelectedId(s.id)}
                                onDragMove={() => triggerExport()}
                                onDragEnd={(e) => {
                                    // Use id-based lookup to avoid stale closure on `i`
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
                                    // Reset Konva's internal scale so it doesn't compound on next transform
                                    node.scaleX(1);
                                    node.scaleY(1);
                                    setStickers(prev => prev.map(st =>
                                        st.id === id
                                            ? { ...st, x: node.x(), y: node.y(), width: newW, height: newH, rotation: node.rotation() }
                                            : st
                                    ));
                                    // Delay export slightly so React re-render + Konva reconcile finishes first
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
                            // Do NOT export during mid-transform — scale is not yet normalised.
                            // onTransformEnd handles the final export after normalisation.
                        />
                    </Layer>
                </Stage>
            </div>
        </div>
    );
};


export default PatternZone;
