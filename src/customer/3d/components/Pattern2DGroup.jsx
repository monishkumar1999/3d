import React, { useState, useRef, useEffect, useCallback } from "react";
import { Group, Image as KImage, Transformer, Rect } from "react-konva";
import { Html } from "react-konva-utils";
import { X, Trash, Copy } from "lucide-react";

// Helper for debounce
const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null);
    return useCallback((...args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => { callback(...args); }, delay);
    }, [callback, delay]);
};

const Pattern2DGroup = ({
    x,
    y,
    meshName,
    maskUrl,
    stickerUrl,
    activeStickerUrl, // passed from parent to know if we are in "add mode"
    onUpdateTexture,
    bgColor = "#ffffff",
    helperText = true
}) => {
    const groupRef = useRef(null);
    const trRef = useRef(null);
    const [maskImg, setMaskImg] = useState(null);
    const [stickers, setStickers] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    // -- 1. Load Mask Image --
    useEffect(() => {
        if (!maskUrl) return;
        import('../utils/maskProcessor').then(({ processWireframeToSolid }) => {
            processWireframeToSolid(maskUrl)
                .then(solidDataUrl => {
                    const img = new window.Image();
                    img.src = solidDataUrl;
                    img.onload = () => setMaskImg(img);
                })
                .catch(err => {
                    console.error("Mask load failed", err);
                    const img = new window.Image();
                    img.src = maskUrl;
                    img.onload = () => setMaskImg(img);
                });
        });
    }, [maskUrl]);

    // -- 2. Texture Export Logic --
    const performExport = () => {
        if (!groupRef.current || !maskImg) return;

        const trNode = trRef.current;
        if (trNode) trNode.visible(false); // Hide for snapshot

        const uri = groupRef.current.toDataURL({
            pixelRatio: 1, // Since group is true size
        });

        if (trNode) trNode.visible(true); // Restore visibility

        onUpdateTexture(meshName, uri);
    };

    const triggerExport = useDebounce(performExport, 300);

    // Initial Export when mask loads
    useEffect(() => {
        if (maskImg) triggerExport();
    }, [maskImg, bgColor]);

    // -- 3. Sticker Logic --

    // Add Sticker
    const addSticker = () => {
        if (!stickerUrl) return; // Verify we have a sticker to add
        const img = new window.Image();
        img.src = stickerUrl;
        img.onload = () => {
            // Unselect others
            setSelectedId(null);

            // Center in the group roughly
            const cx = maskImg ? maskImg.naturalWidth / 2 : 100;
            const cy = maskImg ? maskImg.naturalHeight / 2 : 100;

            const newSticker = {
                id: Date.now().toString(),
                image: img,
                x: cx - 50,
                y: cy - 50,
                width: 100,
                height: 100,
                rotation: 0
            };

            setStickers(prev => [...prev, newSticker]);
            setSelectedId(newSticker.id);
            setTimeout(triggerExport, 100);
        };
    };

    // Handle Selection & Transformer
    useEffect(() => {
        if (selectedId && trRef.current && groupRef.current) {
            const node = groupRef.current.findOne('#' + selectedId);
            if (node) {
                trRef.current.nodes([node]);
                trRef.current.getLayer().batchDraw();
            }
        } else if (trRef.current) {
            trRef.current.nodes([]);
            trRef.current.getLayer().batchDraw();
        }
    }, [selectedId, stickers]);

    const deleteSticker = (id) => {
        setStickers(prev => prev.filter(s => s.id !== id));
        setSelectedId(null);
        setTimeout(triggerExport, 100);
    };

    const duplicateSticker = (s) => {
        const newSticker = { ...s, id: Date.now().toString(), x: s.x + 20, y: s.y + 20 };
        setStickers(prev => [...prev, newSticker]);
        setSelectedId(newSticker.id);
        setTimeout(triggerExport, 100);
    };

    if (!maskImg) return null; // Or a placeholder rect?

    // Group Size = Mask Natural Size
    const w = maskImg.naturalWidth;
    const h = maskImg.naturalHeight;

    return (
        <Group
            x={x}
            y={y}
            ref={groupRef}
            // If the user clicks on the group background, deselect active sticker
            onClick={(e) => {
                // If clicked on the background rect (not a sticker)
                if (e.target.hasName('bg-rect')) {
                    setSelectedId(null);
                }
            }}
            onTap={(e) => {
                if (e.target.hasName('bg-rect')) {
                    setSelectedId(null);
                }
            }}
        >
            {/* Visual Label Above/Below? - We'll put it slightly above the pattern piece using Text or Html */}
            {helperText && (
                <Html divProps={{ style: { pointerEvents: 'none', transform: 'translate(0, -30px)' } }}>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap px-2">
                        {meshName.replace(/_/g, ' ')}
                    </div>
                </Html>
            )}

            {/* 1. Fabric Base (Clipped to Shape) */}
            <Group>
                <Rect
                    name="bg-rect"
                    width={w}
                    height={h}
                    fill={bgColor}
                />
                <KImage
                    image={maskImg}
                    width={w}
                    height={h}
                    globalCompositeOperation="destination-in"
                    listening={false} // Pass through clicks to Rect
                />
            </Group>

            {/* 2. Stickers */}
            {stickers.map((s, i) => (
                <KImage
                    key={s.id}
                    id={s.id}
                    image={s.image}
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    rotation={s.rotation}
                    draggable
                    onClick={() => setSelectedId(s.id)}
                    onTap={() => setSelectedId(s.id)}
                    onTransformEnd={(e) => {
                        const node = e.target;
                        const newStickers = [...stickers];
                        newStickers[i] = {
                            ...newStickers[i],
                            x: node.x(),
                            y: node.y(),
                            width: Math.max(5, node.width() * node.scaleX()),
                            height: Math.max(5, node.height() * node.scaleY()),
                            rotation: node.rotation()
                        };
                        node.scaleX(1);
                        node.scaleY(1);
                        setStickers(newStickers);
                        triggerExport();
                    }}
                />
            ))}

            {/* 3. Selection UI */}
            <Transformer
                ref={trRef}
                borderStroke="#4f46e5"
                anchorStroke="#4f46e5"
                anchorFill="#ffffff"
                anchorSize={10}
                borderDash={[4, 4]}
                rotationSnaps={[0, 90, 180, 270]}
            />

            {/* 4. Context Menu (Using Html overlay) */}
            {selectedId && (() => {
                const s = stickers.find(st => st.id === selectedId);
                if (!s) return null;

                // Position relative to the sticker
                return (
                    <Html groupProps={{ x: s.x + s.width, y: s.y }}>
                        <div className="absolute top-0 left-2 w-32 bg-white rounded-lg shadow-xl border border-zinc-100 p-1 flex flex-col gap-1 z-[100]">
                            <button
                                onClick={(e) => { e.stopPropagation(); duplicateSticker(s); }}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 rounded transition-colors text-left"
                            >
                                <Copy size={12} /> Duplicate
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteSticker(s.id); }}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded transition-colors text-left"
                            >
                                <Trash size={12} /> Delete
                            </button>
                        </div>
                    </Html>
                );
            })()}

        </Group>
    );
};

export default Pattern2DGroup;
