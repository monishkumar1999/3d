import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center, ContactShadows, Environment } from '@react-three/drei';
import { Stage, Layer, Image as KImage, Transformer, Rect, Group, Text } from 'react-konva';
import { Upload, Palette, Image as ImageIcon, X, Save, Camera, Layers, RotateCcw, RotateCw, Trash, Menu, Eye, EyeOff, Plus, Check, Settings, Lightbulb, Sun, Building2, Cloud, Trees, Moon, Sunset, Scan, Type, ChevronLeft, Maximize, MousePointer2, Hand, ZoomIn, ZoomOut, RotateCw as RotateCwIcon, Eye as EyeIcon, Wand2 } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

import FloatingTextToolbar from '../../3d/components/FloatingTextToolbar';
import FloatingImageToolbar from '../../3d/components/FloatingImageToolbar';
import api from '../../api/axios';


// ── Color Presets ──
const COLOR_PRESETS = [
    '#ffffff', '#e2e8f0', '#94a3b8', '#1e293b',
    '#dc2626', '#f97316', '#f59e0b', '#22c55e',
    '#2563eb', '#7c3aed', '#ec4899', '#be185d',
];

// Texture export target (balanced): good clarity without making the editor sluggish.
const MIN_EXPORT_LONGEST_EDGE = 2048;
const MAX_EXPORT_LONGEST_EDGE = 4096;
const PREVIEW_INITIAL_STAGE_SCALE = 0.56;
const MIN_TEXTURE_REPEAT = 0.25;
const MAX_TEXTURE_REPEAT = 200;
const DEFAULT_MATERIAL_SETTINGS = {
    roughness: 0.5,
    sheen: 0.2,
    normalIntensity: 1,
    textureRepeat: 1,
};
const EMPTY_PBR_TEXTURES = {
    baseColor: null,
    normal: null,
    roughness: null,
    metalness: null,
    ao: null,
    orm: null,
};
const PBR_MAP_SLOTS = [
    { key: 'baseColor', label: 'Base', hint: 'Albedo / color' },
    { key: 'normal', label: 'Normal', hint: 'Surface detail' },
    { key: 'roughness', label: 'Rough', hint: 'Gloss control' },
    { key: 'metalness', label: 'Metal', hint: 'Metal mask' },
    { key: 'ao', label: 'AO', hint: 'Ambient occlusion' },
    { key: 'orm', label: 'ORM', hint: 'Packed AO/R/M' },
];

const loadImageElement = (src) => new Promise((resolve, reject) => {
    if (!src) {
        resolve(null);
        return;
    }

    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
});

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file?.name || 'unknown'}`));
    reader.readAsDataURL(file);
});

const clampTextureRepeat = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 1;
    return Math.min(MAX_TEXTURE_REPEAT, Math.max(MIN_TEXTURE_REPEAT, numericValue));
};

const formatTextureRepeat = (value) => {
    const safeValue = clampTextureRepeat(value);
    if (safeValue >= 1) {
        return Number.isInteger(safeValue) ? `${safeValue}` : safeValue.toFixed(1).replace(/\.0$/, '');
    }
    return safeValue.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
};

const normalizeAiImageSource = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(data:image\/|blob:|https?:\/\/|\/)/i.test(trimmed)) return trimmed;

    const compact = trimmed.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 64) {
        return `data:image/png;base64,${compact}`;
    }

    return null;
};

const extractAiImageSource = (payload) => {
    const candidates = [
        payload,
        payload?.textureUrl,
        payload?.image,
        payload?.imageUrl,
        payload?.localUrl,
        payload?.url,
        payload?.generatedImage,
        payload?.result?.image,
        payload?.result?.imageUrl,
        payload?.result?.localUrl,
        payload?.data?.textureUrl,
        payload?.data?.image,
        payload?.data?.imageUrl,
        payload?.data?.localUrl,
        Array.isArray(payload?.images) ? payload.images[0] : null,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeAiImageSource(candidate);
        if (normalized) return normalized;
    }

    return null;
};

// ── Hex ↔ RGB helpers ──
const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 255, g: 255, b: 255 };
};

// ── HSV ↔ RGB/Hex helpers ──
const hsvToRgb = (h, s, v) => {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const rgbToHsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) { h = 0; }
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, v };
};

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

const hexToHsv = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsv(r, g, b);
};

// ═══════════════════════════════════════════
// ── Face Color Popup ──
// ═══════════════════════════════════════════
const FaceColorPopup = React.memo(({ position, currentColor, onColorChange, onClose }) => {
    const popupRef = useRef(null);
    const satValRef = useRef(null);
    const hueRef = useRef(null);

    const initial = hexToHsv(currentColor || '#ffffff');
    const [hue, setHue] = useState(initial.h);
    const [sat, setSat] = useState(initial.s);
    const [val, setVal] = useState(initial.v);
    const [hexInput, setHexInput] = useState(currentColor || '#ffffff');
    const [isDraggingSV, setIsDraggingSV] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);

    const isFirstMount = useRef(true);

    // Sync hex input on hue/sat/val change
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        const { r, g, b } = hsvToRgb(hue, sat, val);
        const hex = rgbToHex(r, g, b);
        setHexInput(hex);
        onColorChange(hex);
    }, [hue, sat, val]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // ── SatVal picker mouse handlers ──
    const handleSatValMove = useCallback((e) => {
        if (!satValRef.current) return;
        const rect = satValRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setSat(x);
        setVal(1 - y);
    }, []);

    useEffect(() => {
        if (!isDraggingSV) return;
        const up = () => setIsDraggingSV(false);
        window.addEventListener('mousemove', handleSatValMove);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', handleSatValMove); window.removeEventListener('mouseup', up); };
    }, [isDraggingSV, handleSatValMove]);

    // ── Hue slider mouse handlers ──
    const handleHueMove = useCallback((e) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setHue(x);
    }, []);

    useEffect(() => {
        if (!isDraggingHue) return;
        const up = () => setIsDraggingHue(false);
        window.addEventListener('mousemove', handleHueMove);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', handleHueMove); window.removeEventListener('mouseup', up); };
    }, [isDraggingHue, handleHueMove]);

    const handleHexSubmit = (val) => {
        const clean = val.startsWith('#') ? val : '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
            const hsv = hexToHsv(clean);
            setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
        }
        setHexInput(clean);
    };

    const hueColor = rgbToHex(...Object.values(hsvToRgb(hue, 1, 1)));
    const currentRgb = hsvToRgb(hue, sat, val);
    const displayHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

    // Position the popup near the click, but keep it on screen
    const popupWidth = 280;
    const popupHeight = 350; // Approximated max height of the popup

    // Safety bounds ensuring the popup always stays completely visible inside the window
    const safeLeft = Math.max(16, Math.min(position.x || 0, window.innerWidth - popupWidth - 16));
    const safeTop = Math.max(16, Math.min(position.y || 0, window.innerHeight - popupHeight - 16));

    const style = {
        position: 'fixed', // Fixed instead of absolute makes it immune to scrolling parents
        left: safeLeft,
        top: safeTop,
        zIndex: 9999, // Ensure it's above everything
    };

    return (
        <div ref={popupRef} style={style} className="w-[280px] bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden select-none"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-600" style={{ backgroundColor: displayHex }} />
                    <span className="text-sm font-semibold text-white">Face color</span>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 space-y-3">
                {/* Preset swatches */}
                <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                        <button
                            key={c}
                            onClick={() => handleHexSubmit(c)}
                            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${displayHex === c ? 'border-white scale-110' : 'border-zinc-600 hover:border-zinc-400'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>

                <div className="h-px bg-zinc-700" />

                {/* Saturation / Value gradient box */}
                <div
                    ref={satValRef}
                    className="relative w-full h-[160px] rounded-lg cursor-crosshair overflow-hidden"
                    style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
                    onMouseDown={(e) => { setIsDraggingSV(true); handleSatValMove(e); }}
                >
                    <div
                        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                        style={{
                            left: `${sat * 100}%`, top: `${(1 - val) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: displayHex,
                        }}
                    />
                </div>

                {/* Hue slider */}
                <div
                    ref={hueRef}
                    className="relative w-full h-3 rounded-full cursor-pointer"
                    style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
                    onMouseDown={(e) => { setIsDraggingHue(true); handleHueMove(e); }}
                >
                    <div
                        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                        style={{
                            left: `${hue * 100}%`, top: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: hueColor,
                        }}
                    />
                </div>

                {/* Hex input */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full border-2 border-zinc-600 flex-shrink-0" style={{ backgroundColor: displayHex }} />
                    <input
                        className="flex-1 bg-zinc-800 text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-600 focus:border-indigo-500 outline-none font-mono"
                        value={hexInput}
                        onChange={(e) => handleHexSubmit(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
});


// ═══════════════════════════════════════════
// ── Flood Fill ──
// ═══════════════════════════════════════════
const floodFill = (ctx, startX, startY, fillColor, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const sx = Math.round(startX), sy = Math.round(startY);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

    const startIdx = (sy * width + sx) * 4;
    const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];

    if (startA < 10) return;
    if (startR === fillColor.r && startG === fillColor.g && startB === fillColor.b) return;

    const tolerance = 30;
    const matchesStart = (idx) =>
        Math.abs(data[idx] - startR) <= tolerance &&
        Math.abs(data[idx + 1] - startG) <= tolerance &&
        Math.abs(data[idx + 2] - startB) <= tolerance &&
        data[idx + 3] > 10;

    const stack = [[sx, sy]];
    const visited = new Set();

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = y * width + x;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited.has(key)) continue;
        visited.add(key);
        const idx = key * 4;
        if (!matchesStart(idx)) continue;
        data[idx] = fillColor.r;
        data[idx + 1] = fillColor.g;
        data[idx + 2] = fillColor.b;
        data[idx + 3] = 255;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
};

// ═══════════════════════════════════════════
// ── Generate Panel Outline (stroke highlight) ──
// ═══════════════════════════════════════════
const generatePanelOutline = (sourceCanvas, startX, startY) => {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const sx = Math.round(startX), sy = Math.round(startY);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return null;

    const srcCtx = sourceCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, width, height).data;

    const startIdx = (sy * width + sx) * 4;
    const startR = srcData[startIdx], startG = srcData[startIdx + 1], startB = srcData[startIdx + 2], startA = srcData[startIdx + 3];
    if (startA < 10) return null;

    // Flood fill to find the region
    const tolerance = 30;
    const matchesStart = (idx) =>
        Math.abs(srcData[idx] - startR) <= tolerance &&
        Math.abs(srcData[idx + 1] - startG) <= tolerance &&
        Math.abs(srcData[idx + 2] - startB) <= tolerance &&
        srcData[idx + 3] > 10;

    const regionSet = new Set();
    const stack = [[sx, sy]];
    const visited = new Set();

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = y * width + x;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited.has(key)) continue;
        visited.add(key);
        const idx = key * 4;
        if (!matchesStart(idx)) continue;
        regionSet.add(key);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Create outline canvas — draw edge pixels with a thick stroke
    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d');
    const outImageData = outCtx.createImageData(width, height);
    const outData = outImageData.data;

    const strokeWidth = 6;
    for (const key of regionSet) {
        const x = key % width;
        const y = Math.floor(key / width);
        // Check if this pixel is on an edge (any neighbor NOT in region)
        const isEdge =
            !regionSet.has((y - 1) * width + x) ||
            !regionSet.has((y + 1) * width + x) ||
            !regionSet.has(y * width + (x - 1)) ||
            !regionSet.has(y * width + (x + 1));

        if (isEdge) {
            // Draw a thicker stroke by filling nearby pixels
            for (let dy = -strokeWidth; dy <= strokeWidth; dy++) {
                for (let dx = -strokeWidth; dx <= strokeWidth; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const oi = (ny * width + nx) * 4;
                        outData[oi] = 37;      // R (blue #2563eb)
                        outData[oi + 1] = 99;  // G
                        outData[oi + 2] = 235; // B
                        outData[oi + 3] = 255; // A
                    }
                }
            }
        }
    }

    outCtx.putImageData(outImageData, 0, 0);
    return outCanvas.toDataURL('image/png');
};


// ═══════════════════════════════════════════
// ── Debounce Hook ──
// ═══════════════════════════════════════════
const useDebounce = (callback, delay) => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback; // always keep ref up to date
    const timeoutRef = useRef(null);
    return useCallback((...args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }, [delay]); // no dependency on callback — ref handles it
};

const buildTintedBaseCanvas = (sourceCanvas, tintHex) => {
    if (!sourceCanvas) return null;

    const workingCanvas = document.createElement('canvas');
    workingCanvas.width = sourceCanvas.width;
    workingCanvas.height = sourceCanvas.height;
    const workingCtx = workingCanvas.getContext('2d', { willReadFrequently: true });
    workingCtx.drawImage(sourceCanvas, 0, 0);

    if (tintHex && tintHex.toLowerCase() !== '#ffffff') {
        const imageData = workingCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
        const data = imageData.data;
        const tint = hexToRgb(tintHex);
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10 && data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) {
                data[i] = tint.r;
                data[i + 1] = tint.g;
                data[i + 2] = tint.b;
            }
        }
        workingCtx.putImageData(imageData, 0, 0);
    }

    return workingCanvas;
};

const buildRepeatedTextureCanvas = ({ image, width, height, repeat = 1 }) => {
    if (!image || !width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    const safeRepeat = clampTextureRepeat(repeat);
    const tileWidth = width / safeRepeat;
    const tileHeight = height / safeRepeat;
    const columns = Math.max(1, Math.ceil(safeRepeat));
    const rows = Math.max(1, Math.ceil(safeRepeat));
    const offsetX = (width - (columns * tileWidth)) / 2;
    const offsetY = (height - (rows * tileHeight)) / 2;

    for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
            ctx.drawImage(
                image,
                offsetX + (x * tileWidth),
                offsetY + (y * tileHeight),
                tileWidth,
                tileHeight
            );
        }
    }

    return canvas;
};

const composeTextureDataUrl = ({ overlayCanvas, tintedBaseCanvas, pbrBaseCanvas, width, height }) => {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const ctx = compositeCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    if (pbrBaseCanvas) {
        ctx.drawImage(pbrBaseCanvas, 0, 0, width, height);

        if (tintedBaseCanvas) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(tintedBaseCanvas, 0, 0, width, height);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(tintedBaseCanvas, 0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';
        }
    } else if (tintedBaseCanvas) {
        ctx.drawImage(tintedBaseCanvas, 0, 0, width, height);
    }

    if (overlayCanvas) {
        // Keep decals/text crisp while allowing the fabric texture underneath to be filtered smoothly.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(overlayCanvas, 0, 0, width, height);
    }

    return compositeCanvas.toDataURL('image/png');
};

const PbrTextureUploader = React.memo(({ pbrTextures, materialSettings, onUpload, onClear, onClearAll, onMaterialSettingChange }) => {
    const hasAnyPbrMaps = PBR_MAP_SLOTS.some(({ key }) => Boolean(pbrTextures[key]));

    return (
        <div className="space-y-4 pt-4 border-t border-zinc-100">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">PBR Maps</p>
                    <p className="text-[11px] leading-5 text-zinc-500">Upload your PBR PNG maps and they will apply live on the 3D model.</p>
                </div>
                {hasAnyPbrMaps && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="shrink-0 text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                {PBR_MAP_SLOTS.map(({ key, label, hint }) => {
                    const currentFile = pbrTextures[key];
                    return (
                        <label
                            key={key}
                            className="group cursor-pointer rounded-2xl border border-zinc-200 bg-zinc-50/70 hover:bg-white hover:border-zinc-300 transition-all"
                        >
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => onUpload(key, e)}
                                className="hidden"
                            />
                            <div className="p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">{label}</span>
                                    {currentFile ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onClear(key);
                                            }}
                                            className="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    ) : (
                                        <span className="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-colors">
                                            <Upload size={12} />
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{hint}</p>
                                <p className="text-[11px] font-medium text-zinc-500 truncate">
                                    {currentFile?.name || 'Click to upload'}
                                </p>
                            </div>
                        </label>
                    );
                })}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Texture Repeat</span>
                    <span className="text-[10px] font-semibold text-zinc-500">{formatTextureRepeat(materialSettings.textureRepeat || 1)}x</span>
                </div>
                <input
                    type="range"
                    min={MIN_TEXTURE_REPEAT}
                    max={MAX_TEXTURE_REPEAT}
                    step="0.25"
                    value={materialSettings.textureRepeat || 1}
                    onChange={(e) => onMaterialSettingChange('textureRepeat', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none accent-indigo-500"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Normal Strength</span>
                    <span className="text-[10px] font-semibold text-zinc-500">{(materialSettings.normalIntensity || 1).toFixed(1)}x</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={materialSettings.normalIntensity || 1}
                    onChange={(e) => onMaterialSettingChange('normalIntensity', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none accent-indigo-500"
                />
            </div>
        </div>
    );
});

const compressCaptureImage = (base64Str, maxWidth = 768) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = maxWidth / img.width;
            const finalScale = scale < 1 ? scale : 1;

            canvas.width = Math.max(1, Math.round(img.width * finalScale));
            canvas.height = Math.max(1, Math.round(img.height * finalScale));

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
    });
};


