import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";


import { Stage, Layer, Image as KImage, Text, Transformer, Rect, Group, Line } from "react-konva";
import useImage from 'use-image';
import { X, Copy, Trash, Layers } from 'lucide-react'; // Added Layers icon
import { generateFabricNormalMap } from '../utils/textureUtils';
import FloatingTextToolbar from './FloatingTextToolbar';
import FloatingImageToolbar from './FloatingImageToolbar';
import FloatingMeshToolbar from './FloatingMeshToolbar';
import { useStore } from "../../store/useStore";

const STABLE_EMPTY_ARRAY = [];

const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null);
    return useCallback((...args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => { callback(...args); }, delay);
    }, [callback, delay]);
};

// Refactored to look like a "Sewing Pattern" piece
const PatternZone = ({ meshName, maskUrl, stickerUrl, textToPlace, onUpdateTexture, onUpdateNormal, onUpdateColor, onSelect, fabricType = 'plain', fabricScale = 8, bgColor = "#ffffff", isSelected, onClick, onPlaceSticker, onPlaceText, preview, maxSize = 280, activeSelection }) => {

    const stageRef = useRef(null);
    const normalStageRef = useRef(null); // Parallel stage for normal map
    const [maskImg, setMaskImg] = useState(null);
    const containerRef = useRef(null); // Ref for Portal positioning

    // Initial Layout Setup - Calculated early to avoid ReferenceErrors
    const ratio = useMemo(() => {
        if (!maskImg) return 1;
        return Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight);
    }, [maskImg]);

    const w = useMemo(() => maskImg ? maskImg.naturalWidth * ratio : maxSize, [maskImg, ratio]);
    const h = useMemo(() => maskImg ? maskImg.naturalHeight * ratio : maxSize, [maskImg, ratio]);

    // Global Store - Using selector for stability and performance
    const stickers = useStore(useCallback(state => state.meshStickers[meshName] || STABLE_EMPTY_ARRAY, [meshName]));
    const setMeshStickers = useStore(state => state.setMeshStickers);

    const setStickers = useCallback((newStickersOrFn) => {
        const nextStickers = typeof newStickersOrFn === 'function' ? newStickersOrFn(stickers) : newStickersOrFn;
        setMeshStickers(meshName, nextStickers);
    }, [meshName, setMeshStickers, stickers]);

    const [selectedId, setSelectedId] = useState(null);
    const trRef = useRef(null);

    // Sync selectedId with parent's activeSelection state
    useEffect(() => {
        if (activeSelection?.meshName === meshName) {
            setSelectedId(activeSelection.id);
        } else {
            setSelectedId(null);
        }
    }, [activeSelection, meshName]);

    // Normal map resources
    const [fabricNormalImg, setFabricNormalImg] = useState(null); // The tiled background pattern
    const [guides, setGuides] = useState({ x: null, y: null });

    const handleDragMove = (e) => {
        if (!maskImg) return;
        const node = e.target;

        // Piece Center
        const centerX = maskImg.naturalWidth / 2;
        const centerY = maskImg.naturalHeight / 2;

        // Item bounds (scaled)
        const itemWidth = node.width() * node.scaleX();
        const itemHeight = node.height() * node.scaleY();

        // Item Center
        const itemCenterX = node.x() + itemWidth / 2;
        const itemCenterY = node.y() + itemHeight / 2;

        const SNAP_THRESHOLD = 5;
        let newGuides = { x: null, y: null };

        // Snap X
        if (Math.abs(itemCenterX - centerX) < SNAP_THRESHOLD) {
            node.x(centerX - itemWidth / 2);
            newGuides.x = centerX;
        }

        // Snap Y
        if (Math.abs(itemCenterY - centerY) < SNAP_THRESHOLD) {
            node.y(centerY - itemHeight / 2);
            newGuides.y = centerY;
        }

        setGuides(newGuides);
    };

    useEffect(() => {
        if (!maskUrl) return;

        // Dynamic import to avoid SSR issues if any, though likely fine here.
        import('../utils/maskProcessor').then(({ processWireframeToSolid }) => {
            processWireframeToSolid(maskUrl)
                .then(solidDataUrl => {
                    const img = new window.Image();
                    img.src = solidDataUrl;
                    img.onload = () => setMaskImg(img);
                })
                .catch(err => {
                    // Fallback to original if processing fails
                    // console.error("Auto-fill failed, using original", err);
                    const img = new window.Image();
                    img.src = maskUrl;
                    img.onload = () => setMaskImg(img);
                });
        });
    }, [maskUrl]);

    // Generate/Update Fabric Normal Pattern when fabricType or fabricScale changes
    useEffect(() => {
        const dataUrl = generateFabricNormalMap(512, 512, fabricScale, fabricType);
        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
            // console.log("Fabric Normal Pattern Loaded", { fabricScale, fabricType });
            setFabricNormalImg(img);
        };
    }, [fabricType, fabricScale]);

    const addSticker = useCallback(() => {
        // ...
        // console.log("Adding sticker...", { stickerUrl });
        if (!stickerUrl) return;
        const img = new window.Image();
        img.src = stickerUrl;
        img.onload = () => {
            // console.log("Sticker image loaded", img.naturalWidth, img.naturalHeight);

            // Center the sticker
            const startX = maskImg ? (maskImg.naturalWidth / 2) - 40 : 50;
            const startY = maskImg ? (maskImg.naturalHeight / 2) - 40 : 50;

            const newSticker = {
                id: Date.now().toString(),
                type: 'image',
                image: img,
                url: stickerUrl, // Save the URL for persistence
                x: startX,
                y: startY,
                width: 80,
                height: 80,
                rotation: 0,
                opacity: 1, // Default opacity
                isFlat: false // Default: blend with fabric (false)
            };
            setStickers(prev => [...prev, newSticker]);
            setSelectedId(newSticker.id);
            setTimeout(() => triggerExport(), 100);

            // Notify parent that sticker was placed (to clear active tool)
            // Delay slightly to ensure render cycle catches the new sticker
            setTimeout(() => {
                if (onPlaceSticker) onPlaceSticker();
            }, 100);
        };
        // img.onerror = (err) => console.error("Failed to load sticker image", err);
    }, [maskImg, onPlaceSticker, setStickers, stickerUrl]);

    const addText = useCallback(() => {
        if (!textToPlace) return;

        const startX = maskImg ? (maskImg.naturalWidth / 2) - 50 : 50;
        const startY = maskImg ? (maskImg.naturalHeight / 2) - 20 : 50;

        const newText = {
            id: Date.now().toString(),
            type: 'text',
            text: textToPlace.text,
            fontFamily: textToPlace.fontFamily,
            fill: textToPlace.color,
            fontSize: 40,
            x: startX,
            y: startY,
            rotation: 0,
            opacity: 1,
            scaleX: 1,
            scaleY: 1,
            isFlat: false // Default to fabric texture applied
        };

        setStickers(prev => [...prev, newText]);
        setSelectedId(newText.id);
        setTimeout(() => triggerExport(), 100);

        setTimeout(() => {
            if (onPlaceText) onPlaceText();
        }, 100);
    }, [maskImg, onPlaceText, setStickers, textToPlace]);

    // Auto-add sticker if this zone is selected when a new sticker is uploaded
    useEffect(() => {
        if (stickerUrl && isSelected) {
            addSticker();
        }
    }, [stickerUrl, isSelected]);

    // Auto-add text if this zone is selected
    useEffect(() => {
        if (textToPlace && isSelected) {
            addText();
        }
    }, [textToPlace, isSelected]);

    useEffect(() => {
        if (selectedId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) { trRef.current.nodes([]); }
    }, [selectedId, stickers]);



    // Re-render when fonts are loaded to ensure correct font display
    useEffect(() => {
        document.fonts.ready.then(() => {
            // console.log("Fonts loaded, refreshing canvas...");
            triggerExport();
        });
    }, []);



    const performExport = useCallback(() => {
        if (!stageRef.current || !maskImg) return;
        if (trRef.current) trRef.current.nodes([]);

        const exportRatio = ratio > 0 ? (1 / ratio) : 2;
        const TARGET_MAX_SIZE = 1024;
        const finalExportRatio = Math.min(exportRatio, TARGET_MAX_SIZE / Math.max(w, h));

        const uri = stageRef.current.toDataURL({ pixelRatio: finalExportRatio });
        onUpdateTexture(meshName, uri);

        if (normalStageRef.current && onUpdateNormal) {
            // console.log("Exporting Normal Map for", meshName, "Has FabricImg:", !!fabricNormalImg);
            const normUri = normalStageRef.current.toDataURL({ pixelRatio: finalExportRatio });
            onUpdateNormal(meshName, normUri);
        }

        if (selectedId && trRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) trRef.current.nodes([node]);
        }
    }, [meshName, maskImg, ratio, w, h, onUpdateTexture, onUpdateNormal, fabricNormalImg, selectedId]);
    // OPTIMIZATION: Increased debounce from 200ms to 300ms to allow smoother dragging.
    const triggerExport = useDebounce(performExport, 300);

    useEffect(() => {
        if (maskImg) triggerExport();
    }, [bgColor, maskImg, fabricNormalImg, stickers]); // Re-export if stickers or fabric pattern changes

    const deleteSelected = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!selectedId) return;
        setStickers(prev => prev.filter(s => s.id !== selectedId));
        setSelectedId(null);
        setTimeout(triggerExport, 100);
    };


    const duplicateSticker = (s) => {
        const newSticker = { ...s, id: Date.now().toString(), x: s.x + 20, y: s.y + 20 };
        setStickers(prev => [...prev, newSticker]);
        setSelectedId(newSticker.id);
        setTimeout(() => triggerExport(), 100);
    };

    const moveForward = (id) => {
        setStickers(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1 || index === prev.length - 1) return prev;
            const newArr = [...prev];
            // Swap with next item
            const item = newArr[index];
            newArr[index] = newArr[index + 1];
            newArr[index + 1] = item;
            return newArr;
        });
        setTimeout(triggerExport, 100);
    };

    const moveBackward = (id) => {
        setStickers(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1 || index === 0) return prev;
            const newArr = [...prev];
            // Swap with prev item
            const item = newArr[index];
            newArr[index] = newArr[index - 1];
            newArr[index - 1] = item;
            return newArr;
        });
        setTimeout(triggerExport, 100);
    };

    const moveToFront = (id) => {
        setStickers(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1) return prev;
            const newArr = [...prev];
            const [item] = newArr.splice(index, 1);
            newArr.push(item);
            return newArr;
        });
        setTimeout(triggerExport, 100);
    };

    const moveToBack = (id) => {
        setStickers(prev => {
            const index = prev.findIndex(s => s.id === id);
            if (index === -1) return prev;
            const newArr = [...prev];
            const [item] = newArr.splice(index, 1);
            newArr.unshift(item);
            return newArr;
        });
        setTimeout(triggerExport, 100);
    };

    const flipSticker = (id) => {
        setStickers(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, scaleX: (s.scaleX || 1) * -1 };
            }
            return s;
        }));
        setTimeout(triggerExport, 100);
    };

    if (!maskImg) return <div className="w-[300px] h-[300px] bg-zinc-200 rounded-lg animate-pulse" />;


    return (
        <div
            ref={containerRef}
            className={`relative group transition-all duration-300 ${preview ? 'p-0' : 'p-2'} ${isSelected ? 'z-40' : 'z-10'} ${stickerUrl ? 'cursor-crosshair' : ''}`}
            onClick={onClick}
        >
            {/* Simple Mesh Name & Controls floating above */}
            {/* ... */}

            {/* Floating Toolbar (Text) or Context Menu (Image) */}
            {selectedId && (() => {
                const s = stickers.find(st => st.id === selectedId);
                if (!s || preview) return null;

                // Calculate positions
                const scaledX = s.x * ratio;
                const scaledY = s.y * ratio;
                // ...

                // For text types
                if (s.type === 'text') {
                    // ...
                    const estimatedWidth = (s.width * (s.scaleX || 1)) || (s.text?.length * s.fontSize * 0.5) || 80;
                    const centerOffset = (estimatedWidth * ratio) / 2;

                    return (
                        <FloatingTextToolbar
                            sticker={s}
                            containerRef={containerRef}
                            position={{
                                left: scaledX + centerOffset,
                                top: scaledY
                            }}
                            // ...
                            onChange={(updates) => {
                                setStickers(prev => prev.map(st => st.id === s.id ? { ...st, ...updates } : st));
                                setTimeout(triggerExport, 100);
                            }}
                            onDuplicate={() => duplicateSticker(s)}
                            onDelete={() => {
                                setStickers(prev => prev.filter(st => st.id !== s.id)); // Direct delete call
                                setSelectedId(null);
                                setTimeout(triggerExport, 100);
                            }}
                            onMoveForward={() => moveForward(s.id)}
                            onMoveBackward={() => moveBackward(s.id)}
                        />
                    );
                }

                // Fallback for Images (Now using FloatingImageToolbar)
                // ...
                return (
                    <FloatingImageToolbar
                        sticker={s}
                        containerRef={containerRef}
                        position={{
                            left: (s.x * ratio) + ((s.width * (s.scaleX || 1) * ratio) / 2),
                            top: (s.y * ratio)
                        }}
                        // ...
                        onChange={(updates) => {
                            setStickers(prev => prev.map(st => st.id === s.id ? { ...st, ...updates } : st));
                            setTimeout(triggerExport, 100);
                        }}
                        onDuplicate={() => duplicateSticker(s)}
                        onDelete={deleteSelected}
                        onMoveForward={() => moveForward(s.id)}
                        onMoveBackward={() => moveBackward(s.id)}
                        onMoveToFront={() => moveToFront(s.id)}
                    />
                );
            })()}

            {/* MESH TOOLBAR - Show when mesh is selected but no sticker is selected */}
            {isSelected && !selectedId && !textToPlace && !stickerUrl && !preview && (
                <FloatingMeshToolbar
                    meshName={meshName}
                    currentColor={bgColor}
                    containerRef={containerRef}
                    onColorChange={onUpdateColor}
                    position={{ top: 20, left: w / 2 }} // Center top relative to canvas
                />
            )}

            {/* CANVAS CONTAINER */}
            <div
                className={`rounded-lg overflow-hidden transition-all duration-300 bg-gray-800 ${!preview && isSelected ? (maxSize < 200 ? 'ring-[3px] ring-indigo-500 shadow-lg' : 'ring-4 ring-indigo-500 shadow-xl scale-[1.02]') : ''}`}
                style={{
                    width: w,
                    height: h,
                    position: 'relative',
                    touchAction: preview ? 'auto' : 'none',
                    pointerEvents: preview ? 'none' : 'auto'
                }}
            >
                {/* PRIMARY COLOR STAGE */}
                <Stage
                    width={w} height={h}
                    scaleX={ratio} scaleY={ratio}
                    ref={stageRef}
                    onMouseDown={(e) => {
                        const clickedStage = e.target === e.target.getStage();
                        if (clickedStage) {
                            setSelectedId(null);
                            if (onSelect) onSelect(null);
                        }
                    }}
                    onTouchStart={(e) => {
                        const clickedStage = e.target === e.target.getStage();
                        if (clickedStage) {
                            setSelectedId(null);
                            if (onSelect) onSelect(null);
                        }
                    }}
                    onMouseUp={triggerExport}
                    onTouchEnd={triggerExport}
                    onDragEnd={triggerExport}
                >
                    <Layer>
                        {/* 2. The Pattern Shape Outline/Mask
                            User wants the UV SVG/Pattern to be WHITE.
                            We use the mask to cut out a shape from the bgColor (White).
                            We leave the background TRANSPARENT so it shows up as "Gray" in the editor (due to CSS bg-gray-800).
                            This ensures the White Shirt is visible against the Dark Editor.
                            NOTE: On the 3D model, transparent pixels may render as black depending on the material,
                            but this is the only way to have "White Shirt on Dark Editor" without complex composting.
                        */}
                        <Group>
                            {/* This Rect provides the fabric color (White) */}
                            <Rect
                                width={maskImg.naturalWidth}
                                height={maskImg.naturalHeight}
                                fill={bgColor}
                                listening={true}
                                onClick={() => {
                                    if (stickerUrl) addSticker();
                                    else if (textToPlace) addText();
                                    setSelectedId(null);
                                }}
                                onTap={() => {
                                    if (stickerUrl) addSticker();
                                    else if (textToPlace) addText();
                                    setSelectedId(null);
                                }}
                            />
                            {/* This KImage uses the maskImg (white shape on transparent) to cut out the declared Rect */}
                            <KImage
                                image={maskImg}
                                width={maskImg.naturalWidth}
                                height={maskImg.naturalHeight}
                                listening={false}
                                globalCompositeOperation="destination-in"
                            />
                        </Group>

                        {/* Alignment Guides */}
                        {guides.x !== null && (
                            <Line
                                points={[guides.x, 0, guides.x, maskImg.naturalHeight]}
                                stroke="#4f46e5"
                                strokeWidth={1}
                                dash={[4, 4]}
                                listening={false}
                            />
                        )}
                        {guides.y !== null && (
                            <Line
                                points={[0, guides.y, maskImg.naturalWidth, guides.y]}
                                stroke="#4f46e5"
                                strokeWidth={1}
                                dash={[4, 4]}
                                listening={false}
                            />
                        )}

                        {/* Stickers / Text */}
                        {stickers.map((s, i) => {
                            if (s.type === 'text') {
                                return (
                                    <Text
                                        key={s.id}
                                        id={s.id}
                                        text={s.text}
                                        fontFamily={s.fontFamily}
                                        fill={s.fill}
                                        fontSize={s.fontSize}
                                        x={s.x}
                                        y={s.y}
                                        opacity={s.opacity ?? 1}
                                        rotation={s.rotation}
                                        scaleX={s.scaleX}
                                        scaleY={s.scaleY}
                                        draggable
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            setSelectedId(s.id);
                                            if (onSelect) onSelect({ ...s, meshName });
                                        }}
                                        onTap={(e) => {
                                            e.cancelBubble = true;
                                            setSelectedId(s.id);
                                            if (onSelect) onSelect({ ...s, meshName });
                                        }}
                                        onTransformEnd={(e) => {
                                            const node = e.target;
                                            const newStickers = [...stickers];
                                            newStickers[i] = {
                                                ...newStickers[i],
                                                x: node.x(), y: node.y(),
                                                rotation: node.rotation(),
                                                scaleX: node.scaleX(),
                                                scaleY: node.scaleY()
                                            };
                                            // Don't reset scale for text, as it affects font size rendering
                                            setStickers(newStickers);
                                            triggerExport();
                                        }}
                                        onDragMove={handleDragMove}
                                        onDragEnd={(e) => {
                                            const node = e.target;
                                            setGuides({ x: null, y: null });
                                            const newStickers = [...stickers];
                                            newStickers[i] = { ...newStickers[i], x: node.x(), y: node.y() };
                                            setStickers(newStickers);
                                            triggerExport();
                                        }}
                                    />
                                );
                            }
                            // Check if image handles are valid before rendering KImage
                            if (!s.image) return null;

                            return (
                                <KImage
                                    key={s.id} id={s.id} image={s.image} x={s.x} y={s.y} width={s.width} height={s.height} opacity={s.opacity ?? 1} rotation={s.rotation} draggable
                                    onClick={(e) => {
                                        e.cancelBubble = true;
                                        setSelectedId(s.id);
                                        if (onSelect) onSelect({ ...s, meshName });
                                    }}
                                    onTap={(e) => {
                                        e.cancelBubble = true;
                                        setSelectedId(s.id);
                                        if (onSelect) onSelect({ ...s, meshName });
                                    }}

                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        const newStickers = [...stickers];
                                        newStickers[i] = {
                                            ...newStickers[i],
                                            x: node.x(), y: node.y(),
                                            rotation: node.rotation(),
                                            width: node.width() * node.scaleX(),
                                            height: node.height() * node.scaleY()
                                        };
                                        node.scaleX(1); node.scaleY(1);
                                        // Preserve flip state if it was flipped (negative scaleX)
                                        // But Konva transformer might have normalized it. 
                                        // For Flip to persist, we should probably apply negative width/height or keep scaleX negative.
                                        // Simplified approach: Just save width/height and reset scale, 
                                        // BUT if we want to support Flip, we need to respect the sign of scaleX.

                                        // Logic fix: Don't force reset scale to 1 if we want to support flips
                                        // UNLESS we want to support flip.
                                        // If we support flip via scaleX, we shouldn't reset scaleX to 1 blindly.

                                        // BETTER APPROACH for persisted flip:
                                        // Just save x, y, rotation, and usage of scaleX/scaleY directly.
                                        // Don't bake scale into width/height.

                                        // Reverting to saving scale instead of baking it:
                                        newStickers[i] = {
                                            ...newStickers[i],
                                            x: node.x(), y: node.y(),
                                            rotation: node.rotation(),
                                            scaleX: node.scaleX(),
                                            scaleY: node.scaleY()
                                            // width/height remain constant base size
                                        };
                                        // Do NOT reset node scale here, let React update it via props
                                        setStickers(newStickers);
                                        triggerExport();
                                    }}
                                    onDragMove={handleDragMove}
                                    onDragEnd={(e) => {
                                        const node = e.target;
                                        setGuides({ x: null, y: null });
                                        const newStickers = [...stickers];
                                        newStickers[i] = { ...newStickers[i], x: node.x(), y: node.y() };
                                        setStickers(newStickers);
                                        triggerExport();
                                    }}
                                />
                            );
                        })}

                        {/* Selection Guide */}
                        <Transformer
                            ref={trRef}
                            borderStroke="#4f46e5" anchorStroke="#4f46e5" anchorFill="#ffffff" anchorSize={8} borderDash={[2, 2]}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                return newBox;
                            }}
                        />
                    </Layer>
                </Stage>

                {/* HIDDEN NORMAL MAP STAGE */}
                {/* We render this to perform the "bake" but show it hidden via CSS */}
                <div style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }}>
                    <Stage
                        width={w} height={h}
                        scaleX={ratio} scaleY={ratio}
                        ref={normalStageRef}
                    >
                        <Layer>
                            <Group>
                                {/* 1. The Fabric Background Pattern */}
                                {/* We fill the shape with the normal map pattern */}
                                <Rect
                                    width={maskImg.naturalWidth}
                                    height={maskImg.naturalHeight}
                                    fill={fabricNormalImg ? null : "#8080ff"} // Fallback to flat normal if loading
                                    fillPatternImage={fabricNormalImg}
                                    fillPatternRepeat="repeat"
                                    listening={false}
                                />
                                {/* Cut out mask shape */}
                                <KImage
                                    image={maskImg}
                                    width={maskImg.naturalWidth}
                                    height={maskImg.naturalHeight}
                                    listening={false}
                                    globalCompositeOperation="destination-in"
                                />
                            </Group>

                            {/* 2. The Stickers (ONLY IF isFlat is TRUE) */}
                            {/* If isFlat is true, we render the sticker as a solid #8080ff shape.
                                This "patches" the normal map, hiding the fabric texture underneath. */}
                            {stickers.map(s => {
                                if (!s.isFlat) return null;

                                if (s.type === 'text') {
                                    return (
                                        <Text
                                            key={s.id}
                                            {...s}
                                            fill="#8080ff" // Flat Normal Color
                                            listening={false}
                                        />
                                    );
                                } else {
                                    // For Images: Use Helper to Cache and Mask
                                    return <FlatImageSticker key={s.id} sticker={s} />;
                                }
                            })}
                        </Layer>
                    </Stage>
                </div>
            </div>
        </div >
    );
};

// Sub-component to handle isolated masking for Flat Images
const FlatImageSticker = ({ sticker }) => {
    const groupRef = React.useRef(null);

    React.useEffect(() => {
        if (groupRef.current) {
            groupRef.current.cache();
        }
    }, [sticker]);

    return (
        <Group
            ref={groupRef}
            x={sticker.x} y={sticker.y}
            rotation={sticker.rotation}
            scaleX={sticker.scaleX}
            scaleY={sticker.scaleY}
            width={sticker.width}
            height={sticker.height}
        >
            <KImage
                image={sticker.image}
                width={sticker.width}
                height={sticker.height}
                listening={false}
            />
            <Rect
                width={sticker.width}
                height={sticker.height}
                fill="#8080ff"
                listening={false}
                globalCompositeOperation="source-in"
            />
        </Group>
    );
};

export default PatternZone;
