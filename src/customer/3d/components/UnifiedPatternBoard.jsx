import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KImage, Group, Rect, Transformer, Text } from "react-konva";
import useStore from "../../store/useStore";

// Helper to load image
const useImage = (url) => {
    const [image, setImage] = useState(null);
    useEffect(() => {
        if (!url) return;
        const img = new window.Image();
        img.src = url;
        img.crossOrigin = "Anonymous";
        img.onload = () => setImage(img);
    }, [url]);
    return image;
};

// Component for a single mesh pattern group (Mask + Label)
const PatternGroup = ({ meshName, maskUrl, layout, onDragMove, onDragEnd, isSelected, onSelect, onLoad, draggable }) => {
    const [maskImg, setMaskImg] = useState(null);

    useEffect(() => {
        if (!maskUrl) return;
        import('../utils/maskProcessor').then(({ processWireframeToSolid }) => {
            processWireframeToSolid(maskUrl).then(dataUrl => {
                const img = new window.Image();
                img.src = dataUrl;
                img.onload = () => setMaskImg(img);
            }).catch(() => {
                const img = new window.Image();
                img.src = maskUrl;
                img.onload = () => setMaskImg(img);
            });
        });
    }, [maskUrl]);

    const baseWidth = 300;

    useEffect(() => {
        if (maskImg && onLoad) {
            const ratio = baseWidth / maskImg.naturalWidth;
            const scale = layout?.scale || ratio;
            const w = maskImg.naturalWidth * scale;
            const h = maskImg.naturalHeight * scale;
            onLoad(w, h); // Notify parent of actual size
        }
    }, [maskImg, onLoad, layout?.scale, baseWidth]);

    if (!maskImg) return null;

    const ratio = baseWidth / maskImg.naturalWidth;

    return (
        <Group
            x={layout?.x || 0}
            y={layout?.y || 0}
            draggable={draggable}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onClick={onSelect}
            onTap={onSelect}
            name={`pattern-${meshName}`}
        >
            {/* Visual "Card" less outline, maybe just the shape? 
                 User wanted "Collection view".
                 We render the mask. */}
            <KImage
                image={maskImg}
                width={maskImg.naturalWidth * (layout?.scale || ratio)}
                height={maskImg.naturalHeight * (layout?.scale || ratio)}
            />

            {/* Label below or on top? */}
            <Text
                text={meshName}
                y={-20}
                fill="#666"
                fontSize={12}
                fontStyle="bold"
                listening={false}
            />
        </Group>
    );
};

// Component for Sticker
const StickerItem = ({ data, onSelect, onChange, isSelected }) => {
    const image = useImage(data.url);
    const shapeRef = useRef(null);
    const trRef = useRef(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    if (!image) return null;

    return (
        <>
            <KImage
                image={image}
                x={data.x}
                y={data.y}
                width={data.width}
                height={data.height}
                rotation={data.rotation}
                draggable
                ref={shapeRef}
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={(e) => {
                    onChange({
                        ...data,
                        x: e.target.x(),
                        y: e.target.y()
                    });
                }}
                onTransformEnd={(e) => {
                    const node = shapeRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange({
                        ...data,
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                        rotation: node.rotation()
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 5 || newBox.height < 5) return oldBox;
                        return newBox;
                    }}
                />
            )}
        </>
    );
};

