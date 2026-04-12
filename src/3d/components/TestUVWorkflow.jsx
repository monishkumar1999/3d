import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center, ContactShadows } from '@react-three/drei';
import { Stage, Layer, Image as KImage, Transformer, Rect, Group } from 'react-konva';
import { Upload, Palette, Image as ImageIcon, X, Save, Camera } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { processWireframeToSolid } from '../utils/maskProcessor';
import api from '../../api/axios';

// ── Color Presets ──
const COLOR_PRESETS = [
    '#ffffff', '#e2e8f0', '#94a3b8', '#1e293b',
    '#dc2626', '#f97316', '#f59e0b', '#22c55e',
    '#2563eb', '#7c3aed', '#ec4899', '#be185d',
];

const MIN_TEXTURE_REPEAT = 0.25;
const MAX_TEXTURE_REPEAT = 24;
const DEFAULT_MATERIAL_SETTINGS = {
    roughness: 0.8,
    metalness: 0,
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

const buildScaledCanvas = (sourceCanvas, width, height) => {
    if (!sourceCanvas || !width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    return canvas;
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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(overlayCanvas, 0, 0, width, height);
    }

    return compositeCanvas.toDataURL('image/png');
};

// ═══════════════════════════════════════════
// ── Face Color Popup ──
// ═══════════════════════════════════════════
const FaceColorPopup = ({ position, currentColor, onColorChange, onClose }) => {
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

    // Sync hex input on hue/sat/val change
    useEffect(() => {
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
    const style = {
        position: 'absolute',
        left: Math.min(position.x, window.innerWidth - 320),
        top: Math.min(position.y - 10, window.innerHeight - 400),
        zIndex: 100,
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
};


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
    const timeoutRef = useRef(null);
    return useCallback((...args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callback(...args), delay);
    }, [callback, delay]);
};

const PbrTextureUploader = ({ pbrTextures, materialSettings, onUpload, onClear, onClearAll, onMaterialSettingChange }) => {
    const hasAnyPbrMaps = PBR_MAP_SLOTS.some(({ key }) => Boolean(pbrTextures[key]));
    const uploadedCount = PBR_MAP_SLOTS.filter(({ key }) => Boolean(pbrTextures[key])).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-sm">
                        <Palette size={14} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Materials</p>
                        <h3 className="text-sm font-bold text-slate-900">PBR Maps</h3>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {uploadedCount}/{PBR_MAP_SLOTS.length}
                    </span>
                    {hasAnyPbrMaps && (
                        <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors">
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* PBR Slot Grid */}
            <div className="grid grid-cols-2 gap-2">
                {PBR_MAP_SLOTS.map(({ key, label, hint }) => {
                    const currentFile = pbrTextures[key];
                    return (
                        <label
                            key={key}
                            className={`group cursor-pointer rounded-xl border p-2.5 transition-all duration-150 ${currentFile
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white'
                                }`}
                        >
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => onUpload(key, e)}
                                className="hidden"
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${currentFile ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{label}</span>
                                </div>
                                {currentFile ? (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(key); }}
                                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 hover:text-red-500 border border-slate-200 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                ) : (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-500">
                                        <Upload size={10} />
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 truncate text-[10px] text-slate-400">{currentFile ? currentFile.name : hint}</p>
                        </label>
                    );
                })}
            </div>

            {/* Sliders */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Texture Repeat</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{formatTextureRepeat(materialSettings.textureRepeat)}x</span>
                    </div>
                    <input
                        type="range"
                        min={MIN_TEXTURE_REPEAT}
                        max={MAX_TEXTURE_REPEAT}
                        step="0.25"
                        value={materialSettings.textureRepeat}
                        onChange={(e) => onMaterialSettingChange('textureRepeat', parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full bg-slate-200 appearance-none accent-indigo-500"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Normal Strength</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{(materialSettings.normalIntensity ?? 1).toFixed(1)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={materialSettings.normalIntensity ?? 1}
                        onChange={(e) => onMaterialSettingChange('normalIntensity', parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full bg-slate-200 appearance-none accent-indigo-500"
                    />
                </div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
// ── 3D Model Viewer ──
// ═══════════════════════════════════════════
const ModelViewer = ({ modelUrl, textureDataUrl, pbrTextures, materialSettings }) => {
    const [model, setModel] = useState(null);
    const managedTexturesRef = useRef([]);
    const managedMaterialsRef = useRef([]);
    const { gl } = useThree();

    const disposeManagedResources = useCallback(() => {
        managedTexturesRef.current.forEach((texture) => texture?.dispose?.());
        managedTexturesRef.current = [];
        managedMaterialsRef.current.forEach((material) => material?.dispose?.());
        managedMaterialsRef.current = [];
    }, []);

    useEffect(() => () => {
        disposeManagedResources();
    }, [disposeManagedResources]);

    useEffect(() => {
        if (!modelUrl) {
            disposeManagedResources();
            setModel(null);
            return;
        }

        const loader = new GLTFLoader();
        loader.load(modelUrl, (gltf) => {
            const scene = gltf.scene;
            scene.traverse((child) => {
                if (!child.isMesh) return;
                if (!child.userData.originalMat) {
                    child.userData.originalMat = Array.isArray(child.material)
                        ? child.material.map((material) => material.clone())
                        : child.material.clone();
                }
                child.castShadow = true;
                child.receiveShadow = true;
            });
            setModel(scene);
        }, undefined, (err) => console.error('GLB Error:', err));
    }, [disposeManagedResources, modelUrl]);

    useEffect(() => {
        if (!model) return;

        let cancelled = false;

        const registerTexture = (texture) => {
            managedTexturesRef.current.push(texture);
            return texture;
        };

        const registerMaterial = (material) => {
            managedMaterialsRef.current.push(material);
            return material;
        };

        const createTexture = (image, { colorSpace = null, repeat = 1 } = {}) => {
            if (!image) return null;

            const safeRepeat = clampTextureRepeat(repeat);
            const texture = new THREE.Texture(image);
            texture.flipY = false;
            if (colorSpace) texture.colorSpace = colorSpace;
            texture.anisotropy = gl.capabilities.getMaxAnisotropy();
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
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

        const cloneToPhysicalMaterial = (sourceMaterial) => {
            if (sourceMaterial?.type === 'MeshPhysicalMaterial') {
                return registerMaterial(sourceMaterial.clone());
            }

            const material = new THREE.MeshPhysicalMaterial();
            material.name = sourceMaterial?.name || '';
            if (sourceMaterial?.color) material.color.copy(sourceMaterial.color);
            if (sourceMaterial?.map) material.map = sourceMaterial.map;
            if (sourceMaterial?.normalMap) material.normalMap = sourceMaterial.normalMap;
            if (sourceMaterial?.roughnessMap) material.roughnessMap = sourceMaterial.roughnessMap;
            if (sourceMaterial?.metalnessMap) material.metalnessMap = sourceMaterial.metalnessMap;
            if (sourceMaterial?.aoMap) material.aoMap = sourceMaterial.aoMap;
            if (sourceMaterial?.transparent !== undefined) material.transparent = sourceMaterial.transparent;
            if (sourceMaterial?.opacity !== undefined) material.opacity = sourceMaterial.opacity;
            if (sourceMaterial?.side !== undefined) material.side = sourceMaterial.side;
            return registerMaterial(material);
        };

        const loadOptionalImage = async (src) => {
            if (!src) return null;
            try {
                return await loadImageElement(src);
            } catch (error) {
                console.warn('Skipping texture map:', error);
                return null;
            }
        };

        const runMaterialUpdate = async () => {
            const [mainImage, normalImage, roughnessImage, metalnessImage, aoImage, ormImage] = await Promise.all([
                loadOptionalImage(textureDataUrl),
                loadOptionalImage(pbrTextures.normal?.dataUrl),
                loadOptionalImage(pbrTextures.roughness?.dataUrl),
                loadOptionalImage(pbrTextures.metalness?.dataUrl),
                loadOptionalImage(pbrTextures.ao?.dataUrl),
                loadOptionalImage(pbrTextures.orm?.dataUrl),
            ]);

            if (cancelled) return;

            disposeManagedResources();

            const textureRepeat = clampTextureRepeat(materialSettings.textureRepeat ?? DEFAULT_MATERIAL_SETTINGS.textureRepeat);
            const uploadedMapTextures = {
                normal: createTexture(normalImage, { repeat: textureRepeat }),
                roughness: createTexture(roughnessImage, { repeat: textureRepeat }),
                metalness: createTexture(metalnessImage, { repeat: textureRepeat }),
                ao: createTexture(aoImage, { repeat: textureRepeat }),
                orm: createTexture(ormImage, { repeat: textureRepeat }),
            };
            const mainTexture = createTexture(mainImage, { colorSpace: THREE.SRGBColorSpace });

            model.traverse((child) => {
                if (!child.isMesh) return;

                const applyToMaterial = (sourceMaterial) => {
                    const material = cloneToPhysicalMaterial(sourceMaterial);
                    material.side = THREE.DoubleSide;
                    material.roughness = materialSettings.roughness ?? DEFAULT_MATERIAL_SETTINGS.roughness;
                    material.metalness = uploadedMapTextures.metalness || uploadedMapTextures.orm
                        ? 1
                        : (materialSettings.metalness ?? DEFAULT_MATERIAL_SETTINGS.metalness);

                    if (mainTexture) {
                        material.map = mainTexture;
                        material.color.set('#ffffff');
                    }

                    if (uploadedMapTextures.orm) {
                        material.aoMap = uploadedMapTextures.orm;
                        material.roughnessMap = uploadedMapTextures.orm;
                        material.metalnessMap = uploadedMapTextures.orm;
                    }
                    if (uploadedMapTextures.ao) material.aoMap = uploadedMapTextures.ao;
                    if (uploadedMapTextures.roughness) material.roughnessMap = uploadedMapTextures.roughness;
                    if (uploadedMapTextures.metalness) material.metalnessMap = uploadedMapTextures.metalness;
                    if (uploadedMapTextures.normal) {
                        material.normalMap = uploadedMapTextures.normal;
                        if (!material.normalScale) material.normalScale = new THREE.Vector2(1, 1);
                        const normalIntensity = materialSettings.normalIntensity ?? DEFAULT_MATERIAL_SETTINGS.normalIntensity;
                        material.normalScale.set(normalIntensity, normalIntensity);
                    }

                    if (material.aoMap && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
                        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
                    }

                    material.needsUpdate = true;
                    return material;
                };

                if (Array.isArray(child.userData.originalMat)) {
                    child.material = child.userData.originalMat.map((material) => applyToMaterial(material));
                } else {
                    child.material = applyToMaterial(child.userData.originalMat || child.material);
                }
            });
        };

        runMaterialUpdate();

        return () => {
            cancelled = true;
        };
    }, [disposeManagedResources, gl, materialSettings, model, pbrTextures, textureDataUrl]);

    if (!model) return null;
    return <primitive object={model} />;
};


// ═══════════════════════════════════════════════════
// ── Main Component ──
// ═══════════════════════════════════════════════════
const TestUVWorkflow = ({ initialGlbUrl, initialMaskUrl, initialProductData }) => {
    const [glbUrl, setGlbUrl] = useState(initialGlbUrl || null);
    const [glbFileName, setGlbFileName] = useState('');
    const [maskImg, setMaskImg] = useState(null);

    const [colorCanvasImg, setColorCanvasImg] = useState(null);
    const [stickers, setStickers] = useState([]);
    const [selectedStickerId, setSelectedStickerId] = useState(null);
    const [textureDataUrl, setTextureDataUrl] = useState(null);
    const [highlightImg, setHighlightImg] = useState(null);
    const [materialSettings, setMaterialSettings] = useState(DEFAULT_MATERIAL_SETTINGS);
    const [pbrTextures, setPbrTextures] = useState(() => ({ ...EMPTY_PBR_TEXTURES }));

    // Popup state
    const [popup, setPopup] = useState(null);

    const stageRef = useRef(null);
    const trRef = useRef(null);
    const colorCanvasRef = useRef(null);
    const containerRef = useRef(null);

    // ── Handle GLB Upload ──
    const handleGlbUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (glbUrl) URL.revokeObjectURL(glbUrl);
        setGlbUrl(URL.createObjectURL(file));
        setGlbFileName(file.name);
    };

    // ── Save State & Logic ──
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [saveSnapshot, setSaveSnapshot] = useState(null);
    const [originalMaskFile, setOriginalMaskFile] = useState(null);

    // Initial Data Loading
    useEffect(() => {
        if (initialGlbUrl) setGlbUrl(initialGlbUrl);

        if (initialMaskUrl) {
            // Process the initial mask URL similar to upload
            processWireframeToSolid(initialMaskUrl)
                .then((solidDataUrl) => {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.src = solidDataUrl;
                    img.onload = () => { setMaskImg(img); initColorCanvas(img); };
                })
                .catch((err) => {
                    console.error('Initial mask process failed:', err);
                    // Fallback to using raw URL if processing fails (might be already processed)
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.src = initialMaskUrl;
                    img.onload = () => { setMaskImg(img); initColorCanvas(img); };
                });

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

    const handleSaveClick = () => {
        // Capture screenshot of the 3D canvas
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                setSaveSnapshot(canvas.toDataURL('image/png'));
            }
        } catch (e) {
            console.error("Snapshot failed", e);
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
            // We Treat the generated texture as the "white" mask? 
            // OR: we send the actual maskImg as "white" and the generated texture as an extra or just rely on the preview?
            // User said: "store this glb and png". The PNG usually refers to the Texture.
            // But the API structure expects `svgdetails`. Let's assume we map the Texture to "white" for now strictly to save it, 
            // OR we save the maskImg as white and the original as original.
            // The generated colorful texture is what makes the product look unique. 
            // Ideally we'd save the Texture as a separate asset or the 'image' of a generated product variant.
            // For this flow, let's strictly follow DesignPhase structure: 
            // svgdetails[0][white] = processed mask (white shapes)
            // svgdetails[0][original] = original SVG
            // AND we will ALSO send the generated texture as a separate file if possible, or just assume the preview captures the look.
            // HOWEVER, if the user wants to EDIT it later with colors, we need the white mask. So we MUST save the mask.

            if (maskImg && originalMaskFile) {
                // 1. White Mask Blob
                // maskImg is an Image object with src=blob:... or data:...
                // We need to fetch it to get a blob
                const whiteRes = await fetch(maskImg.src);
                const whiteBlob = await whiteRes.blob();

                formData.append('svgdetails[0][mesh_name]', 'main_mesh'); // Default name since we don't have mesh selection here
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

    // ── Handle SVG/Texture Upload ──
    const handleMaskUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setOriginalMaskFile(file); // Store original for save
        const url = URL.createObjectURL(file);
        processWireframeToSolid(url)
            .then((solidDataUrl) => {
                const img = new window.Image();
                img.src = solidDataUrl;
                img.onload = () => { setMaskImg(img); initColorCanvas(img); };
            })
            .catch((err) => {
                console.error('processWireframeToSolid failed:', err);
                const img = new window.Image();
                img.src = url;
                img.onload = () => { setMaskImg(img); initColorCanvas(img); };
            })
            .finally(() => URL.revokeObjectURL(url));
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
        const dataUrl = canvas.toDataURL('image/png');
        const newImg = new window.Image();
        newImg.src = dataUrl;
        newImg.onload = () => setColorCanvasImg(newImg);
    };

    // ── Handle click on panel → open popup ──
    const handleStageClick = (e) => {
        if (!colorCanvasRef.current || !maskImg) return;

        // Skip if clicked on a sticker
        const target = e.target;
        if (target.id && target.id() && stickers.some(s => s.id === target.id())) return;

        const stage = e.target.getStage();
        const pointer = stage.getPointerPosition();
        const originalX = Math.round(pointer.x / ratio);
        const originalY = Math.round(pointer.y / ratio);

        // Check if this pixel is inside the mask (opaque)
        const canvas = colorCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(originalX, originalY, 1, 1).data;
        if (pixel[3] < 10) {
            // Clicked outside panels — close popup & highlight
            setPopup(null);
            setHighlightImg(null);
            setSelectedStickerId(null);
            return;
        }

        // Get current color at this pixel
        const currentHex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        // Get screen position for popup
        const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        const screenX = e.evt.clientX - containerRect.left + 20;
        const screenY = e.evt.clientY - containerRect.top - 30;

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
    };

    // ── When color changes from popup, flood-fill the panel ──
    const handlePopupColorChange = useCallback((hex) => {
        if (!popup || !colorCanvasRef.current) return;
        const canvas = colorCanvasRef.current;
        const ctx = canvas.getContext('2d');
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
            const newSticker = { id: Date.now().toString(), image: img, x: 50, y: 50, width: 120, height: 120, rotation: 0 };
            setStickers(prev => [...prev, newSticker]);
            setSelectedStickerId(newSticker.id);
            URL.revokeObjectURL(url);
            setTimeout(() => triggerExport(), 100);
        };
    };

    // ── Export Konva → Texture ──
    const handlePbrTextureUpload = async (mapKey, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await readFileAsDataUrl(file);
            const image = await loadImageElement(dataUrl);

            setPbrTextures((prev) => ({
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
        setPbrTextures((prev) => ({
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
        setMaterialSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
        if (key === 'textureRepeat') {
            setTimeout(() => triggerExport(), 100);
        }
    };

    const performExport = useCallback(() => {
        if (!stageRef.current || !maskImg) return;
        if (trRef.current) trRef.current.nodes([]);

        const baseNode = stageRef.current.findOne('#base-color-canvas');
        const wasBaseVisible = baseNode ? baseNode.visible() : false;
        const highlightNode = stageRef.current.findOne('#panel-highlight');
        const wasVisible = highlightNode ? highlightNode.visible() : false;
        if (baseNode) baseNode.visible(false);
        if (highlightNode) highlightNode.visible(false);

        const r = maskImg.naturalWidth > 0 ? Math.min(600 / maskImg.naturalWidth, 600 / maskImg.naturalHeight) : 1;
        const exportRatio = r > 0 ? (1 / r) : 2;
        const overlayCanvas = stageRef.current.toCanvas({ pixelRatio: exportRatio });
        const exportWidth = Math.max(1, Math.round(stageRef.current.width() * exportRatio));
        const exportHeight = Math.max(1, Math.round(stageRef.current.height() * exportRatio));
        const tintedBaseCanvas = buildScaledCanvas(colorCanvasRef.current, exportWidth, exportHeight);
        const pbrBaseCanvas = buildRepeatedTextureCanvas({
            image: pbrTextures.baseColor?.image,
            width: exportWidth,
            height: exportHeight,
            repeat: materialSettings.textureRepeat,
        });

        setTextureDataUrl(composeTextureDataUrl({
            overlayCanvas,
            tintedBaseCanvas,
            pbrBaseCanvas,
            width: exportWidth,
            height: exportHeight,
        }));

        if (baseNode && wasBaseVisible) baseNode.visible(true);
        if (highlightNode && wasVisible) highlightNode.visible(true);

        if (selectedStickerId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedStickerId);
            if (node) trRef.current.nodes([node]);
        }
    }, [maskImg, materialSettings.textureRepeat, pbrTextures.baseColor, selectedStickerId]);

    const triggerExport = useDebounce(performExport, 200);

    useEffect(() => {
        if (colorCanvasImg && maskImg) triggerExport();
    }, [colorCanvasImg, maskImg]);

    useEffect(() => {
        if (selectedStickerId && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedStickerId);
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) { trRef.current.nodes([]); }
    }, [selectedStickerId, stickers]);

    useEffect(() => { return () => { if (glbUrl) URL.revokeObjectURL(glbUrl); }; }, [glbUrl]);

    // ── Konva sizing ──
    const maxSize = 600;
    const ratio = maskImg ? Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight) : 1;
    const stageW = maskImg ? maskImg.naturalWidth * ratio : maxSize;
    const stageH = maskImg ? maskImg.naturalHeight * ratio : maxSize;
    const uploadedPbrCount = PBR_MAP_SLOTS.filter(({ key }) => Boolean(pbrTextures[key])).length;
    const hasWorkspaceAssets = Boolean(maskImg && colorCanvasImg);
    const modelLabel = glbFileName || 'Upload GLB';

    return (
        <div
            ref={containerRef}
            className="relative grid w-full gap-4 overflow-hidden p-4"
            style={{ height: 'calc(100vh - 80px)', gridTemplateColumns: 'minmax(0,1fr) 400px', background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f0f2f8 100%)' }}
        >
            {/* ═══ LEFT: 2D WORKSPACE ═══ */}
            <div className="min-w-0 flex flex-col gap-3 overflow-hidden">

                {/* Compact Toolbar */}
                <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/80 px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold tracking-tight text-slate-900">UV Design Editor</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${hasWorkspaceAssets ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${hasWorkspaceAssets ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                {hasWorkspaceAssets ? 'Live' : 'Idle'}
                            </span>
                            <span className="text-[11px] text-slate-400">{stickers.length} layer{stickers.length !== 1 ? 's' : ''} · {uploadedPbrCount} PBR</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <label className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${glbUrl ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>
                            <Upload size={14} />
                            <span>{glbUrl ? 'Model ✓' : '3D Model'}</span>
                            <input type="file" accept=".glb,.gltf" onChange={handleGlbUpload} className="hidden" />
                        </label>

                        <label className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${maskImg ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-600'}`}>
                            <ImageIcon size={14} />
                            <span>{maskImg ? 'UV ✓' : 'UV Map'}</span>
                            <input type="file" accept=".svg,.png,.jpg,.jpeg" onChange={handleMaskUpload} className="hidden" />
                        </label>

                        <label className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:-translate-y-0.5 hover:border-fuchsia-200 hover:text-fuchsia-600">
                            <Palette size={14} />
                            <span>Artwork</span>
                            <input type="file" accept="image/*" onChange={handleStickerUpload} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/80 bg-white/50 shadow-[0_4px_24px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                    <div className="flex min-h-full items-center justify-center p-6 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:28px_28px] rounded-2xl">
                        {maskImg && colorCanvasImg ? (
                            <div className="rounded-3xl border border-slate-700/80 bg-slate-950 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.40)]">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">UV Canvas</span>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
                                        {stickers.length} layer{stickers.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900" style={{ width: stageW, height: stageH }}>
                                    <Stage
                                        width={stageW} height={stageH} scaleX={ratio} scaleY={ratio}
                                        ref={stageRef}
                                        onClick={handleStageClick}
                                        onMouseUp={triggerExport}
                                        onDragEnd={triggerExport}
                                    >
                                        <Layer>
                                            <KImage id="base-color-canvas" image={colorCanvasImg} width={maskImg.naturalWidth} height={maskImg.naturalHeight} listening={false} />

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

                                            {stickers.map((s, i) => (
                                                <KImage
                                                    key={s.id} id={s.id} image={s.image}
                                                    x={s.x} y={s.y} width={s.width} height={s.height} rotation={s.rotation} draggable
                                                    onClick={(e) => { e.cancelBubble = true; setSelectedStickerId(s.id); setPopup(null); setHighlightImg(null); }}
                                                    onTransformEnd={(e) => {
                                                        const node = e.target;
                                                        const updated = [...stickers];
                                                        updated[i] = { ...updated[i], x: node.x(), y: node.y(), width: Math.max(5, node.width() * node.scaleX()), height: Math.max(5, node.height() * node.scaleY()), rotation: node.rotation() };
                                                        node.scaleX(1); node.scaleY(1);
                                                        setStickers(updated);
                                                        triggerExport();
                                                    }}
                                                />
                                            ))}

                                            <Transformer ref={trRef} borderStroke="#4f46e5" anchorStroke="#4f46e5" anchorFill="#ffffff" anchorSize={8} borderDash={[2, 2]} />
                                        </Layer>
                                    </Stage>
                                </div>
                            </div>
                        ) : (
                            <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-10 py-12 text-center shadow-[0_8px_32px_rgba(15,23,42,0.07)]">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-700 text-white shadow-lg shadow-indigo-600/30">
                                    <ImageIcon size={28} strokeWidth={1.8} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Upload a UV map</h3>
                                    <p className="mt-1 text-sm text-slate-500">Load a UV layout to unlock the canvas and start painting panels.</p>
                                </div>
                                <div className="flex flex-col gap-1.5 w-full text-left">
                                    {[{ n: '1', t: 'Upload a GLB model' }, { n: '2', t: 'Load your UV map' }, { n: '3', t: 'Paint & add artwork' }].map(({ n, t }) => (
                                        <div key={n} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-600">{n}</span>
                                            <span className="text-xs font-medium text-slate-600">{t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Face Color Popup */}
                {popup && (
                    <FaceColorPopup
                        position={{ x: popup.screenX, y: popup.screenY }}
                        currentColor={popup.currentColor}
                        onColorChange={handlePopupColorChange}
                        onClose={() => { setPopup(null); setHighlightImg(null); }}
                    />
                )}
            </div>

            {/* ═══ RIGHT: 3D PREVIEW + PBR ═══ */}
            <div className="min-h-0 flex flex-col gap-3 overflow-hidden">

                {/* 3D Preview Card */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-500/30">
                                <Camera size={14} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">3D Preview</h3>
                                <p className="text-[10px] text-slate-400">{hasWorkspaceAssets ? 'Synced from canvas' : 'Ready for setup'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${hasWorkspaceAssets ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {hasWorkspaceAssets ? '● Live' : '○ Idle'}
                            </span>
                            {uploadedPbrCount > 0 && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{uploadedPbrCount} PBR</span>
                            )}
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="h-[300px] min-h-[300px] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
                        <Canvas shadows camera={{ position: [0, 0, 4.5], fov: 45 }} gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: 3, toneMappingExposure: 1 }} dpr={[1, 1.5]}>
                            <ambientLight intensity={0.5} />
                            <directionalLight position={[5, 10, 5]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />
                            <hemisphereLight intensity={0.3} groundColor="#444" />
                            <React.Suspense fallback={null}>
                                <Center>
                                    <ModelViewer
                                        modelUrl={glbUrl}
                                        textureDataUrl={textureDataUrl}
                                        pbrTextures={pbrTextures}
                                        materialSettings={materialSettings}
                                    />
                                </Center>
                                <ContactShadows position={[0, -1.1, 0]} opacity={0.4} scale={10} blur={2} />
                            </React.Suspense>
                            <OrbitControls minDistance={2} maxDistance={8} enablePan={false} />
                        </Canvas>
                    </div>

                    {/* Save Button */}
                    <div className="border-t border-slate-100 bg-white p-3">
                        <button
                            onClick={handleSaveClick}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,102,241,0.30)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(99,102,241,0.40)] active:translate-y-0"
                        >
                            <Save size={15} />
                            Save Product
                        </button>
                    </div>
                </div>

                {/* PBR Panel */}
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
                    <div className="h-full overflow-y-auto p-4">
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
            </div>

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
        </div>
    );
};



// ═══════════════════════════════════════════════════
// ── Save Modal Component (Adapted from DesignPhase) ──
// ═══════════════════════════════════════════════════
const SaveProductModal = ({ isOpen, onClose, onConfirm, isSaving, snapshotUrl, categories, subCategories, initialData }) => {
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
};

export default TestUVWorkflow;