// ═══════════════════════════════════════════
// ── 3D Model Viewer (preserves original GLB textures) ──
// ═══════════════════════════════════════════
const ModelViewer = React.memo(React.forwardRef(({ modelUrl, textureDataUrl, flatMaskUrl, materialSettings, baseColor, pbrTextures, onReady }, ref) => {
    const [model, setModel] = useState(null);
    const managedTexturesRef = useRef([]);
    const { gl } = useThree();

    React.useImperativeHandle(ref, () => ({
        scene: model
    }), [model]);

    useEffect(() => {
        return () => {
            managedTexturesRef.current.forEach((texture) => texture?.dispose?.());
            managedTexturesRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!modelUrl) { setModel(null); return; }
        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => {
            const scene = gltf.scene;
            // Save original materials so we can always clone from them
            scene.traverse((child) => {
                if (child.isMesh) {
                    if (!child.userData.originalMat) {
                        child.userData.originalMat = Array.isArray(child.material)
                            ? child.material.map(m => m.clone())
                            : child.material.clone();
                    }
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            setModel(scene);
            onReady?.();
        }, undefined, (err) => {
            console.error('GLB Error:', err);
            onReady?.();
        });
    }, [modelUrl, onReady]);

    // Apply texture, material settings, and base color while preserving original material properties
    useEffect(() => {
        if (!model) return;

        let cancelled = false;
        const textureRepeat = clampTextureRepeat(materialSettings.textureRepeat || 1);
        const normalIntensity = materialSettings.normalIntensity ?? 1;

        const disposeManagedTextures = () => {
            managedTexturesRef.current.forEach((texture) => texture?.dispose?.());
            managedTexturesRef.current = [];
        };

        const registerTexture = (texture) => {
            managedTexturesRef.current.push(texture);
            return texture;
        };

        const createTexture = (image, { colorSpace = null, repeat = 1 } = {}) => {
            if (!image) return null;

            const texture = new THREE.Texture(image);
            texture.flipY = false;
            if (colorSpace) texture.colorSpace = colorSpace;
            texture.anisotropy = gl.capabilities.getMaxAnisotropy();
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            const safeRepeat = clampTextureRepeat(repeat);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(safeRepeat, safeRepeat);
            if (safeRepeat < 1) {
                const centeredOffset = (1 - safeRepeat) / 2;
                texture.offset.set(centeredOffset, centeredOffset);
            } else {
                texture.offset.set(0, 0);
            }
            texture.needsUpdate = true;
            return registerTexture(texture);
        };

        const buildFlattenedTexture = (sourceTexture, maskImage, mutatePixels) => {
            if (!sourceTexture?.image) return null;
            if (!maskImage) return sourceTexture;

            const sourceImage = sourceTexture.image;
            const canvas = document.createElement('canvas');
            canvas.width = sourceImage.width;
            canvas.height = sourceImage.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(sourceImage, 0, 0);

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = sourceImage.width;
            maskCanvas.height = sourceImage.height;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(maskImage, 0, 0, sourceImage.width, sourceImage.height);

            const maskData = maskCtx.getImageData(0, 0, sourceImage.width, sourceImage.height).data;
            const textureData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
            const pixels = textureData.data;

            for (let i = 0; i < maskData.length; i += 4) {
                if (maskData[i + 3] > 50) {
                    mutatePixels(pixels, i);
                }
            }

            ctx.putImageData(textureData, 0, 0);
            const flattenedTexture = new THREE.Texture(canvas);
            flattenedTexture.flipY = sourceTexture.flipY;
            flattenedTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
            flattenedTexture.generateMipmaps = true;
            flattenedTexture.minFilter = THREE.LinearMipmapLinearFilter;
            flattenedTexture.magFilter = THREE.LinearFilter;
            flattenedTexture.wrapS = sourceTexture.wrapS;
            flattenedTexture.wrapT = sourceTexture.wrapT;
            flattenedTexture.repeat.copy(sourceTexture.repeat);
            flattenedTexture.offset.copy(sourceTexture.offset);
            flattenedTexture.needsUpdate = true;
            registerTexture(flattenedTexture);
            return flattenedTexture;
        };

        const applyFlatMaskToNormalMap = (normalMap, maskImage) => buildFlattenedTexture(normalMap, maskImage, (pixels, i) => {
            pixels[i] = 128;
            pixels[i + 1] = 128;
            pixels[i + 2] = 255;
            pixels[i + 3] = 255;
        });

        const applyFlatMaskToScalarMap = (sourceTexture, maskImage, neutralRgb) => buildFlattenedTexture(sourceTexture, maskImage, (pixels, i) => {
            pixels[i] = neutralRgb[0];
            pixels[i + 1] = neutralRgb[1];
            pixels[i + 2] = neutralRgb[2];
            if (pixels[i + 3] > 0) pixels[i + 3] = 255;
        });

        const applyFlatMaskToOrmMap = (sourceTexture, maskImage) => buildFlattenedTexture(sourceTexture, maskImage, (pixels, i) => {
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 0;
            if (pixels[i + 3] > 0) pixels[i + 3] = 255;
        });

        // Collect all material names to determine if multi-material model
        const allMatNames = [];
        model.traverse((child) => {
            if (!child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => { if (m?.name && !allMatNames.includes(m.name)) allMatNames.push(m.name); });
        });
        const isMultiMaterial = allMatNames.length > 1;

        // Names of materials that should receive the painted canvas texture.
        const CANVAS_MAT_KEYWORDS = ['canvas', 'canva', 'inner', 'photo', 'editable', 'frame_inner', 'picture', 'artwork', 'image'];
        const isCanvasMaterial = (matName) => {
            if (!isMultiMaterial) return true; // single-material model: always apply
            const lower = (matName || '').toLowerCase();
            return CANVAS_MAT_KEYWORDS.some(kw => lower.includes(kw));
        };

        const applyMaterials = ({ konvaTex, flatMaskImage, uploadedMapTextures }) => {
            const color = new THREE.Color(baseColor || '#ffffff');

            model.traverse((child) => {
                if (!child.isMesh) return;

                if (child.userData.originalMat) {
                    if (Array.isArray(child.userData.originalMat)) {
                        child.material = child.userData.originalMat.map((m) => m.clone());
                    } else {
                        child.material = child.userData.originalMat.clone();
                    }
                }

                const applyToMat = (mat) => {
                    let finalMat = mat;
                    const originalNormalScale = mat.normalScale?.clone?.() || new THREE.Vector2(1, 1);

                    if (mat.type !== 'MeshPhysicalMaterial') {
                        finalMat = new THREE.MeshPhysicalMaterial();
                        finalMat.name = mat.name;
                        if (mat.color) finalMat.color.copy(mat.color);
                        if (mat.map) finalMat.map = mat.map;
                        if (mat.normalMap) finalMat.normalMap = mat.normalMap;
                        if (mat.normalScale) finalMat.normalScale.copy(mat.normalScale);
                        if (mat.aoMap) finalMat.aoMap = mat.aoMap;
                        if (mat.roughnessMap) finalMat.roughnessMap = mat.roughnessMap;
                        if (mat.metalnessMap) finalMat.metalnessMap = mat.metalnessMap;
                        if (mat.emissiveMap) finalMat.emissiveMap = mat.emissiveMap;
                        if (mat.opacity !== undefined) finalMat.opacity = mat.opacity;
                        if (mat.transparent !== undefined) finalMat.transparent = mat.transparent;
                        if (mat.alphaTest !== undefined) finalMat.alphaTest = mat.alphaTest;
                        if (mat.side !== undefined) finalMat.side = mat.side;
                    }

                    finalMat.roughness = materialSettings.roughness ?? DEFAULT_MATERIAL_SETTINGS.roughness;
                    finalMat.metalness = uploadedMapTextures.metalness || uploadedMapTextures.orm ? 1 : 0;
                    finalMat.sheen = materialSettings.sheen ?? DEFAULT_MATERIAL_SETTINGS.sheen;
                    finalMat.sheenRoughness = 0.4;
                    finalMat.side = THREE.DoubleSide;

                    if (konvaTex && isCanvasMaterial(mat.name)) {
                        finalMat.map = konvaTex;
                        finalMat.color.set('#ffffff');
                    } else if (!konvaTex) {
                        finalMat.color.multiply(color);
                    }

                    if (uploadedMapTextures.orm) {
                        finalMat.aoMap = uploadedMapTextures.orm;
                        finalMat.roughnessMap = uploadedMapTextures.orm;
                        finalMat.metalnessMap = uploadedMapTextures.orm;
                    }

                    if (uploadedMapTextures.ao) finalMat.aoMap = uploadedMapTextures.ao;
                    if (uploadedMapTextures.roughness) finalMat.roughnessMap = uploadedMapTextures.roughness;
                    if (uploadedMapTextures.metalness) finalMat.metalnessMap = uploadedMapTextures.metalness;
                    if (uploadedMapTextures.normal) {
                        finalMat.normalMap = uploadedMapTextures.normal;
                    }

                    if (finalMat.aoMap && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
                        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
                    }

                    if (finalMat.normalMap) {
                        if (!finalMat.normalScale) {
                            finalMat.normalScale = new THREE.Vector2(1, 1);
                        }
                        finalMat.normalScale.copy(originalNormalScale).multiplyScalar(normalIntensity);
                    }

                    if (flatMaskUrl) {
                        if (finalMat.normalMap) {
                            const maskedNormalMap = applyFlatMaskToNormalMap(finalMat.normalMap, flatMaskImage);
                            if (maskedNormalMap) finalMat.normalMap = maskedNormalMap;
                        } else {
                            finalMat.bumpMap = null;
                            finalMat.normalScale?.set(0, 0);
                        }

                        const usesPackedOrm = finalMat.roughnessMap && finalMat.roughnessMap === finalMat.aoMap && finalMat.roughnessMap === finalMat.metalnessMap;
                        if (usesPackedOrm) {
                            const flattenedOrm = applyFlatMaskToOrmMap(finalMat.roughnessMap, flatMaskImage);
                            if (flattenedOrm) {
                                finalMat.roughnessMap = flattenedOrm;
                                finalMat.aoMap = flattenedOrm;
                                finalMat.metalnessMap = flattenedOrm;
                            }
                        } else {
                            const flattenedRoughness = applyFlatMaskToScalarMap(finalMat.roughnessMap, flatMaskImage, [255, 255, 255]);
                            if (flattenedRoughness) finalMat.roughnessMap = flattenedRoughness;

                            const flattenedAo = applyFlatMaskToScalarMap(finalMat.aoMap, flatMaskImage, [255, 255, 255]);
                            if (flattenedAo) finalMat.aoMap = flattenedAo;

                            const flattenedMetalness = applyFlatMaskToScalarMap(finalMat.metalnessMap, flatMaskImage, [0, 0, 0]);
                            if (flattenedMetalness) finalMat.metalnessMap = flattenedMetalness;
                        }
                    }

                    finalMat.needsUpdate = true;
                    return finalMat;
                };

                if (Array.isArray(child.material)) {
                    child.material = child.material.map((m) => applyToMat(m));
                } else {
                    child.material = applyToMat(child.material);
                }
            });
        };

        const loadOptionalImage = async (src) => {
            if (!src) return null;
            try {
                return await loadImageElement(src);
            } catch (error) {
                console.warn('Texture load skipped:', error);
                return null;
            }
        };

        const runMaterialUpdate = async () => {
            const [konvaImage, flatMaskImage, normalImage, roughnessImage, metalnessImage, aoImage, ormImage] = await Promise.all([
                loadOptionalImage(textureDataUrl),
                loadOptionalImage(flatMaskUrl),
                loadOptionalImage(pbrTextures.normal?.dataUrl),
                loadOptionalImage(pbrTextures.roughness?.dataUrl),
                loadOptionalImage(pbrTextures.metalness?.dataUrl),
                loadOptionalImage(pbrTextures.ao?.dataUrl),
                loadOptionalImage(pbrTextures.orm?.dataUrl),
            ]);

            if (cancelled) return;

            disposeManagedTextures();

            const uploadedMapTextures = {
                normal: createTexture(normalImage, { repeat: textureRepeat }),
                roughness: createTexture(roughnessImage, { repeat: textureRepeat }),
                metalness: createTexture(metalnessImage, { repeat: textureRepeat }),
                ao: createTexture(aoImage, { repeat: textureRepeat }),
                orm: createTexture(ormImage, { repeat: textureRepeat }),
            };

            applyMaterials({
                konvaTex: createTexture(konvaImage, { colorSpace: THREE.SRGBColorSpace }),
                flatMaskImage,
                uploadedMapTextures,
            });
        };

        runMaterialUpdate();

        return () => {
            cancelled = true;
        };
    }, [model, textureDataUrl, flatMaskUrl, materialSettings, baseColor, gl, pbrTextures]);

    if (!model) return null;
    return <primitive object={model} />;
}));

const CaptureController = React.forwardRef((props, ref) => {
    const { camera, gl, scene } = useThree();

    React.useImperativeHandle(ref, () => ({
        captureAll: async () => {
            const originalPos = camera.position.clone();
            const originalQuat = camera.quaternion.clone();
            const originalZoom = camera.zoom;
            const radius = Math.max(3.5, Math.min(6, Math.hypot(originalPos.x, originalPos.z) || originalPos.length() || 4.5));
            const height = 0;
            const angles = [
                { name: 'front', pos: [0, height, radius] },
                { name: 'right', pos: [radius, height, 0] },
                { name: 'back', pos: [0, height, -radius] },
                { name: 'left', pos: [-radius, height, 0] },
            ];

            const screenshots = {};

            for (const angle of angles) {
                camera.position.set(...angle.pos);
                camera.lookAt(0, 0, 0);
                camera.updateProjectionMatrix();
                camera.updateMatrixWorld();

                await new Promise(resolve => setTimeout(resolve, 80));
                gl.render(scene, camera);

                const rawUrl = gl.domElement.toDataURL('image/png');
                screenshots[angle.name] = await compressCaptureImage(rawUrl);
            }

            camera.position.copy(originalPos);
            camera.quaternion.copy(originalQuat);
            camera.zoom = originalZoom;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            gl.render(scene, camera);

            return screenshots;
        }
    }));

    return null;
});


// ═══════════════════════════════════════════════════
// ── Main Component ──
// ═══════════════════════════════════════════════════
const TestUVWorkflow = ({ productId, designId: initialDesignId, initialGlbUrl, initialMaskUrl, initialProductData, initialDesignData, isPreview = false }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [designId, setDesignId] = useState(initialDesignId);
    const defaultStageScale = isPreview ? PREVIEW_INITIAL_STAGE_SCALE : 1;
    const [glbUrl, setGlbUrl] = useState(initialGlbUrl || null);
    const [glbFileName, setGlbFileName] = useState('');
    const [maskImg, setMaskImg] = useState(null);

    const [colorCanvasImg, setColorCanvasImg] = useState(null);
    const [stickers, setStickers] = useState([]);
    const [selectedStickerId, setSelectedStickerId] = useState(null);
    const [textureDataUrl, setTextureDataUrl] = useState(null);
    const [highlightImg, setHighlightImg] = useState(null);

    // Popup state
    const [popup, setPopup] = useState(null);

    const stageRef = useRef(null);
    const normalStageRef = useRef(null);
    const maxExportEdgeRef = useRef(MAX_EXPORT_LONGEST_EDGE);
    const trRef = useRef(null);
    const colorCanvasRef = useRef(null);
    const colorCanvasRevisionRef = useRef(0);
    const tintedBaseCacheRef = useRef({ key: '', canvas: null });
    const hasInitializedViewportRef = useRef(false);
    const containerRef = useRef(null);
    const canvasWrapperRef = useRef(null);
    const previewCanvasContainerRef = useRef(null);
    const captureRef = useRef(null);

    // Flat mask for normal map patching
    const [flatMaskUrl, setFlatMaskUrl] = useState(null);

    // UI Layout States
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('design'); // 'design' | 'studio'
    const productName = initialProductData?.name || 'Untitled Project';

    // --- Mobile & Fullscreen States ---
    const [isMobile, setIsMobile] = useState(false);
    const [isPortrait, setIsPortrait] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showMobileTextInput, setShowMobileTextInput] = useState(false);
    const [mobileTextValue, setMobileTextValue] = useState("");
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiScreenshots, setAiScreenshots] = useState(null);
    const [isAiSubmitting, setIsAiSubmitting] = useState(false);

    // --- Canvas Toolbar States ---
    const [stageScale, setStageScale] = useState(defaultStageScale);
    const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState('select'); // 'select' | 'hand'
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [showOutlines, setShowOutlines] = useState(true);
    const [canvasRotation, setCanvasRotation] = useState(0);
    const [isModelReady, setIsModelReady] = useState(false);
    const [isWorkflowReady, setIsWorkflowReady] = useState(false);

    // Setup responsive listener
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
            setIsPortrait(window.innerHeight > window.innerWidth);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setIsModelReady(false);
        setIsWorkflowReady(false);
    }, [initialGlbUrl, initialMaskUrl, designId]);

    useEffect(() => {
        setPbrTextures({ ...EMPTY_PBR_TEXTURES });
    }, [initialGlbUrl, initialMaskUrl, initialDesignId, productId]);

    useEffect(() => {
        hasInitializedViewportRef.current = false;
        setStageScale(defaultStageScale);
        setStagePosition({ x: 0, y: 0 });
    }, [defaultStageScale, initialMaskUrl, designId]);

    useEffect(() => {
        // Respect device GPU limits; allows us to push quality without crashing small/mobile GPUs.
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            const maxTex = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : MAX_EXPORT_LONGEST_EDGE;
            maxExportEdgeRef.current = Math.max(2048, Math.min(MAX_EXPORT_LONGEST_EDGE, maxTex || MAX_EXPORT_LONGEST_EDGE));
        } catch {
            maxExportEdgeRef.current = MAX_EXPORT_LONGEST_EDGE;
        }
    }, []);

    // ── New Layer States (Text & Material) ──
    const [textInput, setTextInput] = useState('');
    const [fontSize, setFontSize] = useState(48);
    const [textNodes, setTextNodes] = useState([]); // Like stickers, but for text
    const [selectedTextId, setSelectedTextId] = useState(null);
    const [isExportingAR, setIsExportingAR] = useState(false);
    const [showARModal, setShowARModal] = useState(false);
    const [arGlbUrl, setArGlbUrl] = useState(null);
    const modelViewerRef = useRef(null);

    // ── Material, Env & Background States ──
    const [materialSettings, setMaterialSettings] = useState(DEFAULT_MATERIAL_SETTINGS);
    const [baseColor, setBaseColor] = useState('#ffffff');
    const [pbrTextures, setPbrTextures] = useState(() => ({ ...EMPTY_PBR_TEXTURES }));
    const [showAuxLights, setShowAuxLights] = useState(true);
    const [brightness, setBrightness] = useState(1.0);
    const [envPreset, setEnvPreset] = useState('studio');
    const [bgType, setBgType] = useState('solid'); // 'solid' | 'transparent' | 'image'
    const [bgColor, setBgColor] = useState('#ffffff');
    const [bgImage, setBgImage] = useState(null);
    const bgImageFileInputRef = useRef(null);

    // ── Refs for latest state (avoids stale closures in performExport) ──
    const stickersRef = useRef(stickers);
    stickersRef.current = stickers;
    const textNodesRef = useRef(textNodes);
    textNodesRef.current = textNodes;


    // ── Save State & Logic ──
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [enableBaseColor, setEnableBaseColor] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [saveSnapshot, setSaveSnapshot] = useState(null);
    const [originalMaskFile, setOriginalMaskFile] = useState(null);

    // Initial Data Loading
    useEffect(() => {
        if (initialGlbUrl) setGlbUrl(initialGlbUrl);

        if (initialMaskUrl) {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.src = initialMaskUrl;
            img.onload = () => { setMaskImg(img); initColorCanvas(img); };

            // Note: We don't have the original FILE object for initialMaskUrl, 
            // so `originalMaskFile` will be null unless we fetch it as a blob.
            // For saving, if `originalMaskFile` is null, we might need to handle re-saving the existing one 
            // or fetch it here.
            fetch(initialMaskUrl)
                .then(res => res.blob())
                .then(blob => {
                    // Create a File object from blob to mimic user upload
                    const file = new File([blob], "original_mask.svg", { type: blob.type });
                    setOriginalMaskFile(file);
                })
                .catch(e => console.error("Failed to fetch original mask blob", e));
        }
    }, [initialGlbUrl, initialMaskUrl]);

    // ── Load saved design data ──
    useEffect(() => {
        if (!initialDesignData || !maskImg) return;

        // Restore base color
        if (initialDesignData.baseColor) setBaseColor(initialDesignData.baseColor);

        // Restore material settings
        if (initialDesignData.materialSettings) {
            setMaterialSettings(prev => ({ ...prev, ...initialDesignData.materialSettings }));
        }

        // Restore text nodes
        if (initialDesignData.textNodes && Array.isArray(initialDesignData.textNodes)) {
            setTextNodes(initialDesignData.textNodes.map(t => ({ ...t, isFlat: true })));
            if (!(initialDesignData.meshStickers?.main_mesh?.length || initialDesignData.stickers?.length)) {
                setTimeout(() => triggerExport(), 500);
            }
        }

        // Restore stickers (need to load images)
        // Backend saves as meshStickers.main_mesh, fallback to flat stickers array
        const stickerList = initialDesignData.meshStickers?.main_mesh
            || initialDesignData.stickers
            || [];

        if (Array.isArray(stickerList) && stickerList.length > 0) {
            const STICKER_BASE_URL = "https://artify-assets.s3.ap-south-1.amazonaws.com/users_stickers/";
            const loadPromises = stickerList.map(async (s) => {
                if (s.url || s.src) {
                    let fullUrl = s.url || s.src;
                    if (!fullUrl.startsWith('http') && !fullUrl.startsWith('blob:') && !fullUrl.startsWith('data:')) {
                        fullUrl = `${STICKER_BASE_URL}${fullUrl}`;
                    }
                    return new Promise(resolve => {
                        const img = new window.Image();
                        // Must be set unconditionally or canvas becomes tainted, breaking the 3D export
                        img.crossOrigin = 'anonymous';

                        img.onload = () => {
                            resolve({ ...s, image: img, isFlat: true });
                        };

                        img.onerror = (err) => {
                            console.warn('Failed to load sticker (CORS or network error):', fullUrl, err);
                            // If S3 CORS fails on presigned URL, strip query params and try public bucket URL
                            if (fullUrl.includes('X-Amz-')) {
                                const cleanUrl = fullUrl.split('?')[0];
                                const retryImg = new window.Image();
                                retryImg.crossOrigin = 'anonymous';
                                retryImg.onload = () => {
                                    resolve({ ...s, image: retryImg, isFlat: true });
                                };
                                retryImg.onerror = () => resolve(null);
                                retryImg.src = cleanUrl;
                            } else {
                                resolve(null);
                            }
                        };
                        img.src = fullUrl;
                    });
                }
                return null;
            });

            Promise.all(loadPromises).then(loaded => {
                const validStickers = loaded.filter(Boolean);
                if (validStickers.length > 0) {
                    setStickers(validStickers);
                    // Trigger export after a small delay to update the 3D model
                    setTimeout(() => triggerExport(), 500);
                }
            });
        }
    }, [initialDesignData, maskImg]);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, subRes] = await Promise.all([
                    api.get('/admin-category/view'),
                    api.get('/admin-subcategory')
                ]);
                setCategories(catRes.data.category || []);
                setSubCategories(subRes.data || []);
            } catch (err) {
                console.error("Failed to fetch categories", err);
            }
        };
        fetchData();
    }, []);

    const capturePreviewDataUrl = async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const canvas = previewCanvasContainerRef.current?.querySelector('canvas');
        if (!canvas) {
            throw new Error('3D preview not found. Please wait for the preview to finish loading.');
        }

        const dataUrl = canvas.toDataURL('image/png');
        if (!dataUrl || dataUrl === 'data:,') {
            throw new Error('Failed to capture the 3D preview.');
        }

        return dataUrl;
    };

    const capturePreviewBlob = async () => {
        const dataUrl = await capturePreviewDataUrl();
        const res = await fetch(dataUrl);
        return res.blob();
    };

    const handleOpenAiModal = async () => {
        if (isAiSubmitting) return;

        try {
            const screenshots = await captureRef.current?.captureAll?.();
            const requiredViews = ['front', 'right', 'back', 'left'];
            const hasAllViews = requiredViews.every(view => screenshots?.[view]);

            if (!hasAllViews) {
                throw new Error('Failed to capture all 4 preview angles.');
            }

            setAiScreenshots(screenshots);
            setShowAiModal(true);
        } catch (error) {
            alert(error.message || 'Failed to capture the 3D preview angles.');
        }
    };

    const handleSaveClick = async () => {
        try {
            // Ensure a high-quality bake before capturing snapshot
            performExport('full');
            // Capture 3D canvas screenshot as preview for the modal
            let imageBlob = null;
            try {
                imageBlob = await capturePreviewDataUrl(); // capture dataUrl instead of blob, for immediate rendering in modal
                setSaveSnapshot(imageBlob);
            } catch (e) {
                console.warn('Snapshot failed', e);
            }
        } catch (e) {
            console.error('Save prep failed', e);
        }
        setIsSaveModalOpen(true);
    };

    const handleConfirmSave = async (payload) => {
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('product_details[name]', payload.name);
            formData.append('product_details[category]', payload.categoryId);
            formData.append('product_details[subcategory]', payload.subcategoryId);
            formData.append('product_details[is_cloth]', payload.isCloth ? '1' : '0');

            if (payload.imageBlob) {
                formData.append('product_details[image]', payload.imageBlob, 'product_preview.png');
            }

            // Fetch GLB blob
            if (glbUrl) {
                const res = await fetch(glbUrl);
                const blob = await res.blob();
                formData.append('product_details[glb]', blob, glbFileName || 'model.glb');
            }

            // Process Mask / Texture
            if (maskImg && originalMaskFile) {
                const whiteRes = await fetch(maskImg.src);
                const whiteBlob = await whiteRes.blob();

                formData.append('svgdetails[0][mesh_name]', 'main_mesh');
                formData.append('svgdetails[0][white]', whiteBlob, 'mask_processed.png');
                formData.append('svgdetails[0][original]', originalMaskFile, originalMaskFile.name);
            }

            await api.post('/product/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Product Saved Successfully!');
            setIsSaveModalOpen(false);
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save product.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Handle GLB Upload ──
    const handleGlbUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setGlbFileName(file.name);
        if (glbUrl) {
            URL.revokeObjectURL(glbUrl);
        }
        const url = URL.createObjectURL(file);
        setGlbUrl(url);

        // Reset UV state & textures since old maps don't apply to a new GLB
        setMaskImg(null);
        setOriginalMaskFile(null);
        setColorCanvasImg(null);
        setTextureDataUrl(null);
        setStickers([]);
        setTextNodes([]);
        setPbrTextures({ ...EMPTY_PBR_TEXTURES });
        setBaseColor('#ffffff');
        setMaterialSettings(DEFAULT_MATERIAL_SETTINGS);
    };

    // ── Handle SVG/Texture Upload ──
    const handleMaskUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setOriginalMaskFile(file); // Store original for save
        const url = URL.createObjectURL(file);

        const img = new window.Image();
        img.src = url;
        img.onload = () => {
            setMaskImg(img);
            initColorCanvas(img);
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
        };
    };

    // ── Initialize offscreen color canvas (all white where mask is opaque) ──
    const initColorCanvas = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
            else { data[i + 3] = 0; }
        }
        ctx.putImageData(imageData, 0, 0);
        colorCanvasRef.current = canvas;
        updateColorCanvasImg(canvas);
    };

    const updateColorCanvasImg = (canvas) => {
        colorCanvasRevisionRef.current += 1;
        tintedBaseCacheRef.current = { key: '', canvas: null };
        const dataUrl = canvas.toDataURL('image/png');
        const newImg = new window.Image();
        newImg.src = dataUrl;
        newImg.onload = () => setColorCanvasImg(newImg);
    };

    const getTintedBaseCanvas = useCallback(() => {
        const sourceCanvas = colorCanvasRef.current;
        if (!sourceCanvas) return null;

        const tintKey = (baseColor || '#ffffff').toLowerCase();
        const cacheKey = `${colorCanvasRevisionRef.current}:${tintKey}`;
        if (tintedBaseCacheRef.current.key === cacheKey && tintedBaseCacheRef.current.canvas) {
            return tintedBaseCacheRef.current.canvas;
        }

        const tintedCanvas = buildTintedBaseCanvas(sourceCanvas, tintKey);
        tintedBaseCacheRef.current = {
            key: cacheKey,
            canvas: tintedCanvas
        };
        return tintedCanvas;
    }, [baseColor]);

    // ── Handle click on panel → open popup ──
    const handleStageClick = (e) => {
        if (!colorCanvasRef.current || !maskImg) return;

        // Skip if clicked on a sticker, text node, or transformer handle
        const target = e.target;
        const targetId = typeof target.id === 'function' ? target.id() : target.attrs?.id;
        if (targetId && stickers.some(s => s.id === targetId)) return;
        if (targetId && textNodes.some(t => t.id === targetId)) return;
        // Skip transformer handles
        if (target.getClassName?.() === 'Transformer' || target.getParent()?.getClassName?.() === 'Transformer') return;

        const stage = e.target.getStage();
        const pointer = stage.getPointerPosition();

        // Convert screen pointer back to unrotated, unscaled canvas coordinates
        const layer = stage.getLayers()[0];
        const transform = layer.getAbsoluteTransform().copy();
        transform.invert();
        const point = transform.point(pointer);

        const originalX = Math.round(point.x);
        const originalY = Math.round(point.y);

        // Check if this pixel is inside the mask (opaque)
        const canvas = colorCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const pixel = ctx.getImageData(originalX, originalY, 1, 1).data;
        if (pixel[3] < 10) {
            // Clicked outside panels — close popup & highlight
            setPopup(null);
            setHighlightImg(null);
            setSelectedStickerId(null);
            setSelectedTextId(null);
            return;
        }

        // Get current color at this pixel
        const currentHex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        // Get safe screen position for popup (fixed viewport coordinates)
        const screenX = e.evt.clientX;
        const screenY = e.evt.clientY;

        // Generate outline highlight for this panel
        const outlineDataUrl = generatePanelOutline(canvas, originalX, originalY);
        if (outlineDataUrl) {
            const hlImg = new window.Image();
            hlImg.src = outlineDataUrl;
            hlImg.onload = () => setHighlightImg(hlImg);
        }

        setPopup({
            screenX, screenY,
            canvasX: originalX, canvasY: originalY,
            currentColor: currentHex,
        });
        setSelectedStickerId(null);
        setSelectedTextId(null);
    };

    // ── When color changes from popup, flood-fill the panel ──
    const handlePopupColorChange = useCallback((hex) => {
        if (!popup || !colorCanvasRef.current) return;
        const canvas = colorCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rgb = hexToRgb(hex);
        floodFill(ctx, popup.canvasX, popup.canvasY, rgb, canvas.width, canvas.height);
        updateColorCanvasImg(canvas);
        // Update popup's stored current color so subsequent flood fills use the new color as start
        setPopup(prev => prev ? { ...prev, currentColor: hex } : null);
    }, [popup]);

    // ── Handle Sticker Upload ──
    const handleStickerUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.src = url;
        img.onload = () => {
            const naturalWidth = img.naturalWidth || img.width || 120;
            const naturalHeight = img.naturalHeight || img.height || 120;
            const maskLongest = Math.max(maskImg?.naturalWidth || 0, maskImg?.naturalHeight || 0);
            // Start stickers larger so high-res uploads don't immediately lose detail in UV space.
            // Small sources are still not upscaled.
            const maxInitialSize = maskLongest > 0
                ? Math.min(1024, Math.max(240, Math.round(maskLongest * 0.6)))
                : 512;
            // Keep small stickers at native size (no upscaling), only downscale large uploads.
            const initialScale = Math.min(1, maxInitialSize / Math.max(naturalWidth, naturalHeight));
            const renderWidth = Math.max(8, Math.round(naturalWidth * initialScale));
            const renderHeight = Math.max(8, Math.round(naturalHeight * initialScale));

            const newSticker = {
                id: Date.now().toString(),
                image: img,
                x: 50,
                y: 50,
                width: renderWidth,
                height: renderHeight,
                rotation: 0,
                isFlat: true
            };
            setStickers(prev => [...prev, newSticker]);
            setSelectedStickerId(newSticker.id);
            URL.revokeObjectURL(url);
            setTimeout(() => triggerExport(), 100);
        };
    };

    // ── Handle Sticker Deletion ──
    const handlePbrTextureUpload = async (mapKey, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readFileAsDataUrl(file);
            const image = await loadImageElement(dataUrl);

            setPbrTextures(prev => ({
                ...prev,
                [mapKey]: {
                    name: file.name,
                    dataUrl,
                    image,
                }
            }));

            setTimeout(() => triggerExport(), 100);
        } catch (error) {
            console.error(`Failed to upload ${mapKey} texture`, error);
            alert(`Failed to load ${file.name}. Please try another image.`);
        } finally {
            e.target.value = null;
        }
    };

    const handleClearPbrTexture = (mapKey) => {
        setPbrTextures(prev => ({
            ...prev,
            [mapKey]: null,
        }));
        setTimeout(() => triggerExport(), 100);
    };

    const handleClearAllPbrTextures = () => {
        setPbrTextures({ ...EMPTY_PBR_TEXTURES });
        setTimeout(() => triggerExport(), 100);
    };

    const handleMaterialSettingChange = (key, value) => {
        setMaterialSettings(prev => ({
            ...prev,
            [key]: value,
        }));
        if (key === 'textureRepeat') {
            setTimeout(() => triggerExport(), 100);
        }
    };

    const addStickerFromImageSource = (source) => {
        const normalizedSource = normalizeAiImageSource(source);
        if (!normalizedSource) {
            return Promise.reject(new Error('AI response did not include a usable image.'));
        }

        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const naturalWidth = img.naturalWidth || img.width || 120;
                const naturalHeight = img.naturalHeight || img.height || 120;
                const maskLongest = Math.max(maskImg?.naturalWidth || 0, maskImg?.naturalHeight || 0);
                const maxInitialSize = maskLongest > 0
                    ? Math.min(1024, Math.max(240, Math.round(maskLongest * 0.6)))
                    : 512;
                const initialScale = Math.min(1, maxInitialSize / Math.max(naturalWidth, naturalHeight));
                const renderWidth = Math.max(8, Math.round(naturalWidth * initialScale));
                const renderHeight = Math.max(8, Math.round(naturalHeight * initialScale));

                const newSticker = {
                    id: Date.now().toString(),
                    image: img,
                    x: 50,
                    y: 50,
                    width: renderWidth,
                    height: renderHeight,
                    rotation: 0,
                    isFlat: true
                };

                setStickers(prev => [...prev, newSticker]);
                setSelectedStickerId(newSticker.id);
                setSelectedTextId(null);
                setTimeout(() => triggerExport(), 100);
                resolve(newSticker);
            };
            img.onerror = () => reject(new Error('Failed to load the AI-generated image.'));
            img.src = normalizedSource;
        });
    };

    const handleAiSubmit = async () => {
        const prompt = aiPrompt.trim();
        if (!prompt) return;
        const requiredViews = ['front', 'right', 'back', 'left'];
        if (!requiredViews.every(view => aiScreenshots?.[view])) {
            alert('All 4 preview captures are required. Please try again.');
            return;
        }

        setIsAiSubmitting(true);
        try {

            setShowAiModal(false);
            setAiPrompt('');
            setAiScreenshots(null);
        } catch (error) {
            const message = error?.response?.data?.message
                || error?.response?.data?.error
                || error.message
                || 'Failed to generate AI design.';
            alert(message);
        } finally {
            setIsAiSubmitting(false);
        }
    };

    const handleARLaunch = async () => {
        if (!modelViewerRef.current?.scene) {
            alert("Model not ready for AR. Please wait for the 3D preview to load.");
            return;
        }

        try {

        } catch (error) {
            console.error("AR Export failed:", error);
            alert("Failed to prepare AR view. Please try again.");
        } finally {
            setIsExportingAR(false);
        }
    };

    const handleDeleteSticker = () => {
        if (!selectedStickerId) return;
        setStickers(prev => prev.filter(s => s.id !== selectedStickerId));
        setSelectedStickerId(null);
        setTimeout(() => triggerExport(), 100);
    };

    // ── Handle Text Layer ──
    const handleAddText = () => {
        if (!textInput.trim()) return;
        const newText = {
            id: 'text-' + Date.now().toString(),
            text: textInput,
            x: 100,
            y: 100,
            fontSize: fontSize,
            fill: '#000000',
            rotation: 0,
            isFlat: true
        };
        setTextNodes(prev => [...prev, newText]);
        setSelectedTextId(newText.id);
        setSelectedStickerId(null);
        setTextInput('');
        setTimeout(() => triggerExport(), 100);
    };

    const handleDeleteText = () => {
        if (!selectedTextId) return;
        setTextNodes(prev => prev.filter(t => t.id !== selectedTextId));
        setSelectedTextId(null);
        setTimeout(() => triggerExport(), 100);
    };

    const handleBgImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setBgImage(url);
    };

    // ── Export Konva → Texture ──
    // `quality=preview` is fast for interactive updates; `quality=full` is deferred high-quality bake.
    const performExport = useCallback((quality = 'full') => {
        if (!stageRef.current || !maskImg) return;
        if (trRef.current) trRef.current.nodes([]);
        const isPreviewQuality = quality === 'preview';

        // Hide highlight during export so it doesn't appear on the 3D model
        const highlightNode = stageRef.current.findOne('#panel-highlight');
        const wasVisible = highlightNode ? highlightNode.visible() : false;
        if (highlightNode) highlightNode.visible(false);

        // Temporarily reset zoom/pan so export captures the full un-zoomed texture
        const savedScaleX = stageRef.current.scaleX();
        const savedScaleY = stageRef.current.scaleY();
        const savedPosX = stageRef.current.x();
        const savedPosY = stageRef.current.y();
        stageRef.current.scaleX(ratio);
        stageRef.current.scaleY(ratio);
        stageRef.current.x(0);
        stageRef.current.y(0);

        // Export at high, device-independent resolution so small stickers stay sharp on 3D zoom.
        // Also adapt to sticker source detail: small on-UV stickers get a larger bake target (capped).
        const stageWForExport = stageRef.current.width() || 1;
        const stageHForExport = stageRef.current.height() || 1;
        const exportRatioX = maskImg.naturalWidth / stageWForExport;
        const exportRatioY = maskImg.naturalHeight / stageHForExport;
        const nativeExportRatio = Math.max(0.1, exportRatioX, exportRatioY);
        const longestMaskEdge = Math.max(maskImg.naturalWidth || 1, maskImg.naturalHeight || 1);
        const desiredEdgeForStickers = isPreviewQuality ? 0 : stickersRef.current.reduce((maxEdge, s) => {
            const sourceW = s?.image?.naturalWidth || s?.image?.width || 0;
            const sourceH = s?.image?.naturalHeight || s?.image?.height || 0;
            const sourceLongest = Math.max(sourceW, sourceH);
            const stickerLongestOnMask = Math.max(Math.abs(s?.width || 0), Math.abs(s?.height || 0));
            if (!sourceLongest || !stickerLongestOnMask) return maxEdge;
            const neededLongestEdge = longestMaskEdge * (sourceLongest / stickerLongestOnMask);
            return Math.max(maxEdge, neededLongestEdge);
        }, 0);
        const exportEdgeCap = isPreviewQuality
            ? (isMobile ? 1536 : 2048)
            : (isMobile
                ? Math.min(3072, maxExportEdgeRef.current || MAX_EXPORT_LONGEST_EDGE)
                : (maxExportEdgeRef.current || MAX_EXPORT_LONGEST_EDGE));
        const exportEdgeFloor = isPreviewQuality ? 1024 : (isMobile ? 2048 : MIN_EXPORT_LONGEST_EDGE);
        const targetLongestEdge = Math.min(
            exportEdgeCap,
            Math.max(longestMaskEdge, exportEdgeFloor, desiredEdgeForStickers)
        );
        const qualityUpscale = targetLongestEdge / longestMaskEdge;
        const exportRatio = nativeExportRatio * qualityUpscale;

        // Force synchronous draw to ensur exports capture the latest React state
        const layers = stageRef.current.getLayers();
        const mainLayer = layers[0];

        let overlayCanvas;
        const isRotated = mainLayer && mainLayer.rotation() !== 0;
        const baseNode = stageRef.current.findOne('#base-color-canvas');
        const wasBaseVisible = baseNode ? baseNode.visible() : false;
        if (baseNode) baseNode.visible(false);

        // Save bounds
        const originalStageW = stageRef.current.width();
        const originalStageH = stageRef.current.height();
        const originalRotation = mainLayer ? mainLayer.rotation() : 0;
        const originalX = mainLayer ? mainLayer.x() : 0;
        const originalY = mainLayer ? mainLayer.y() : 0;

        if (isRotated && mainLayer) {
            mainLayer.rotation(0);
            mainLayer.x(0);
            mainLayer.y(0);
            stageRef.current.width(originalStageH);
            stageRef.current.height(originalStageW);
            mainLayer.draw();
        } else if (mainLayer) {
            mainLayer.draw();
        }

        overlayCanvas = stageRef.current.toCanvas({ pixelRatio: exportRatio });

        if (isRotated && mainLayer) {
            mainLayer.rotation(originalRotation);
            mainLayer.x(originalX);
            mainLayer.y(originalY);
            stageRef.current.width(originalStageW);
            stageRef.current.height(originalStageH);
            mainLayer.draw();
        } else if (mainLayer) {
            mainLayer.draw();
        }
        if (baseNode && wasBaseVisible) {
            baseNode.visible(true);
            if (mainLayer) mainLayer.draw();
        }

        // Keep sticker/text flattening responsive in preview, then refresh at full resolution shortly after.
        if (normalStageRef.current && (textNodesRef.current.length > 0 || stickersRef.current.length > 0)) {
            const normalLayers = normalStageRef.current.getLayers();
            if (normalLayers.length > 0) normalLayers[0].draw();
            const flatMaskPixelRatio = isPreviewQuality ? Math.min(2, exportRatio) : exportRatio;
            const maskUri = normalStageRef.current.toDataURL({ pixelRatio: flatMaskPixelRatio, imageSmoothingEnabled: false });
            setFlatMaskUrl(maskUri);
        } else {
            setFlatMaskUrl(null);
        }

        // Restore highlight
        if (highlightNode && wasVisible) highlightNode.visible(true);

        // Restore zoom/pan state
        stageRef.current.scaleX(savedScaleX);
        stageRef.current.scaleY(savedScaleY);
        stageRef.current.x(savedPosX);
        stageRef.current.y(savedPosY);

        const currentSelection = selectedStickerId || selectedTextId;
        if (currentSelection && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne(n => n.id() === currentSelection);
            if (node) trRef.current.nodes([node]);
        }

        const exportPixelWidth = Math.max(1, Math.round(stageRef.current.width() * exportRatio));
        const exportPixelHeight = Math.max(1, Math.round(stageRef.current.height() * exportRatio));
        const tintedBaseCanvas = getTintedBaseCanvas();
        const pbrBaseCanvas = buildRepeatedTextureCanvas({
            image: pbrTextures.baseColor?.image,
            width: exportPixelWidth,
            height: exportPixelHeight,
            repeat: materialSettings.textureRepeat,
        });
        const composedTexture = composeTextureDataUrl({
            overlayCanvas,
            tintedBaseCanvas: enableBaseColor ? tintedBaseCanvas : null,
            pbrBaseCanvas,
            width: exportPixelWidth,
            height: exportPixelHeight
        });
        setTextureDataUrl(composedTexture);
    }, [maskImg, selectedStickerId, isMobile, selectedTextId, getTintedBaseCanvas, pbrTextures, materialSettings.textureRepeat]);

    const triggerPreviewExport = useDebounce(() => performExport('preview'), 80);
    const triggerFullExport = useDebounce(() => performExport('full'), 1200);
    const triggerExport = useCallback(() => {
        triggerPreviewExport();
        triggerFullExport();
    }, [triggerPreviewExport, triggerFullExport]);

    // ── Text node helpers for FloatingTextToolbar ──
    const handleTextChange = useCallback((id, updates) => {
        setTextNodes(prev => prev.map(t => t.id === id ? { ...t, ...updates, isFlat: true } : t));
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleDuplicateText = useCallback((id) => {
        const original = textNodes.find(t => t.id === id);
        if (!original) return;
        const newText = { ...original, id: 'text-' + Date.now().toString(), x: original.x + 20, y: original.y + 20, isFlat: true };
        setTextNodes(prev => [...prev, newText]);
        setSelectedTextId(newText.id);
        setTimeout(() => triggerExport(), 100);
    }, [textNodes, triggerExport]);

    const handleMoveTextForward = useCallback((id) => {
        setTextNodes(prev => {
            const idx = prev.findIndex(t => t.id === id);
            if (idx === -1 || idx === prev.length - 1) return prev;
            const arr = [...prev];
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            return arr;
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleMoveTextBackward = useCallback((id) => {
        setTextNodes(prev => {
            const idx = prev.findIndex(t => t.id === id);
            if (idx <= 0) return prev;
            const arr = [...prev];
            [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
            return arr;
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    // ── Sticker helpers for FloatingImageToolbar ──
    const handleStickerChange = useCallback((id, updates) => {
        setStickers(prev => prev.map(s => s.id === id ? { ...s, ...updates, isFlat: true } : s));
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleDuplicateSticker = useCallback((id) => {
        const original = stickers.find(s => s.id === id);
        if (!original) return;
        const newSticker = { ...original, id: Date.now().toString(), x: original.x + 20, y: original.y + 20, isFlat: true };
        setStickers(prev => [...prev, newSticker]);
        setSelectedStickerId(newSticker.id);
        setTimeout(() => triggerExport(), 100);
    }, [stickers, triggerExport]);

    const handleMoveStickerForward = useCallback((id) => {
        setStickers(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx === -1 || idx === prev.length - 1) return prev;
            const arr = [...prev];
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            return arr;
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleMoveStickerBackward = useCallback((id) => {
        setStickers(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx <= 0) return prev;
            const arr = [...prev];
            [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
            return arr;
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleMoveStickerToFront = useCallback((id) => {
        setStickers(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx === -1 || idx === prev.length - 1) return prev;
            const item = prev[idx];
            return [...prev.slice(0, idx), ...prev.slice(idx + 1), item];
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);

    const handleMoveStickerToBack = useCallback((id) => {
        setStickers(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx <= 0) return prev;
            const item = prev[idx];
            return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
        setTimeout(() => triggerExport(), 100);
    }, [triggerExport]);
    useEffect(() => {
        if (colorCanvasImg && maskImg) triggerExport();
    }, [colorCanvasImg, maskImg, baseColor]);

    useEffect(() => {
        const selectionId = selectedStickerId || selectedTextId;
        if (selectionId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne(n => n.id() === selectionId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) { trRef.current.nodes([]); trRef.current.getLayer().batchDraw(); }
    }, [selectedStickerId, selectedTextId, stickers, textNodes]);

    useEffect(() => { return () => { if (glbUrl) URL.revokeObjectURL(glbUrl); }; }, [glbUrl]);

    // ── Canvas Toolbar Handlers ──
    const zoomPercent = Math.round(stageScale * 100);

    const handleWheel = useCallback((e) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!maskImg) return;
        // Compute base ratio from mask dimensions at call time (avoids referencing `ratio` before init)
        const baseRatio = Math.min(
            stage.width() / maskImg.naturalWidth,
            stage.height() / maskImg.naturalHeight
        ) || 1;
        const oldScale = stage.scaleX() / baseRatio;
        const pointer = stage.getPointerPosition();
        const mousePointTo = {
            x: (pointer.x - stage.x()) / (oldScale * baseRatio),
            y: (pointer.y - stage.y()) / (oldScale * baseRatio),
        };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = Math.min(5, Math.max(0.1, oldScale * (1 + direction * 0.1)));
        setStageScale(newScale);
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale * baseRatio,
            y: pointer.y - mousePointTo.y * newScale * baseRatio,
        };
        setStagePosition(newPos);
    }, [maskImg]);

    const handleStageDragEnd = useCallback((e) => {
        if (activeTool !== 'hand') return;
        setStagePosition({ x: e.target.x(), y: e.target.y() });
    }, [activeTool]);

    // Undo/Redo: push snapshot before mutations
    const pushUndoSnapshot = useCallback(() => {
        setUndoStack(prev => [...prev.slice(-29), {
            stickers: JSON.parse(JSON.stringify(stickers.map(s => ({ ...s, image: undefined, _imgSrc: s.image?.src })))),
            textNodes: JSON.parse(JSON.stringify(textNodes)),
        }]);
        setRedoStack([]);
    }, [stickers, textNodes]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const snapshot = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, {
            stickers: JSON.parse(JSON.stringify(stickers.map(s => ({ ...s, image: undefined, _imgSrc: s.image?.src })))),
            textNodes: JSON.parse(JSON.stringify(textNodes)),
        }]);
        // Restore text nodes directly
        setTextNodes(snapshot.textNodes.map(t => ({ ...t, isFlat: true })));
        // For stickers we need to restore images from src
        const restoredStickers = snapshot.stickers.map(s => {
            if (s._imgSrc) {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.src = s._imgSrc;
                return { ...s, image: img, isFlat: true };
            }
            return { ...s, isFlat: true };
        });
        setStickers(restoredStickers);
        setUndoStack(prev => prev.slice(0, -1));
        setTimeout(() => triggerExport(), 200);
    }, [undoStack, stickers, textNodes, triggerExport]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const snapshot = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, {
            stickers: JSON.parse(JSON.stringify(stickers.map(s => ({ ...s, image: undefined, _imgSrc: s.image?.src })))),
            textNodes: JSON.parse(JSON.stringify(textNodes)),
        }]);
        setTextNodes(snapshot.textNodes.map(t => ({ ...t, isFlat: true })));
        const restoredStickers = snapshot.stickers.map(s => {
            if (s._imgSrc) {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.src = s._imgSrc;
                return { ...s, image: img, isFlat: true };
            }
            return { ...s, isFlat: true };
        });
        setStickers(restoredStickers);
        setRedoStack(prev => prev.slice(0, -1));
        setTimeout(() => triggerExport(), 200);
    }, [redoStack, stickers, textNodes, triggerExport]);

    const handleCanvasRotate = useCallback(() => {
        setCanvasRotation(prev => (prev + 90) % 360);
    }, []);

    const handleToggleOutlines = useCallback(() => {
        setShowOutlines(prev => !prev);
    }, []);

    const handleModelReady = useCallback(() => {
        setIsModelReady(true);
    }, []);

    // ── Konva sizing (memoized) ──
    const maxSize = 600;
    const ratio = useMemo(() => {
        if (!maskImg) return 1;
        if (isMobile) {
            const availableW = window.innerWidth - 64; // pad left/right 32px
            const availableH = 450; // generous height
            // Avoid upscaling on mobile: enlarging low/small sticker sources causes visible blur.
            return Math.min(1, availableW / maskImg.naturalWidth, availableH / maskImg.naturalHeight);
        }
        return Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight);
    }, [maskImg, isMobile]);
    const stageW = useMemo(() => maskImg ? maskImg.naturalWidth * ratio : maxSize, [maskImg, ratio]);
    const stageH = useMemo(() => maskImg ? maskImg.naturalHeight * ratio : maxSize, [maskImg, ratio]);

    const displayW = stageW;
    const displayH = stageH;
    const layerRotation = 0;
    const layerX = 0;
    const canvasDpr = isMobile ? [1, 1.5] : [1.25, 2];
    const shadowMapSize = isMobile ? [512, 512] : [1024, 1024];
    const getDefaultStagePosition = useCallback((scale = defaultStageScale) => {
        if (!maskImg) return { x: 0, y: 0 };
        return {
            x: Math.round((stageW * (1 - scale)) / 2),
            y: Math.round((stageH * (1 - scale)) / 2),
        };
    }, [defaultStageScale, maskImg, stageW, stageH]);

    useEffect(() => {
        if (!maskImg || hasInitializedViewportRef.current) return;
        setStageScale(defaultStageScale);
        setStagePosition(getDefaultStagePosition(defaultStageScale));
        hasInitializedViewportRef.current = true;
    }, [maskImg, defaultStageScale, getDefaultStagePosition]);

    const handleZoomIn = useCallback(() => {
        setStageScale(prev => Math.min(5, prev * 1.2));
    }, []);

    const handleZoomOut = useCallback(() => {
        setStageScale(prev => Math.max(0.1, prev / 1.2));
    }, []);

    const handleResetZoom = useCallback(() => {
        setStageScale(defaultStageScale);
        setStagePosition(getDefaultStagePosition(defaultStageScale));
    }, [defaultStageScale, getDefaultStagePosition]);
    const isActuallyLoading = (glbUrl && !isModelReady) || (maskImg && !colorCanvasImg) || (glbUrl && maskImg && colorCanvasImg && !textureDataUrl);

    const workflowLoadingCopy = useMemo(() => {
        if (glbUrl && !isModelReady) {
            return {
                title: isPreview ? 'Loading 3D Preview' : 'Loading 3D Model',
                subtitle: 'Preparing the garment model and materials.'
            };
        }
        if (maskImg && !colorCanvasImg) {
            return {
                title: 'Preparing UV Canvas',
                subtitle: 'Building the editable panel map.'
            };
        }
        if (glbUrl && maskImg && colorCanvasImg && !textureDataUrl) {
            return {
                title: isPreview ? 'Generating Preview' : 'Generating Texture',
                subtitle: 'Applying the design to the live render.'
            };
        }
        return {
            title: 'Preparing Editor',
            subtitle: 'Finishing the workspace setup.'
        };
    }, [glbUrl, isModelReady, maskImg, colorCanvasImg, textureDataUrl, isPreview]);

    useEffect(() => {
        setIsWorkflowReady(!isActuallyLoading);
    }, [isActuallyLoading]);

    const workflowLoadingOverlay = isActuallyLoading ? (
        <div className={`fixed inset-0 ${isPreview ? 'bg-slate-950/80' : 'bg-slate-950/45'} backdrop-blur-md z-[140] flex items-center justify-center px-6`}>
            <div className={`w-full max-w-md rounded-[2rem] border ${isPreview ? 'border-white/12 bg-slate-950/88 text-white' : 'border-white/70 bg-white/88 text-slate-900'} shadow-2xl p-8 text-center`}>
                <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] ${isPreview ? 'bg-white/8' : 'bg-slate-900 text-white'} shadow-lg`}>
                    <div className={`h-7 w-7 rounded-full border-2 ${isPreview ? 'border-white/25 border-t-white' : 'border-white/30 border-t-white'} animate-spin`} />
                </div>
                <h2 className="text-lg font-bold">{workflowLoadingCopy.title}</h2>
                <p className={`mt-2 text-sm ${isPreview ? 'text-slate-300' : 'text-slate-500'}`}>{workflowLoadingCopy.subtitle}</p>
                {initialDesignData && (
                    <p className={`mt-4 text-xs uppercase tracking-[0.22em] ${isPreview ? 'text-slate-400' : 'text-slate-400'}`}>
                        Restoring saved design
                    </p>
                )}
            </div>
        </div>
    ) : null;

    // ── Stable handlers for Konva nodes ──
    const handleStickerSelect = useCallback((id, e) => {
        e.cancelBubble = true;
        setSelectedStickerId(id);
        setSelectedTextId(null);
        setPopup(null);
        setHighlightImg(null);
        if (trRef.current) {
            trRef.current.nodes([e.target]);
            trRef.current.getLayer().batchDraw();
        }
    }, []);

    const handleTextSelect = useCallback((id, e) => {
        e.cancelBubble = true;
        setSelectedTextId(id);
        setSelectedStickerId(null);
        setPopup(null);
        setHighlightImg(null);
        if (trRef.current) {
            trRef.current.nodes([e.target]);
            trRef.current.getLayer().batchDraw();
        }
    }, []);

    const handleStickerDragEnd = useCallback((id, e) => {
        const node = e.target;
        setStickers(prev => prev.map(s => s.id === id ? { ...s, x: node.x(), y: node.y(), isFlat: true } : s));
        triggerExport();
    }, [triggerExport]);

    const handleStickerTransformEnd = useCallback((id, e) => {
        const node = e.target;
        setStickers(prev => prev.map(s => s.id === id ? {
            ...s,
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
            isFlat: true
        } : s));
        triggerExport();
    }, [triggerExport]);

    const handleTextDragEnd = useCallback((id, e) => {
        const node = e.target;
        setTextNodes(prev => prev.map(t => t.id === id ? { ...t, x: node.x(), y: node.y(), isFlat: true } : t));
        triggerExport();
    }, [triggerExport]);

    const handleTextTransformEnd = useCallback((id, e) => {
        const node = e.target;
        setTextNodes(prev => prev.map(t => t.id === id ? {
            ...t, x: node.x(), y: node.y(),
            rotation: node.rotation(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            isFlat: true
        } : t));
        triggerExport();
    }, [triggerExport]);

    const aiDesignModal = (
        <AIDesignModal
            isOpen={showAiModal}
            onClose={() => { setShowAiModal(false); setAiScreenshots(null); }}
            prompt={aiPrompt}
            onPromptChange={setAiPrompt}
            onSubmit={handleAiSubmit}
            isSubmitting={isAiSubmitting}
            screenshots={aiScreenshots}
        />
    );

    const handleExitPreview = useCallback(() => {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('preview');
        setSearchParams(nextParams);
    }, [searchParams, setSearchParams]);

    const mobilePreviewLayout = (
        <>
            <div className="fixed inset-0 z-[120] bg-slate-950">
                <button
                    onClick={handleExitPreview}
                    className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                    aria-label="Close preview"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="absolute right-4 top-4 z-20 flex flex-col gap-3">
                    {isPreview && (
                        <button
                            onClick={handleOpenAiModal}
                            disabled={isAiSubmitting}
                            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-colors ${isAiSubmitting ? 'bg-slate-800 text-slate-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500'}`}
                            title="AI Design"
                        >
                            {isAiSubmitting ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Wand2 size={20} />}
                        </button>
                    )}
                </div>

                <div
                    ref={previewCanvasContainerRef}
                    className="h-[100dvh] w-full"
                    style={{
                        backgroundColor: bgType === 'solid' ? bgColor : bgType === 'transparent' ? 'transparent' : '#020617',
                        backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    <Canvas
                        shadows
                        camera={{ position: [0, 0, 4.5], fov: 45 }}
                        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: brightness, alpha: true }}
                        dpr={canvasDpr}
                    >
                        <ambientLight intensity={0.5 * brightness} />
                        <directionalLight position={[5, 10, 5]} intensity={1 * brightness} castShadow shadow-mapSize={shadowMapSize} />
                        {showAuxLights && (
                            <>
                                <pointLight position={[-5, 5, -5]} intensity={0.5 * brightness} color="#ffffff" />
                                <pointLight position={[5, -5, 5]} intensity={0.3 * brightness} color="#ffffff" />
                            </>
                        )}
                        <Environment preset={envPreset} background={false} />
                        <React.Suspense fallback={null}>
                            <Center>
                                <ModelViewer
                                    ref={modelViewerRef}
                                    modelUrl={glbUrl}
                                    textureDataUrl={textureDataUrl}
                                    flatMaskUrl={flatMaskUrl}
                                    materialSettings={materialSettings}
                                    baseColor={baseColor}
                                    pbrTextures={pbrTextures}
                                    onReady={handleModelReady}
                                />
                            </Center>
                            <CaptureController ref={captureRef} />
                            <ContactShadows position={[0, -1.1, 0]} opacity={0.4} scale={10} blur={2} />
                        </React.Suspense>
                        <OrbitControls makeDefault minDistance={2} maxDistance={8} enablePan={false} />
                    </Canvas>
                </div>
            </div>
            {maskImg && colorCanvasImg && (
                <div className="pointer-events-none fixed -left-[200vw] top-0 z-[-1] opacity-0" aria-hidden="true">
                    <div ref={canvasWrapperRef} className="overflow-hidden" style={{ width: displayW, height: displayH }}>
                        <Stage
                            width={displayW}
                            height={displayH}
                            scaleX={ratio * stageScale}
                            scaleY={ratio * stageScale}
                            x={stagePosition.x}
                            y={stagePosition.y}
                            ref={stageRef}
                            draggable={false}
                        >
                            <Layer
                                rotation={canvasRotation}
                                x={canvasRotation === 90 ? maskImg.naturalWidth : canvasRotation === 180 ? maskImg.naturalWidth : canvasRotation === 270 ? 0 : layerX}
                                y={canvasRotation === 90 ? 0 : canvasRotation === 180 ? maskImg.naturalHeight : canvasRotation === 270 ? maskImg.naturalHeight : 0}
                                imageSmoothingEnabled={false}
                            >
                                {showOutlines && <KImage id="base-color-canvas" image={colorCanvasImg} width={maskImg.naturalWidth} height={maskImg.naturalHeight} listening={false} shadowColor="#71717a" shadowBlur={3} shadowOffsetX={0} shadowOffsetY={0} shadowOpacity={0.6} />}
                                {highlightImg && (
                                    <KImage
                                        id="panel-highlight"
                                        image={highlightImg}
                                        width={maskImg.naturalWidth}
                                        height={maskImg.naturalHeight}
                                        listening={false}
                                        opacity={1}
                                    />
                                )}
                                {stickers.map((s) => (
                                    <KImage
                                        key={s.id}
                                        id={s.id}
                                        image={s.image}
                                        x={s.x}
                                        y={s.y}
                                        width={s.width}
                                        height={s.height}
                                        scaleX={s.scaleX || 1}
                                        scaleY={s.scaleY || 1}
                                        opacity={s.opacity ?? 1}
                                        rotation={s.rotation}
                                        listening={false}
                                    />
                                ))}
                                {textNodes.map((t) => (
                                    <Text
                                        key={t.id}
                                        id={t.id}
                                        text={t.text}
                                        x={t.x}
                                        y={t.y}
                                        fontSize={t.fontSize}
                                        fill={t.fill}
                                        fontFamily={t.fontFamily || 'Inter'}
                                        opacity={t.opacity ?? 1}
                                        scaleX={t.scaleX || 1}
                                        scaleY={t.scaleY || 1}
                                        rotation={t.rotation}
                                        fontStyle="bold"
                                        listening={false}
                                    />
                                ))}
                                <Transformer ref={trRef} borderStroke="#6366f1" anchorStroke="#6366f1" anchorFill="#ffffff" anchorSize={18} padding={6} borderDash={[2, 2]} />
                            </Layer>
                        </Stage>

                        <div style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }}>
                            <Stage width={displayW} height={displayH} scaleX={ratio} scaleY={ratio} ref={normalStageRef}>
                                <Layer rotation={layerRotation} x={layerX} y={0}>
                                    {stickers.map(s => (
                                        <FlatImageSticker key={s.id} sticker={s} />
                                    ))}
                                    {textNodes.map(t => (
                                        <Text
                                            key={t.id}
                                            text={t.text}
                                            fontFamily={t.fontFamily || 'Inter'}
                                            fontSize={t.fontSize}
                                            x={t.x}
                                            y={t.y}
                                            rotation={t.rotation}
                                            scaleX={t.scaleX || 1}
                                            scaleY={t.scaleY || 1}
                                            fill="#8080ff"
                                            fontStyle="bold"
                                            listening={false}
                                            opacity={t.opacity ?? 1}
                                        />
                                    ))}
                                </Layer>
                            </Stage>
                        </div>
                    </div>
                </div>
            )}
            {workflowLoadingOverlay}

        </>
    );

    return isMobile ? (
        isPreview ? mobilePreviewLayout : <>
            <div className="flex w-full h-[100dvh] bg-[#f8f9fc] overflow-hidden flex-col font-sans">
                {/* Header matches exactly */}
                <div className="px-4 py-3 w-full bg-white flex justify-between items-center shadow-sm z-50 pt-[env(safe-area-inset-top,12px)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[14px] flex items-center justify-center p-2 shadow-sm">
                            <Scan size={20} className="text-white" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm tracking-tight">{productName || 'hooide'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded-[20px]">
                        <div className="flex items-center px-2 text-slate-300 gap-1.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-undo-2"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-redo-2"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" /></svg>
                        </div>
                        <div className="w-px h-5 bg-slate-200 mx-0.5"></div>
                        <button onClick={handleSaveClick} disabled={isSaving} className="px-5 py-1.5 bg-[#4f46e5] hover:bg-indigo-600 text-white text-[11px] font-bold rounded-full shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                            {isSaving ? '...' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Main Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-20 scroll-smooth" id="mobile-scroll-container">

                    {/* 3D Preview Area Container */}
                    <div className={`p-4 ${isFullScreen ? 'fixed inset-0 z-[200] bg-black p-0' : 'relative w-full'}`}>
                        <div className={`w-full relative overflow-hidden flex items-center justify-center ${isFullScreen ? 'h-[100dvh] rounded-none' : 'aspect-[4/3] bg-gradient-to-b from-slate-50 to-[#eef2f6] rounded-3xl shadow-sm border border-white'}`}>

                            {!isFullScreen && (
                                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                                    <span className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">Live</span>
                                </div>
                            )}

                            {isFullScreen && (
                                <button onClick={() => setIsFullScreen(false)} className="absolute top-8 right-6 z-50 p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
                                    <X size={20} />
                                </button>
                            )}

                            <div ref={previewCanvasContainerRef} className="w-full h-full absolute inset-0" style={{
                                backgroundColor: bgType === 'solid' ? bgColor : bgType === 'transparent' ? 'transparent' : '#f8f9fc',
                                backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}>
                                <Canvas shadows camera={{ position: [0, 0, 4.5], fov: 45 }} gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: brightness, alpha: true }} dpr={canvasDpr}>
                                    <ambientLight intensity={0.5 * brightness} />
                                    <directionalLight position={[5, 10, 5]} intensity={1 * brightness} castShadow shadow-mapSize={shadowMapSize} />
                                    {showAuxLights && (
                                        <>
                                            <pointLight position={[-5, 5, -5]} intensity={0.5 * brightness} color="#ffffff" />
                                            <pointLight position={[5, -5, 5]} intensity={0.3 * brightness} color="#ffffff" />
                                        </>
                                    )}
                                    <Environment preset={envPreset} background={false} />
                                    <React.Suspense fallback={null}>
                                        <Center><ModelViewer modelUrl={glbUrl} textureDataUrl={textureDataUrl} flatMaskUrl={flatMaskUrl} materialSettings={materialSettings} baseColor={baseColor} pbrTextures={pbrTextures} onReady={handleModelReady} /></Center>
                                        <CaptureController ref={captureRef} />
                                        <ContactShadows position={[0, -1.1, 0]} opacity={0.4} scale={10} blur={2} />
                                    </React.Suspense>
                                    <OrbitControls makeDefault minDistance={2} maxDistance={8} enablePan={false} />
                                </Canvas>
                            </div>

                            {/* Floating Buttons in 3D View */}
                            {!isFullScreen && (
                                <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2.5">
                                    <button className="w-10 h-10 bg-white/90 backdrop-blur rounded-[14px] flex items-center justify-center text-slate-500 shadow-sm hover:shadow active:scale-95 transition-all">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                                    </button>
                                    <button onClick={() => { document.getElementById('mobile-scroll-container').scrollTo({ top: 300, behavior: 'smooth' }) }} className="w-10 h-10 bg-[#7c3aed] rounded-[14px] flex items-center justify-center text-white shadow-lg shadow-purple-500/30 active:scale-95 transition-all">
                                        <Layers size={18} strokeWidth={2.5} />
                                    </button>
                                    <button onClick={handleARLaunch} disabled={isExportingAR} className={`w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm active:scale-95 transition-all ${isExportingAR ? 'bg-slate-200 text-slate-400' : 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/20 hover:shadow'}`}>
                                        {isExportingAR ? <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-white animate-spin" /> : <Camera size={18} strokeWidth={2.5} />}
                                    </button>
                                    <button onClick={() => setIsFullScreen(true)} className="w-10 h-10 bg-white/90 backdrop-blur rounded-[14px] flex items-center justify-center text-slate-500 shadow-sm hover:shadow active:scale-95 transition-all">
                                        <Maximize size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pill Tabs */}
                    <div className="flex justify-center gap-3 px-4 mb-8 mt-2">
                        {['design', 'studio', 'uploads'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 rounded-full text-xs font-bold transition-all shadow-sm ${activeTab === tab
                                    ? 'bg-[#1e293b] text-white shadow-md'
                                    : 'bg-white text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* TAB CONTENT: DESIGN */}
                    {activeTab === 'design' && (
                        <div className="px-4 space-y-8 pb-12">
                            {/* The Single Mesh 2D Editor */}
                            <div className="w-full">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Part</span>
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">1 Parts</span>
                                </div>

                                {/* Blue Accent exactly like original layout representation for active part */}
                                <div className="w-64 max-w-full px-2">
                                    <div className="border border-indigo-500 bg-indigo-50/50 p-2 rounded w-full flex justify-center text-[10px] font-bold text-indigo-500 mb-6 uppercase tracking-wider">
                                        Main_Mesh
                                    </div>
                                </div>

                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-4 px-1">2D Mesh Editor</h3>

                                <div className="w-full relative bg-[#e2e8f0] rounded-3xl overflow-hidden shadow-inner border border-slate-300">
                                    {maskImg && colorCanvasImg ? (
                                        <div className="w-full flex justify-center py-6 px-4" ref={canvasWrapperRef} style={{ cursor: activeTool === 'hand' ? 'grab' : 'default' }}>
                                            <Stage
                                                width={displayW}
                                                height={displayH}
                                                scaleX={ratio * stageScale}
                                                scaleY={ratio * stageScale}
                                                x={stagePosition.x}
                                                y={stagePosition.y}
                                                ref={stageRef}
                                                draggable={activeTool === 'hand'}
                                                onDragEnd={handleStageDragEnd}
                                                onWheel={handleWheel}
                                                onClick={(activeTool === 'select' && !isPreview) ? handleStageClick : undefined}
                                                onTap={(activeTool === 'select' && !isPreview) ? handleStageClick : undefined}
                                            >
                                                <Layer rotation={canvasRotation} x={canvasRotation === 90 ? maskImg.naturalWidth : canvasRotation === 180 ? maskImg.naturalWidth : canvasRotation === 270 ? 0 : layerX} y={canvasRotation === 90 ? 0 : canvasRotation === 180 ? maskImg.naturalHeight : canvasRotation === 270 ? maskImg.naturalHeight : 0} imageSmoothingEnabled={false}>
                                                    {showOutlines && <KImage id="base-color-canvas" image={colorCanvasImg} width={maskImg.naturalWidth} height={maskImg.naturalHeight} listening={false} shadowColor="#71717a" shadowBlur={3} shadowOffsetX={0} shadowOffsetY={0} shadowOpacity={0.6} />}
                                                    {highlightImg && (
                                                        <KImage
                                                            id="panel-highlight"
                                                            image={highlightImg}
                                                            width={maskImg.naturalWidth}
                                                            height={maskImg.naturalHeight}
                                                            listening={false}
                                                            opacity={1}
                                                        />
                                                    )}
                                                    {stickers.map((s) => (
                                                        <KImage
                                                            key={s.id} id={s.id} image={s.image}
                                                            x={s.x} y={s.y} width={s.width} height={s.height}
                                                            scaleX={s.scaleX || 1} scaleY={s.scaleY || 1}
                                                            opacity={s.opacity ?? 1}
                                                            rotation={s.rotation} draggable={activeTool === 'select'}
                                                            onMouseDown={(e) => handleStickerSelect(s.id, e)}
                                                            onClick={(e) => handleStickerSelect(s.id, e)}
                                                            onTap={(e) => handleStickerSelect(s.id, e)}
                                                            onDragEnd={(e) => handleStickerDragEnd(s.id, e)}
                                                            onTransformEnd={(e) => handleStickerTransformEnd(s.id, e)}
                                                        />
                                                    ))}
                                                    {textNodes.map((t) => (
                                                        <Text
                                                            key={t.id} id={t.id} text={t.text}
                                                            x={t.x} y={t.y} fontSize={t.fontSize} fill={t.fill}
                                                            fontFamily={t.fontFamily || 'Inter'}
                                                            opacity={t.opacity ?? 1}
                                                            scaleX={t.scaleX || 1} scaleY={t.scaleY || 1}
                                                            rotation={t.rotation} fontStyle="bold" draggable={activeTool === 'select'}
                                                            onMouseDown={(e) => handleTextSelect(t.id, e)}
                                                            onClick={(e) => handleTextSelect(t.id, e)}
                                                            onTap={(e) => handleTextSelect(t.id, e)}
                                                            onDragEnd={(e) => handleTextDragEnd(t.id, e)}
                                                            onTransformEnd={(e) => handleTextTransformEnd(t.id, e)}
                                                        />
                                                    ))}
                                                    <Transformer ref={trRef} borderStroke="#6366f1" anchorStroke="#6366f1" anchorFill="#ffffff" anchorSize={18} padding={6} borderDash={[2, 2]} />
                                                </Layer>
                                            </Stage>

                                            {/* HIDDEN NORMAL MAP STAGE FOR MOBILE */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }}>
                                                <Stage width={displayW} height={displayH} scaleX={ratio} scaleY={ratio} ref={normalStageRef}>
                                                    <Layer rotation={layerRotation} x={layerX} y={0}>
                                                        {/* We DO NOT draw the mesh outline here, otherwise the entire t-shirt gets flattened! */}
                                                        {stickers.map(s => {
                                                            return <FlatImageSticker key={s.id} sticker={s} />;
                                                        })}
                                                        {textNodes.map(t => {
                                                            return <Text key={t.id} text={t.text} fontFamily={t.fontFamily || 'Inter'} fontSize={t.fontSize} x={t.x} y={t.y} rotation={t.rotation} scaleX={t.scaleX || 1} scaleY={t.scaleY || 1} fill="#8080ff" fontStyle="bold" listening={false} opacity={t.opacity ?? 1} />;
                                                        })}
                                                    </Layer>
                                                </Stage>
                                            </div>

                                            {popup && (
                                                <FaceColorPopup
                                                    position={{ x: Math.min(popup.screenX, window.innerWidth - 280), y: Math.min(popup.screenY, window.innerHeight - 350) }}
                                                    currentColor={popup.currentColor}
                                                    onColorChange={handlePopupColorChange}
                                                    onClose={() => { setPopup(null); setHighlightImg(null); }}
                                                />
                                            )}

                                            {maskImg && colorCanvasImg && selectedTextId && (() => {
                                                const t = textNodes.find(n => n.id === selectedTextId);
                                                if (!t) return null;
                                                const node = stageRef.current?.findOne(n => n.id() === t.id);
                                                const absPos = node ? node.getAbsolutePosition() : { x: t.x * ratio, y: t.y * ratio };
                                                const estimatedWidth = (t.text?.length * t.fontSize * 0.5) || 80;
                                                const currentScale = node ? node.scaleX() * ratio : ratio;
                                                const centerOffset = (estimatedWidth * currentScale) / 2;
                                                return (
                                                    <FloatingTextToolbar
                                                        sticker={t} containerRef={canvasWrapperRef}
                                                        position={{ left: absPos.x + centerOffset, top: absPos.y - 45 }}
                                                        onChange={(updates) => handleTextChange(t.id, updates)}
                                                        onDuplicate={() => handleDuplicateText(t.id)}
                                                        onDelete={() => {
                                                            setTextNodes(prev => prev.filter(n => n.id !== t.id));
                                                            setSelectedTextId(null);
                                                            setTimeout(() => triggerExport(), 100);
                                                        }}
                                                        onMoveForward={() => handleMoveTextForward(t.id)}
                                                        onMoveBackward={() => handleMoveTextBackward(t.id)}
                                                    />
                                                );
                                            })()}

                                            {maskImg && colorCanvasImg && selectedStickerId && (() => {
                                                const s = stickers.find(n => n.id === selectedStickerId);
                                                if (!s) return null;
                                                const node = stageRef.current?.findOne(n => n.id() === s.id);
                                                const absPos = node ? node.getAbsolutePosition() : { x: s.x * ratio, y: s.y * ratio };
                                                const currentScale = node ? node.scaleX() * ratio : ratio;
                                                const centerOffset = ((s.width || 80) * currentScale) / 2;
                                                return (
                                                    <FloatingImageToolbar
                                                        sticker={s} containerRef={canvasWrapperRef}
                                                        position={{ left: absPos.x + centerOffset, top: absPos.y - 45 }}
                                                        onChange={(updates) => handleStickerChange(s.id, updates)}
                                                        onDuplicate={() => handleDuplicateSticker(s.id)}
                                                        onDelete={() => {
                                                            setStickers(prev => prev.filter(n => n.id !== s.id));
                                                            setSelectedStickerId(null);
                                                            setTimeout(() => triggerExport(), 100);
                                                        }}
                                                        onMoveForward={() => handleMoveStickerForward(s.id)}
                                                        onMoveBackward={() => handleMoveStickerBackward(s.id)}
                                                        onMoveToFront={() => handleMoveStickerToFront(s.id)}
                                                        onMoveToBack={() => handleMoveStickerToBack(s.id)}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 text-slate-400 p-12">
                                            <ImageIcon size={32} className="text-slate-300 opacity-50" />
                                            <p className="text-[11px] font-semibold tracking-wider text-slate-400 text-center uppercase">Loading Mesh...</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Floating Bottom Toolbar (Mobile) ── */}
                                {maskImg && colorCanvasImg && (
                                    <div className="w-full overflow-x-auto mt-3 mb-1 px-2 no-scrollbar">
                                        <div className="inline-flex items-center gap-px bg-white rounded-2xl shadow-md border border-slate-200 px-1.5 py-1 mx-auto" style={{ minWidth: 'max-content' }}>
                                            {/* Select */}
                                            <button
                                                onClick={() => setActiveTool('select')}
                                                className={`p-1.5 rounded-lg transition-all ${activeTool === 'select' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}
                                            >
                                                <MousePointer2 size={14} />
                                            </button>
                                            {/* Hand */}
                                            <button
                                                onClick={() => setActiveTool('hand')}
                                                className={`p-1.5 rounded-lg transition-all ${activeTool === 'hand' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}
                                            >
                                                <Hand size={14} />
                                            </button>

                                            <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

                                            {/* Undo */}
                                            <button onClick={handleUndo} disabled={undoStack.length === 0}
                                                className={`p-1.5 rounded-lg transition-all ${undoStack.length === 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                                                <RotateCcw size={14} />
                                            </button>
                                            {/* Redo */}
                                            <button onClick={handleRedo} disabled={redoStack.length === 0}
                                                className={`p-1.5 rounded-lg transition-all ${redoStack.length === 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                                                <RotateCw size={14} />
                                            </button>

                                            <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

                                            {/* Zoom − */}
                                            <button onClick={handleZoomOut} className="p-1.5 rounded-lg text-slate-400 transition-all">
                                                <ZoomOut size={14} />
                                            </button>
                                            {/* % */}
                                            <button onClick={handleResetZoom}
                                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 rounded-md min-w-[36px] text-center">
                                                {zoomPercent}%
                                            </button>
                                            {/* Zoom + */}
                                            <button onClick={handleZoomIn} className="p-1.5 rounded-lg text-slate-400 transition-all">
                                                <ZoomIn size={14} />
                                            </button>

                                            <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

                                            {/* Rotate */}
                                            <button onClick={handleCanvasRotate} className="p-1.5 rounded-lg text-slate-400 transition-all">
                                                <RotateCwIcon size={14} />
                                            </button>
                                            {/* Outline */}
                                            <button onClick={handleToggleOutlines}
                                                className={`p-1.5 rounded-lg transition-all ${showOutlines ? 'text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                                <EyeIcon size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* UPLOAD GLB & UV SECTION (Mobile) */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Base Models</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-center active:scale-95">
                                        <Upload size={18} className="text-slate-400 mb-2" />
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">3D Model (GLB)</span>
                                        <input type="file" accept=".glb" onChange={handleGlbUpload} className="hidden" />
                                    </label>
                                    <label className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-center active:scale-95">
                                        <Upload size={18} className="text-slate-400 mb-2" />
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">UV Map (PNG)</span>
                                        <input type="file" accept="image/*" onChange={handleMaskUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            {/* Existing Text Tools */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Text Layer</h3>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={textInput}
                                            onChange={(e) => setTextInput(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                                            placeholder="Add text..."
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddText}
                                    disabled={!textInput.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} strokeWidth={2.5} /> Add Text
                                </button>
                            </div>

                            {/* Material Settings */}
                            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Material</h3>
                                </div>

                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Base Tint</span>
                                    <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Roughness</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={materialSettings.roughness ?? DEFAULT_MATERIAL_SETTINGS.roughness}
                                            onChange={(e) => handleMaterialSettingChange('roughness', parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sheen</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={materialSettings.sheen ?? DEFAULT_MATERIAL_SETTINGS.sheen}
                                            onChange={(e) => handleMaterialSettingChange('sheen', parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-500"
                                        />
                                    </div>
                                </div>

                                <PbrTextureUploader
                                    pbrTextures={pbrTextures}
                                    materialSettings={materialSettings}
                                    onUpload={handlePbrTextureUpload}
                                    onClear={handleClearPbrTexture}
                                    onClearAll={handleClearAllPbrTextures}
                                    onMaterialSettingChange={handleMaterialSettingChange}
                                />
                            </div>

                            {(selectedStickerId || selectedTextId) && (
                                <button
                                    onClick={() => {
                                        if (selectedStickerId) handleDeleteSticker();
                                        if (selectedTextId) handleDeleteText();
                                    }}
                                    className="w-full py-3 border-2 border-red-100 text-red-500 hover:bg-red-50 font-bold text-sm tracking-wide uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <Trash size={16} strokeWidth={2.5} /> Remove Layer
                                </button>
                            )}
                        </div>
                    )}

                    {/* TAB CONTENT: STUDIO */}
                    {activeTab === 'studio' && (
                        <div className="px-4 space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Lighting */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Environment</h3>
                                    <button
                                        onClick={() => setShowAuxLights(!showAuxLights)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${showAuxLights ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                        {showAuxLights ? 'Aux ON' : 'Aux OFF'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <span>Intensity</span>
                                        <span>{brightness.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range" min="0.2" max="3" step="0.1"
                                        value={brightness}
                                        onChange={(e) => setBrightness(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none accent-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <button onClick={() => setEnvPreset('studio')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${envPreset === 'studio' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}><Sun size={18} strokeWidth={2} /><span className="text-[9px] font-bold uppercase">Studio</span></button>
                                    <button onClick={() => setEnvPreset('city')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${envPreset === 'city' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}><Building2 size={18} strokeWidth={2} /><span className="text-[9px] font-bold uppercase">City</span></button>
                                    <button onClick={() => setEnvPreset('dawn')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${envPreset === 'dawn' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}><Cloud size={18} strokeWidth={2} /><span className="text-[9px] font-bold uppercase">Dawn</span></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: UPLOADS */}
                    {activeTab === 'uploads' && (
                        <div className="px-4 space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-3 text-center">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                                    <ImageIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Upload Decals</h3>
                                    <p className="text-[11px] font-medium text-slate-500 mt-1">Add PNG or JPG stickers</p>
                                </div>
                                <div className="relative mt-2">
                                    <button className="px-6 py-2.5 bg-[#4f46e5] hover:bg-indigo-600 text-white font-bold text-xs rounded-full shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                        Browse Files
                                    </button>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleStickerUpload}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
            {aiDesignModal}
            {workflowLoadingOverlay}
        </>

    ) : (
        <>
            <div ref={containerRef} className="flex w-full h-full relative bg-[#f8f9fc] overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>

                {/* Mobile Toggles */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-zinc-200"
                >
                    <Menu size={20} className="text-zinc-700" />
                </button>
                <button
                    onClick={() => setPreviewOpen(!previewOpen)}
                    className="lg:hidden fixed top-4 right-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-zinc-200"
                >
                    {previewOpen ? <EyeOff size={20} className="text-zinc-700" /> : <Eye size={20} className="text-zinc-700" />}
                </button>

                {/* ═══ LEFT SIDEBAR ═══ */}
                {!isPreview && (
                    <div className={`
                    w-full sm:w-[250px] 
                    bg-[#f8f9fc] border-r border-zinc-200 
                    flex flex-col z-40 h-[calc(100vh_-_80px)] shadow-xl
                    transition-transform duration-300 absolute lg:relative
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                        {/* TABS HEADER */}
                        <div className="flex items-center p-2 gap-1 bg-white border-b border-zinc-100 mx-2 mt-4 rounded-xl shadow-sm">
                            {[
                                { id: 'design', label: 'Design', icon: <Layers size={14} /> },
                                { id: 'studio', label: 'Studio', icon: <Settings size={14} /> },
                                { id: 'uploads', label: 'Uploads', icon: <ImageIcon size={14} /> }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all sm:text-xs items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md ring-1 ring-zinc-100' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                                >
                                    <span className="shrink-0">{tab.icon}</span>
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* SCROLLABLE CONTENT */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">

                            {/* --- DESIGN TAB --- */}
                            {activeTab === 'design' && (
                                <>
                                    {/* UPLOAD GLB & UV SECTION (Desktop) */}
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Base Models</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors text-center active:scale-95">
                                                <Upload size={16} className="text-zinc-400 mb-2" />
                                                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">3D Model (GLB)</span>
                                                <input type="file" accept=".glb" onChange={handleGlbUpload} className="hidden" />
                                            </label>
                                            <label className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors text-center active:scale-95">
                                                <Upload size={16} className="text-zinc-400 mb-2" />
                                                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">UV Map (PNG)</span>
                                                <input type="file" accept="image/*" onChange={handleMaskUpload} className="hidden" />
                                            </label>
                                        </div>
                                    </div>

                                    {/* TEXT LAYER SECTION */}
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Text Layer</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={textInput}
                                                    onChange={(e) => setTextInput(e.target.value)}
                                                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm font-medium rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                                    placeholder="Add text..."
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg">
                                                    <Check size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={handleAddText}
                                                disabled={!textInput.trim()}
                                                className="col-span-2 bg-[#3B82F6] hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus size={16} /> Add Text
                                            </button>
                                        </div>
                                    </div>

                                    {/* MATERIAL / FABRIC SECTION */}
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Material</h3>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Base Color / Tint */}
                                            <div className="flex flex-col gap-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Base Tint</span>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" disabled={!enableBaseColor} value={baseColor} onChange={(e) => setBaseColor(e.target.value)} className={`w-6 h-6 rounded cursor-pointer border-0 p-0 shadow-sm transition-opacity ${enableBaseColor ? 'opacity-100' : 'opacity-50'}`} />
                                                    </div>
                                                </div>
                                                <label className="flex items-center gap-2 px-1 cursor-pointer group">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${enableBaseColor ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-zinc-300'}`}>
                                                        {enableBaseColor && <Check size={12} strokeWidth={3} />}
                                                    </div>
                                                    <input type="checkbox" checked={enableBaseColor} onChange={(e) => setEnableBaseColor(e.target.checked)} className="hidden" />
                                                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider group-hover:text-zinc-700 transition-colors">Apply Map Color</span>
                                                </label>
                                            </div>

                                            {/* Basic Material Props */}
                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-50">
                                                <div className="space-y-2">
                                                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Roughness</span>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={materialSettings.roughness ?? DEFAULT_MATERIAL_SETTINGS.roughness}
                                                        onChange={(e) => handleMaterialSettingChange('roughness', parseFloat(e.target.value))}
                                                        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-purple-500"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Sheen</span>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={materialSettings.sheen ?? DEFAULT_MATERIAL_SETTINGS.sheen}
                                                        onChange={(e) => handleMaterialSettingChange('sheen', parseFloat(e.target.value))}
                                                        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-purple-500"
                                                    />
                                                </div>
                                            </div>

                                            <PbrTextureUploader
                                                pbrTextures={pbrTextures}
                                                materialSettings={materialSettings}
                                                onUpload={handlePbrTextureUpload}
                                                onClear={handleClearPbrTexture}
                                                onClearAll={handleClearAllPbrTextures}
                                                onMaterialSettingChange={handleMaterialSettingChange}
                                            />
                                        </div>
                                    </div>

                                    {/* REMOVE LAYER */}
                                    {(selectedStickerId || selectedTextId) && (
                                        <button
                                            onClick={() => {
                                                if (selectedStickerId) handleDeleteSticker();
                                                if (selectedTextId) handleDeleteText();
                                            }}
                                            className="w-full py-3.5 border border-red-100 text-red-500 hover:bg-red-50 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all mt-4"
                                        >
                                            <Trash size={16} /> Remove Layer
                                        </button>
                                    )}
                                </>
                            )}

                            {/* --- STUDIO TAB (Lighting & Background) --- */}
                            {activeTab === 'studio' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Environment */}
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Environment</h3>
                                            <button
                                                onClick={() => setShowAuxLights(!showAuxLights)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${showAuxLights ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-400'}`}
                                            >
                                                <Lightbulb size={12} />
                                                {showAuxLights ? 'Aux ON' : 'Aux OFF'}
                                            </button>
                                        </div>

                                        {/* Brightness slider */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                                <span>Intensity</span>
                                                <span>{brightness.toFixed(1)}x</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.2"
                                                max="3"
                                                step="0.1"
                                                value={brightness}
                                                onChange={(e) => setBrightness(Number(e.target.value))}
                                                className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none accent-indigo-600 cursor-pointer"
                                            />
                                        </div>

                                        {/* Presets */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={() => setEnvPreset('studio')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'studio' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Sun size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">Studio</span></button>
                                            <button onClick={() => setEnvPreset('city')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'city' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Building2 size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">City</span></button>
                                            <button onClick={() => setEnvPreset('dawn')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'dawn' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Cloud size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">Dawn</span></button>
                                            <button onClick={() => setEnvPreset('forest')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'forest' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Trees size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">Forest</span></button>
                                            <button onClick={() => setEnvPreset('warehouse')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'warehouse' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Moon size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">Night</span></button>
                                            <button onClick={() => setEnvPreset('sunset')} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${envPreset === 'sunset' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}><Sunset size={16} /><span className="text-[9px] font-bold uppercase tracking-wide">Sunset</span></button>
                                        </div>
                                    </div>

                                    {/* Background */}
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Background</h3>
                                        <div className="grid grid-cols-4 gap-2">
                                            <button onClick={() => { setBgType('solid'); setBgColor('#FFFFFF'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'solid' && bgColor === '#FFFFFF' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                                <div className="w-5 h-5 rounded-full bg-white border border-zinc-200" />
                                                <span className="text-[8px] font-bold uppercase text-zinc-600">Light</span>
                                            </button>
                                            <button onClick={() => { setBgType('solid'); setBgColor('#262626'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'solid' && bgColor === '#262626' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                                <div className="w-5 h-5 rounded-full bg-[#262626] border border-zinc-200" />
                                                <span className="text-[8px] font-bold uppercase text-zinc-600">Dark</span>
                                            </button>
                                            <button onClick={() => { setBgType('transparent'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'transparent' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                                <Scan size={16} className="text-zinc-400" />
                                                <span className="text-[8px] font-bold uppercase text-zinc-600">Trans</span>
                                            </button>
                                            <div
                                                onClick={() => {
                                                    if (bgImage) { setBgType('image'); } else { bgImageFileInputRef.current?.click(); }
                                                }}
                                                className={`relative p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${bgType === 'image' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-100'}`}
                                            >
                                                {bgImage ? (
                                                    <div className="w-5 h-5 rounded-md overflow-hidden border border-zinc-200">
                                                        <img src={bgImage} alt="bg" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <ImageIcon size={16} className="text-zinc-400" />
                                                )}
                                                <span className="text-[8px] font-bold uppercase text-zinc-600">Image</span>

                                                {/* Hidden File Input */}
                                                <input
                                                    ref={bgImageFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        if (e.target.files[0]) {
                                                            setBgImage(URL.createObjectURL(e.target.files[0]));
                                                            setBgType('image');
                                                        }
                                                        e.target.value = null;
                                                    }}
                                                    className="hidden"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- UPLOADS TAB --- */}
                            {activeTab === 'uploads' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Uploads</label>

                                    {/* Image Sticker Upload matches DesignPhase exact styling */}
                                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-200 rounded-[2.5rem] bg-zinc-50/50 hover:bg-white transition-all cursor-pointer group shadow-inner">
                                        <Upload size={32} className="text-zinc-300 group-hover:text-indigo-500 mb-4 transition-colors" />
                                        <span className="text-xs font-bold text-zinc-500 group-hover:text-indigo-600 uppercase tracking-widest">Upload Image</span>
                                        <input type="file" accept="image/*" onChange={handleStickerUpload} className="hidden" />
                                    </label>

                                    {/* Show active stickers in Uploads tab, like DesignPhase */}
                                    {stickers.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            {stickers.map((s, i) => (
                                                <div key={s.id} className="bg-white border border-zinc-100 rounded-[2rem] p-4 shadow-xl shadow-indigo-100/50 flex items-center justify-between transition-all hover:border-indigo-200">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-100 overflow-hidden shrink-0 flex justify-center items-center">
                                                            <img src={s.image.src} alt="Active" className="max-w-full max-h-full object-contain" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">Layer {i + 1}</p>
                                                            <p className="text-[10px] text-zinc-400">Position in Canvas</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedStickerId(s.id); handleDeleteSticker(); }}
                                                        className="text-red-500 bg-red-50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ CENTER: 2D WORKSPACE ═══ */}
                <div className="flex-1 relative overflow-hidden bg-[#f8f9fc] ml-0 lg:ml-0">
                    {/* FLOATING HEADER */}
                    {!isPreview && (
                        <div className="absolute top-6 left-6 lg:left-8 z-10 flex items-center gap-4 hidden md:flex">
                            <button
                                onClick={handleSaveClick}
                                disabled={isSaving}
                                className={`px-5 py-2 rounded-[14px] text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-[#4f46e5] hover:bg-indigo-600 text-white'}`}
                            >
                                {isSaving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save size={16} />}
                                {isSaving ? 'Saving...' : 'Save Product'}
                            </button>
                        </div>
                    )}

                    {/* Konva Canvas area */}
                    <div className="w-full h-full overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:32px_32px] flex items-center justify-center p-8 lg:pr-[410px]">
                        {maskImg && colorCanvasImg ? (
                            <div className="relative flex flex-col items-center">
                                {/* Floating Mesh Toolbar (like DesignPhase) */}
                                <div className="sticky top-0 z-20 flex flex-col items-center mb-1">

                                    {/* Connecting line */}

                                </div>

                                <div ref={canvasWrapperRef} className="rounded-lg overflow-hidden border border-zinc-200" style={{ width: stageW, height: stageH, pointerEvents: isPreview ? 'none' : 'auto', backgroundColor: 'transparent', cursor: activeTool === 'hand' ? 'grab' : 'default' }}>
                                    <Stage
                                        width={stageW} height={stageH}
                                        scaleX={ratio * stageScale} scaleY={ratio * stageScale}
                                        x={stagePosition.x} y={stagePosition.y}
                                        ref={stageRef}
                                        draggable={activeTool === 'hand'}
                                        onDragEnd={handleStageDragEnd}
                                        onWheel={handleWheel}
                                        onClick={activeTool === 'select' && !isPreview ? handleStageClick : undefined}
                                        onTap={activeTool === 'select' && !isPreview ? handleStageClick : undefined}
                                    >
                                        <Layer rotation={canvasRotation} x={canvasRotation === 90 ? maskImg.naturalWidth : canvasRotation === 180 ? maskImg.naturalWidth : canvasRotation === 270 ? 0 : 0} y={canvasRotation === 90 ? 0 : canvasRotation === 180 ? maskImg.naturalHeight : canvasRotation === 270 ? maskImg.naturalHeight : 0} imageSmoothingEnabled={false}>
                                            {showOutlines && <KImage id="base-color-canvas" image={colorCanvasImg} width={maskImg.naturalWidth} height={maskImg.naturalHeight} listening={false} shadowColor="#71717a" shadowBlur={3} shadowOffsetX={0} shadowOffsetY={0} shadowOpacity={0.6} />}

                                            {/* Panel selection highlight overlay */}
                                            {highlightImg && (
                                                <KImage
                                                    id="panel-highlight"
                                                    image={highlightImg}
                                                    width={maskImg.naturalWidth}
                                                    height={maskImg.naturalHeight}
                                                    listening={false}
                                                    opacity={1}
                                                />
                                            )}

                                            {stickers.map((s) => (
                                                <KImage
                                                    key={s.id} id={s.id} image={s.image}
                                                    x={s.x} y={s.y} width={s.width} height={s.height}
                                                    opacity={s.opacity ?? 1}
                                                    rotation={s.rotation} draggable={activeTool === 'select'}
                                                    onMouseDown={(e) => handleStickerSelect(s.id, e)}
                                                    onClick={(e) => handleStickerSelect(s.id, e)}
                                                    onTap={(e) => handleStickerSelect(s.id, e)}
                                                    onDragEnd={(e) => handleStickerDragEnd(s.id, e)}
                                                    onTransformEnd={(e) => handleStickerTransformEnd(s.id, e)}
                                                />
                                            ))}

                                            {/* Text Nodes */}
                                            {textNodes.map((t) => (
                                                <Text
                                                    key={t.id} id={t.id} text={t.text}
                                                    x={t.x} y={t.y} fontSize={t.fontSize} fill={t.fill}
                                                    fontFamily={t.fontFamily || 'Inter'}
                                                    opacity={t.opacity ?? 1}
                                                    scaleX={t.scaleX || 1} scaleY={t.scaleY || 1}
                                                    rotation={t.rotation} fontStyle="bold" draggable={activeTool === 'select'}
                                                    onMouseDown={(e) => handleTextSelect(t.id, e)}
                                                    onClick={(e) => handleTextSelect(t.id, e)}
                                                    onTap={(e) => handleTextSelect(t.id, e)}
                                                    onDragEnd={(e) => handleTextDragEnd(t.id, e)}
                                                    onTransformEnd={(e) => handleTextTransformEnd(t.id, e)}
                                                />
                                            ))}

                                            <Transformer ref={trRef} borderStroke="#4f46e5" anchorStroke="#4f46e5" anchorFill="#ffffff" anchorSize={12} padding={5} borderDash={[2, 2]} />
                                        </Layer>
                                    </Stage>

                                    {/* HIDDEN FLAT MASK STAGE - renders every sticker/text into the flatten mask */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }}>
                                        <Stage
                                            width={stageW} height={stageH}
                                            scaleX={ratio} scaleY={ratio}
                                            ref={normalStageRef}
                                        >
                                            <Layer>
                                                {stickers.map(s => {
                                                    return <FlatImageSticker key={s.id} sticker={s} />;
                                                })}
                                                {textNodes.map(t => {
                                                    return (
                                                        <Text
                                                            key={t.id}
                                                            text={t.text}
                                                            x={t.x} y={t.y}
                                                            fontSize={t.fontSize}
                                                            fontFamily={t.fontFamily || 'Inter'}
                                                            fontStyle="bold"
                                                            scaleX={t.scaleX || 1} scaleY={t.scaleY || 1}
                                                            rotation={t.rotation}
                                                            fill="#8080ff"
                                                            listening={false}
                                                            opacity={t.opacity ?? 1}
                                                        />
                                                    );
                                                })}
                                            </Layer>
                                        </Stage>
                                    </div>
                                </div>

                                {/* ── Floating Bottom Toolbar (Desktop) ── */}
                                <div className="sticky bottom-0 z-20 flex items-center justify-center mt-4 pb-2">
                                    <div className="inline-flex items-center gap-0.5 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-zinc-200 px-3 py-2">
                                        {/* Select Tool */}
                                        <button
                                            onClick={() => setActiveTool('select')}
                                            className={`p-2.5 rounded-xl transition-all ${activeTool === 'select' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                                            title="Select Tool (V)"
                                        >
                                            <MousePointer2 size={18} />
                                        </button>
                                        {/* Hand/Pan Tool */}
                                        <button
                                            onClick={() => setActiveTool('hand')}
                                            className={`p-2.5 rounded-xl transition-all ${activeTool === 'hand' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                                            title="Pan Tool (H)"
                                        >
                                            <Hand size={18} />
                                        </button>

                                        <div className="w-px h-6 bg-zinc-200 mx-1.5" />

                                        {/* Undo */}
                                        <button
                                            onClick={handleUndo}
                                            disabled={undoStack.length === 0}
                                            className={`p-2.5 rounded-xl transition-all ${undoStack.length === 0 ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                                            title="Undo (Ctrl+Z)"
                                        >
                                            <RotateCcw size={18} />
                                        </button>
                                        {/* Redo */}
                                        <button
                                            onClick={handleRedo}
                                            disabled={redoStack.length === 0}
                                            className={`p-2.5 rounded-xl transition-all ${redoStack.length === 0 ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                                            title="Redo (Ctrl+Y)"
                                        >
                                            <RotateCw size={18} />
                                        </button>

                                        <button
                                            onClick={handleSaveClick}
                                            disabled={isSaving}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${isSaving ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                            title="Save Design"
                                        >
                                            {isSaving ? (
                                                <div className="h-4 w-4 rounded-full border-2 border-indigo-500/35 border-t-indigo-600 animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            <span className="text-xs font-semibold">{isSaving ? 'Saving...' : 'Save'}</span>
                                        </button>

                                        <div className="w-px h-6 bg-zinc-200 mx-1.5" />

                                        {/* Zoom Out */}
                                        <button
                                            onClick={handleZoomOut}
                                            className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-all"
                                            title="Zoom Out"
                                        >
                                            <ZoomOut size={18} />
                                        </button>
                                        {/* Zoom Percentage */}
                                        <button
                                            onClick={handleResetZoom}
                                            className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all min-w-[52px] text-center"
                                            title="Reset Zoom (Click to reset)"
                                        >
                                            {zoomPercent}%
                                        </button>
                                        {/* Zoom In */}
                                        <button
                                            onClick={handleZoomIn}
                                            className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-all"
                                            title="Zoom In"
                                        >
                                            <ZoomIn size={18} />
                                        </button>


                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-zinc-400 bg-white/50 p-12 rounded-3xl border-2 border-dashed border-zinc-300">
                                <ImageIcon size={48} strokeWidth={1.5} className="text-zinc-300" />
                                <p className="text-sm font-semibold text-zinc-500">Upload a UV map to start editing</p>
                            </div>
                        )}
                    </div>

                    {/* ── Face Color Popup (positioned over 2D workspace) ── */}
                    {popup && (
                        <FaceColorPopup
                            position={{ x: popup.screenX, y: popup.screenY }}
                            currentColor={popup.currentColor}
                            onColorChange={handlePopupColorChange}
                            onClose={() => { setPopup(null); setHighlightImg(null); }}
                        />
                    )}

                    {/* ── Floating Text Toolbar ── */}
                    {maskImg && colorCanvasImg && selectedTextId && (() => {
                        const t = textNodes.find(n => n.id === selectedTextId);
                        if (!t) return null;
                        const scaledX = (t.x * ratio);
                        const scaledY = (t.y * ratio);
                        const estimatedWidth = (t.scaleX || 1) * (t.text?.length * t.fontSize * 0.5) || 80;
                        const centerOffset = (estimatedWidth * ratio) / 2;
                        return (
                            <FloatingTextToolbar
                                sticker={t}
                                containerRef={canvasWrapperRef}
                                position={{
                                    left: scaledX + centerOffset,
                                    top: scaledY
                                }}
                                onChange={(updates) => handleTextChange(t.id, updates)}
                                onDuplicate={() => handleDuplicateText(t.id)}
                                onDelete={() => {
                                    setTextNodes(prev => prev.filter(n => n.id !== t.id));
                                    setSelectedTextId(null);
                                    setTimeout(() => triggerExport(), 100);
                                }}
                                onMoveForward={() => handleMoveTextForward(t.id)}
                                onMoveBackward={() => handleMoveTextBackward(t.id)}
                            />
                        );
                    })()}

                    {/* ── Floating Image Toolbar ── */}
                    {maskImg && colorCanvasImg && selectedStickerId && (() => {
                        const s = stickers.find(n => n.id === selectedStickerId);
                        if (!s) return null;
                        const scaledX = (s.x * ratio);
                        const scaledY = (s.y * ratio);
                        const centerOffset = ((s.width || 80) * ratio) / 2;
                        return (
                            <FloatingImageToolbar
                                sticker={s}
                                containerRef={canvasWrapperRef}
                                position={{
                                    left: scaledX + centerOffset,
                                    top: scaledY
                                }}
                                onChange={(updates) => handleStickerChange(s.id, updates)}
                                onDuplicate={() => handleDuplicateSticker(s.id)}
                                onDelete={() => {
                                    setStickers(prev => prev.filter(n => n.id !== s.id));
                                    setSelectedStickerId(null);
                                    setTimeout(() => triggerExport(), 100);
                                }}
                                onMoveForward={() => handleMoveStickerForward(s.id)}
                                onMoveBackward={() => handleMoveStickerBackward(s.id)}
                                onMoveToFront={() => handleMoveStickerToFront(s.id)}
                                onMoveToBack={() => handleMoveStickerToBack(s.id)}
                            />
                        );
                    })()}
                </div>

                {/* ═══ RIGHT: 3D PREVIEW ═══ */}
                <div className={`
                ${isPreview ? 'absolute inset-0 w-full h-full' : 'fixed lg:absolute top-0 lg:top-6 right-0 lg:right-6 bottom-0 lg:bottom-6 w-full sm:w-[340px] lg:w-[380px]'}
                pointer-events-none flex flex-col justify-start ${isPreview ? 'z-50' : 'z-30'}
                transition-transform duration-300
                ${(previewOpen || isPreview) ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                    <div className={`bg-white ${isPreview ? 'h-full rounded-none' : 'rounded-none lg:rounded-[2.5rem] h-full lg:h-[580px]'} shadow-2xl overflow-hidden pointer-events-auto flex flex-col relative transition-all border border-zinc-100`}>

                        {/* Live Render Badge */}
                        <div className="absolute top-8 left-8 z-50 pointer-events-auto">
                            <div className="bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2 shadow-sm border border-white/50">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-bold tracking-widest text-zinc-900 uppercase">Live Render</span>
                            </div>
                        </div>

                        <div className="absolute top-8 right-8 z-50 pointer-events-auto flex flex-col gap-2">

                            {isPreview && (
                                <button
                                    onClick={handleOpenAiModal}
                                    disabled={isAiSubmitting}
                                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wide shadow-sm transition-all ${isAiSubmitting ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-white/85 text-zinc-700 border border-white/70 backdrop-blur-xl hover:bg-white'}`}
                                >
                                    {isAiSubmitting ? <div className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" /> : <Wand2 size={15} />}
                                    <span>AI Design</span>
                                </button>
                            )}

                            <button
                                onClick={handleARLaunch}
                                disabled={isExportingAR}
                                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wide shadow-md transition-all ${isExportingAR ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                                {isExportingAR ? <div className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" /> : <Camera size={15} />}
                                <span>{isExportingAR ? 'Preparing...' : 'AR View'}</span>
                            </button>
                        </div>

                        <div
                            ref={previewCanvasContainerRef}
                            className="flex-1 shadow-inner min-h-0 relative border-l border-zinc-200"
                            style={{
                                backgroundColor: bgType === 'solid' ? bgColor : bgType === 'transparent' ? 'transparent' : '#1e1e1e',
                                backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >
                            <Canvas shadows camera={{ position: [0, 0, 4.5], fov: 45 }} gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: brightness, alpha: true }} dpr={canvasDpr}>
                                <ambientLight intensity={0.5 * brightness} />
                                <directionalLight position={[5, 10, 5]} intensity={1 * brightness} castShadow shadow-mapSize={shadowMapSize} />

                                {showAuxLights && (
                                    <>
                                        <pointLight position={[-5, 5, -5]} intensity={0.5 * brightness} color="#ffffff" />
                                        <pointLight position={[5, -5, 5]} intensity={0.3 * brightness} color="#ffffff" />
                                    </>
                                )}

                                <Environment preset={envPreset} background={false} />

                                <React.Suspense fallback={null}>
                                    <Center><ModelViewer ref={modelViewerRef} modelUrl={glbUrl} textureDataUrl={textureDataUrl} flatMaskUrl={flatMaskUrl} materialSettings={materialSettings} baseColor={baseColor} pbrTextures={pbrTextures} onReady={handleModelReady} /></Center>
                                    <CaptureController ref={captureRef} />
                                    <ContactShadows position={[0, -1.1, 0]} opacity={0.4} scale={10} blur={2} />
                                </React.Suspense>
                                <OrbitControls makeDefault minDistance={2} maxDistance={8} enablePan={false} />
                            </Canvas>
                        </div>
                    </div>
                </div>
            </div>
            {aiDesignModal}
            {workflowLoadingOverlay}
            {isSaveModalOpen && (
                <SaveProductModal
                    isOpen={isSaveModalOpen}
                    onClose={() => setIsSaveModalOpen(false)}
                    onConfirm={handleConfirmSave}
                    isSaving={isSaving}
                    snapshotUrl={saveSnapshot}
                    categories={categories}
                    subCategories={subCategories}
                    initialData={initialProductData}
                />
            )}
        </>
    );
};



// ═══════════════════════════════════════════════════
// ── Save Modal Component (Adapted from DesignPhase) ──
// ═══════════════════════════════════════════════════
const AIDesignModal = React.memo(({ isOpen, onClose, prompt, onPromptChange, onSubmit, isSubmitting, screenshots }) => {
    if (!isOpen) return null;
    const previewImages = screenshots || {};
    const orderedViews = ['front', 'right', 'back', 'left'];
    const hasAllViews = orderedViews.every(view => previewImages[view]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative min-h-[280px] bg-slate-100 p-4 lg:p-5">
                    {hasAllViews ? (
                        <div className="grid h-full min-h-[280px] grid-cols-2 gap-3">
                            {orderedViews.map((view) => (
                                <div key={view} className="relative overflow-hidden rounded-[1.4rem] bg-slate-200">
                                    <img src={previewImages[view]} alt={`${view} preview capture`} className="h-full w-full object-cover" />
                                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                                        {view}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[280px] items-center justify-center text-slate-400">
                            <Camera size={32} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col p-6 lg:p-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">AI Design</h3>
                            <p className="mt-1 text-sm text-slate-500">Send four 3D reference views to `/generate-design`: front, right, back, and left.</p>
                        </div>
                        <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mt-6 flex-1 space-y-3">
                        <label className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            className="h-44 w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
                            placeholder="Describe the design you want to generate from this 3D view."
                        />
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                            Cancel
                        </button>
                        <button
                            onClick={onSubmit}
                            disabled={isSubmitting || !prompt.trim() || !hasAllViews}
                            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all ${isSubmitting || !prompt.trim() || !hasAllViews ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'}`}
                        >
                            {isSubmitting ? <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Wand2 size={16} />}
                            <span>{isSubmitting ? 'Generating...' : 'Generate'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

const SaveProductModal = React.memo(({ isOpen, onClose, onConfirm, isSaving, snapshotUrl, categories, subCategories, initialData }) => {
    const [name, setName] = useState(initialData?.name || "");
    const [categoryId, setCategoryId] = useState(initialData?.category || "");
    const [subcategoryId, setSubcategoryId] = useState(initialData?.subcategory || "");
    const [isCloth, setIsCloth] = useState(initialData?.isCloth || false);
    const [imagePreview, setImagePreview] = useState(snapshotUrl);
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => {
        if (isOpen) {
            // Only reset if no initial data, or reset to initial data
            setName(initialData?.name || "");
            setCategoryId(initialData?.category || "");
            setSubcategoryId(initialData?.subcategory || "");
            setIsCloth(initialData?.isCloth || false);
            setImagePreview(snapshotUrl);
            setImageFile(null);
        }
    }, [isOpen, snapshotUrl, initialData]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
    };

    const handleSave = async () => {
        let blob = imageFile;
        if (!blob && snapshotUrl && !imageFile) {
            try {
                const res = await fetch(snapshotUrl);
                blob = await res.blob();
            } catch (e) { console.error("Snapshot blob failed", e); }
        }
        onConfirm({ name, categoryId, subcategoryId, isCloth, imageBlob: blob });
    };

    const filteredSubCategories = subCategories.filter(s => s.categoryId == categoryId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-800">Save Product</h3>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Image Preview */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Image</label>
                        <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
                            {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-gray-300 flex flex-col items-center"><ImageIcon size={32} /><span className="text-xs mt-2">No Preview</span></div>}
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="bg-white text-gray-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg"><Camera size={16} />Change Image</div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Product Name</label>
                        <input type="text" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Shirt" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Category</label>
                            <select className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}>
                                <option value="" disabled>Select Category</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Subcategory</label>
                            <select className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} disabled={!categoryId}>
                                <option value="" disabled>Select Subcategory</option>
                                {filteredSubCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">Is this a Cloth?</span>
                        <button onClick={() => setIsCloth(!isCloth)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCloth ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCloth ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex gap-3 justify-end">
                    <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || !name || !categoryId || !subcategoryId} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2">
                        {isSaving ? "Saving..." : <><Save size={18} /> Confirm Save</>}
                    </button>
                </div>
            </div>
        </div>
    );
});

// Sub-component to handle isolated masking for Flat Images on Mobile
const FlatImageSticker = ({ sticker }) => {
    const groupRef = React.useRef(null);
    React.useEffect(() => {
        if (groupRef.current) groupRef.current.cache();
    }, [sticker]);
    return (
        <Group ref={groupRef} x={sticker.x} y={sticker.y} rotation={sticker.rotation} scaleX={sticker.scaleX || 1} scaleY={sticker.scaleY || 1} width={sticker.width} height={sticker.height}>
            <KImage image={sticker.image} width={sticker.width} height={sticker.height} listening={false} />
            <Rect width={sticker.width} height={sticker.height} fill="#8080ff" listening={false} globalCompositeOperation="source-in" />
        </Group>
    );
};

export default TestUVWorkflow;