const UnifiedPatternBoard = ({ mode = 'design' }) => {
    const containerRef = useRef(null);
    const stageRef = useRef(null);

    // Store
    const meshConfig = useStore(s => s.meshConfig);
    const patternLayout = useStore(s => s.patternLayout);
    const updatePatternLayout = useStore(s => s.updatePatternLayout);

    const stickers = useStore(s => s.stickers);
    const updateSticker = useStore(s => s.updateSticker);

    const setAtlasCanvas = useStore(s => s.setAtlasCanvas);
    const notifyAtlasUpdate = useStore(s => s.notifyAtlasUpdate);
    const activeStickerUrl = useStore(s => s.activeStickerUrl); // We will consume this
    const addSticker = useStore(s => s.addSticker);
    const setActiveStickerUrl = useStore(s => s.setActiveStickerUrl);

    const [selectedId, setSelectedId] = useState(null); // sticker ID or pattern ID? Just sticker usually.
    const [dimensions, setDimensions] = useState({ w: 1000, h: 1000 });

    // 1. Init Atlas Canvas
    useEffect(() => {
        if (stageRef.current) {
            const canvas = stageRef.current.content.querySelector('canvas');
            if (canvas) setAtlasCanvas(canvas);
        }
    }, [setAtlasCanvas]);

    // 2. Handle Resize
    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                w: containerRef.current.offsetWidth,
                h: containerRef.current.offsetHeight
            });
        }
    }, []);

    // 3. Consume Active Sticker Upload
    useEffect(() => {
        if (activeStickerUrl && mode === 'design') { // Only allowed in design mode
            const newSticker = {
                id: Date.now().toString(),
                url: activeStickerUrl,
                x: dimensions.w / 2 - 50,
                y: dimensions.h / 2 - 50,
                width: 100,
                height: 100,
                rotation: 0
            };
            addSticker(newSticker);
            setActiveStickerUrl(null); // consume it
            notifyAtlasUpdate();
        }
    }, [activeStickerUrl, dimensions, addSticker, setActiveStickerUrl, notifyAtlasUpdate, mode]);

    // 4. Update Loop
    // Any drag end triggers atlas update
    const handleChange = () => {
        notifyAtlasUpdate();
    };

    // 5. Initial Layout if empty
    useEffect(() => {
        // Simple auto-layout: Grid
        const activeMeshes = Object.keys(meshConfig).filter(k => meshConfig[k].maskUrl);
        let x = 50;
        let y = 50;
        const rowHeight = 350;

        activeMeshes.forEach((mesh, i) => {
            if (!patternLayout[mesh]) {
                updatePatternLayout(mesh, { x, y, scale: 0.3 }); // guessing scale
                x += 320;
                if (x > dimensions.w - 300) {
                    x = 50;
                    y += rowHeight;
                }
            }
        });
    }, [meshConfig, dimensions, patternLayout, updatePatternLayout]);


    return (
        <div className="w-full h-full bg-[#1a1a1a] overflow-hidden" ref={containerRef}>
            <Stage
                width={dimensions.w}
                height={dimensions.h}
                ref={stageRef}
                onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) {
                        setSelectedId(null);
                    }
                }}
            >
                <Layer>
                    {/* Background Table - Transparent to allow CSS background to show */
                        /* and to generate transparent pixels for the 3D texturing logic */
                    }

                    {/* Grid Pattern Only in Layout Mode */}
                    {mode === 'layout' && (
                        <Group listening={false}>
                            {[...Array(20)].map((_, i) => (
                                <Rect key={i} x={i * 100} width={1} height={dimensions.h} fill="#e5e5e5" />
                            ))}
                            {[...Array(20)].map((_, i) => (
                                <Rect key={i} y={i * 100} width={dimensions.w} height={1} fill="#e5e5e5" />
                            ))}
                        </Group>
                    )}

                    {/* Patterns */}
                    {Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl).map(([meshName, cfg]) => (
                        <PatternGroup
                            key={meshName}
                            meshName={meshName}
                            maskUrl={cfg.maskUrl}
                            layout={patternLayout[meshName]}
                            // Interact based on mode
                            // In design mode, we don't want to drag patterns, just see them
                            // onDragMove/End is only for layout update.

                            // NOTE: If we stop dragging, the UVs are locked. Perfect.
                            draggable={mode === 'layout'}

                            onDragMove={(e) => {
                                updatePatternLayout(meshName, { x: e.target.x(), y: e.target.y() });
                                if (mode === 'layout') notifyAtlasUpdate();
                            }}
                            onDragEnd={(e) => {
                                // Update position AND ensured width/height just in case
                                const node = e.target;
                                // We need to know the rendered width/height.
                                // The node is a Group. It doesn't inherently have width/height unless set?
                                // We are scaling the image inside.
                                // Let's rely on the fact that we SET layout.width/height if missing in initial load.
                                updatePatternLayout(meshName, { x: node.x(), y: node.y() });
                                notifyAtlasUpdate();
                            }}
                            onLoad={(width, height) => {
                                // When image loads, update the store with actual dimensions if not set
                                if (!patternLayout[meshName]?.width) {
                                    updatePatternLayout(meshName, { width, height });
                                }
                            }}
                        />
                    ))}

                    {/* Stickers - Layered ON TOP of patterns - Only visible in Design Mode */}
                    {mode === 'design' && stickers.map(sticker => (
                        <StickerItem
                            key={sticker.id}
                            data={sticker}
                            isSelected={selectedId === sticker.id}
                            onSelect={() => setSelectedId(sticker.id)}
                            onChange={(newData) => {
                                updateSticker(sticker.id, newData);
                                notifyAtlasUpdate();
                            }}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};

export default UnifiedPatternBoard;
