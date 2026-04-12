import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, Download, RotateCcw, Move, MousePointer2, ZoomIn, ZoomOut, Layers, Eye, EyeOff, Save, Camera, ChevronRight, Maximize, Minimize, Circle, Hexagon, Square, Pen } from 'lucide-react';
import api from '../../api/axios';

// ═══════════════════════════════════════════
// ── Perspective Transform (Homography) ──
// ═══════════════════════════════════════════

/**
 * Compute a 3×3 homography matrix that maps the unit square
 * [(0,0), (1,0), (1,1), (0,1)] to an arbitrary quad [p0, p1, p2, p3].
 * Returns a flat 9-element array [a,b,c, d,e,f, g,h,1].
 */
const computeHomography = (srcPts, dstPts) => {
    // srcPts & dstPts are arrays of {x,y} with length 4
    // We solve the 8-parameter homography using DLT (Direct Linear Transform)
    const A = [];
    for (let i = 0; i < 4; i++) {
        const sx = srcPts[i].x, sy = srcPts[i].y;
        const dx = dstPts[i].x, dy = dstPts[i].y;
        A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, dx]);
        A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy, dy]);
    }

    // Gaussian elimination to solve Ah = 0 (where last element = 1)
    const n = 8;
    const mat = A.map(row => [...row]);

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) maxRow = row;
        }
        [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];

        if (Math.abs(mat[col][col]) < 1e-10) continue;

        for (let row = col + 1; row < n; row++) {
            const factor = mat[row][col] / mat[col][col];
            for (let j = col; j <= n; j++) {
                mat[row][j] -= factor * mat[col][j];
            }
        }
    }

    // Back substitution
    const h = new Array(9);
    h[8] = 1;
    for (let i = n - 1; i >= 0; i--) {
        let sum = mat[i][n]; // RHS
        for (let j = i + 1; j < n; j++) {
            sum -= mat[i][j] * h[j];
        }
        h[i] = sum / mat[i][i];
    }

    return h;
};

/**
 * Apply homography H (flat 9-array) to point (x, y).
 */
const applyHomography = (H, x, y) => {
    const w = H[6] * x + H[7] * y + H[8];
    return {
        x: (H[0] * x + H[1] * y + H[2]) / w,
        y: (H[3] * x + H[4] * y + H[5]) / w,
    };
};

/**
 * Warp a source image into a destination canvas using the given quad corners.
 * Uses inverse mapping for quality.
 */
const warpImageToQuad = (srcImage, dstCanvas, quadPts) => {
    const sw = srcImage.width || srcImage.naturalWidth;
    const sh = srcImage.height || srcImage.naturalHeight;
    const dw = dstCanvas.width;
    const dh = dstCanvas.height;

    // Create a temp canvas to read source pixels
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sw;
    srcCanvas.height = sh;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(srcImage, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

    const dstCtx = dstCanvas.getContext('2d');
    const dstImageData = dstCtx.createImageData(dw, dh);
    const dstData = dstImageData.data;

    // Homography: map from dst quad → unit square [0,1]
    // Then scale unit square to source image
    const unitPts = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ];

    // Forward: unit square → quad (what we drew)
    // Inverse: quad → unit square (what we need for sampling)
    const H_forward = computeHomography(unitPts, quadPts);
    const H_inverse = computeHomography(quadPts, unitPts);

    // Find bounding box of quad to limit iteration
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of quadPts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(dw - 1, Math.ceil(maxX));
    maxY = Math.min(dh - 1, Math.ceil(maxY));

    for (let dy = minY; dy <= maxY; dy++) {
        for (let dx = minX; dx <= maxX; dx++) {
            // Map destination pixel back to unit square
            const uv = applyHomography(H_inverse, dx, dy);
            if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) continue;

            // Map to source image coordinates
            const sx = uv.x * (sw - 1);
            const sy = uv.y * (sh - 1);

            // Bilinear interpolation
            const x0 = Math.floor(sx), y0 = Math.floor(sy);
            const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
            const fx = sx - x0, fy = sy - y0;

            const idx00 = (y0 * sw + x0) * 4;
            const idx10 = (y0 * sw + x1) * 4;
            const idx01 = (y1 * sw + x0) * 4;
            const idx11 = (y1 * sw + x1) * 4;

            const dstIdx = (dy * dw + dx) * 4;
            for (let c = 0; c < 4; c++) {
                dstData[dstIdx + c] = Math.round(
                    srcData[idx00 + c] * (1 - fx) * (1 - fy) +
                    srcData[idx10 + c] * fx * (1 - fy) +
                    srcData[idx01 + c] * (1 - fx) * fy +
                    srcData[idx11 + c] * fx * fy
                );
            }
        }
    }

    dstCtx.putImageData(dstImageData, 0, 0);
};


// ═══════════════════════════════════════════
// ── Helpers ──
// ═══════════════════════════════════════════

const loadImageElement = (src) => new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
});

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
});

const BLEND_MODES = [
    { key: 'source-over', label: 'Normal' },
    { key: 'multiply', label: 'Multiply' },
    { key: 'screen', label: 'Screen' },
    { key: 'overlay', label: 'Overlay' },
    { key: 'soft-light', label: 'Soft Light' },
    { key: 'hard-light', label: 'Hard Light' },
    { key: 'luminosity', label: 'Luminosity' },
];

const DESIGN_FILTERS = [
    { key: 'none', label: 'Original' },
    { key: 'grayscale', label: 'Grayscale' },
    { key: 'sepia', label: 'Sepia' },
    { key: 'engrave', label: 'Wood Engrave' },
    { key: 'sketch', label: 'Sketch' },
];

/** Apply a pixel-level filter to an image, returns a new canvas element */
const applyImageFilter = (srcImage, filterKey) => {
    if (filterKey === 'none') return srcImage;
    const w = srcImage.naturalWidth || srcImage.width;
    const h = srcImage.naturalHeight || srcImage.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(srcImage, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filterKey === 'grayscale') {
            d[i] = d[i + 1] = d[i + 2] = gray;
        } else if (filterKey === 'sepia') {
            d[i]     = Math.min(255, gray * 1.15 + 30);  // R - warm
            d[i + 1] = Math.min(255, gray * 0.85 + 15);  // G
            d[i + 2] = Math.min(255, gray * 0.55);       // B - reduced
        } else if (filterKey === 'engrave') {
            // High contrast sepia for wood-burn look
            gray = gray < 120 ? gray * 0.5 : gray * 1.3;
            gray = Math.max(0, Math.min(255, gray));
            d[i]     = Math.min(255, gray * 0.85 + 20);  // warm brown
            d[i + 1] = Math.min(255, gray * 0.6 + 10);
            d[i + 2] = Math.min(255, gray * 0.35);
        } else if (filterKey === 'sketch') {
            // High contrast B&W
            gray = gray > 128 ? 255 : gray * 1.8;
            gray = Math.max(0, Math.min(255, gray));
            d[i] = d[i + 1] = d[i + 2] = gray;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
};

const STEPS = [
    { id: 1, label: 'Upload Product', icon: Upload },
    { id: 2, label: 'Mark Region', icon: MousePointer2 },
    { id: 3, label: 'Add Design', icon: Layers },
];

const SHAPE_MODES = [
    { key: 'quad', label: 'Rectangle', icon: Square, hint: 'Click 4 corners for perspective areas' },
    { key: 'circle', label: 'Circle', icon: Circle, hint: 'Click center, drag to set radius' },
    { key: 'freeform', label: 'Freeform', icon: Pen, hint: 'Click points to draw any shape' },
];


// ═══════════════════════════════════════════
// ── Main Component ──
// ═══════════════════════════════════════════

const TwoDCompositor = () => {
    // ── Step state ──
    const [currentStep, setCurrentStep] = useState(1);

    // ── Shape mode ──
    const [shapeMode, setShapeMode] = useState('quad'); // 'quad' | 'circle' | 'freeform'

    // ── Product image ──
    const [productImageSrc, setProductImageSrc] = useState(null);
    const [productImage, setProductImage] = useState(null); // HTMLImageElement

    // ── Region corners (quad: 4 points, freeform: N points) ──
    const [corners, setCorners] = useState([]);
    const [hoveredCorner, setHoveredCorner] = useState(-1);
    const [draggingCorner, setDraggingCorner] = useState(-1);

    // ── Circle region ──
    const [circleCenter, setCircleCenter] = useState(null); // {x, y}
    const [circleRadius, setCircleRadius] = useState(0);
    const [isDrawingCircle, setIsDrawingCircle] = useState(false);
    const [isDraggingCircle, setIsDraggingCircle] = useState(false); // drag center
    const [isDraggingRadius, setIsDraggingRadius] = useState(false); // drag edge

    // ── Freeform state ──
    const [freeformClosed, setFreeformClosed] = useState(false);

    // ── Design image ──
    const [designImageSrc, setDesignImageSrc] = useState(null);
    const [designImage, setDesignImage] = useState(null);

    // ── Composite settings ──
    const [opacity, setOpacity] = useState(0.85);
    const [blendMode, setBlendMode] = useState('multiply');
    const [showDesign, setShowDesign] = useState(true);
    const [designFilter, setDesignFilter] = useState('none');

    // ── Helper: is region complete? ──
    const isRegionComplete = useCallback(() => {
        if (shapeMode === 'quad') return corners.length === 4;
        if (shapeMode === 'circle') return circleCenter && circleRadius > 10;
        if (shapeMode === 'freeform') return corners.length >= 3 && freeformClosed;
        return false;
    }, [shapeMode, corners, circleCenter, circleRadius, freeformClosed]);

    // ── Canvas ──
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [scale, setScale] = useState(1); // Scale factor from original image to display

    // ── Save modal ──
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    // ── Load categories ──
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, subRes] = await Promise.all([
                    api.get('/categories'),
                    api.get('/subcategories'),
                ]);
                setCategories(catRes.data?.data || catRes.data || []);
                setSubCategories(subRes.data?.data || subRes.data || []);
            } catch (err) {
                console.warn('Failed to load categories:', err);
            }
        };
        fetchData();
    }, []);

    const handleProductUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setProductImageSrc(dataUrl);
            const img = await loadImageElement(dataUrl);
            setProductImage(img);
            setCorners([]);
            setCircleCenter(null);
            setCircleRadius(0);
            setFreeformClosed(false);
            setDesignImageSrc(null);
            setDesignImage(null);
            setCurrentStep(2);
        } catch (err) {
            console.error('Product upload failed:', err);
        }
    }, []);

    // ── Handle design image upload ──
    const handleDesignUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setDesignImageSrc(dataUrl);
            const img = await loadImageElement(dataUrl);
            setDesignImage(img);
        } catch (err) {
            console.error('Design upload failed:', err);
        }
    }, []);

    // ── Compute canvas size when product image loads ──
    useEffect(() => {
        if (!productImage || !containerRef.current) return;

        const container = containerRef.current;
        const maxW = container.clientWidth - 40;
        const maxH = container.clientHeight - 40;
        const imgW = productImage.naturalWidth;
        const imgH = productImage.naturalHeight;

        const scaleToFit = Math.min(maxW / imgW, maxH / imgH, 1);
        const displayW = Math.round(imgW * scaleToFit);
        const displayH = Math.round(imgH * scaleToFit);

        setScale(scaleToFit);
        setCanvasSize({ width: displayW, height: displayH });
    }, [productImage]);

    // ── Canvas click → add points based on shapeMode ──
    const handleCanvasClick = useCallback((e) => {
        if (currentStep !== 2 || draggingCorner !== -1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (shapeMode === 'quad') {
            if (corners.length >= 4) return;
            const newCorners = [...corners, { x, y }];
            setCorners(newCorners);
            if (newCorners.length === 4) setCurrentStep(3);
        } else if (shapeMode === 'circle') {
            // Already handled in mouseDown/mouseUp
        } else if (shapeMode === 'freeform') {
            if (freeformClosed) return;
            // Close path if clicking near first point
            if (corners.length >= 3) {
                const dx = corners[0].x - x;
                const dy = corners[0].y - y;
                if (Math.sqrt(dx * dx + dy * dy) < 15) {
                    setFreeformClosed(true);
                    setCurrentStep(3);
                    return;
                }
            }
            setCorners(prev => [...prev, { x, y }]);
        }
    }, [currentStep, corners, draggingCorner, shapeMode, freeformClosed]);

    // ── Mouse down ──
    const handleCanvasMouseDown = useCallback((e) => {
        if (currentStep < 2) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (shapeMode === 'circle') {
            if (!circleCenter) {
                // Start drawing circle
                setCircleCenter({ x, y });
                setCircleRadius(0);
                setIsDrawingCircle(true);
                e.preventDefault();
                return;
            }
            // Check if dragging the edge (radius handle)
            const distToEdge = Math.abs(Math.sqrt((x - circleCenter.x) ** 2 + (y - circleCenter.y) ** 2) - circleRadius);
            if (distToEdge < 12) {
                setIsDraggingRadius(true);
                e.preventDefault();
                return;
            }
            // Check if dragging center
            const distToCenter = Math.sqrt((x - circleCenter.x) ** 2 + (y - circleCenter.y) ** 2);
            if (distToCenter < 15) {
                setIsDraggingCircle(true);
                e.preventDefault();
                return;
            }
            return;
        }

        // Quad/Freeform: check if dragging existing corner
        for (let i = 0; i < corners.length; i++) {
            const dx = corners[i].x - x;
            const dy = corners[i].y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 12) {
                setDraggingCorner(i);
                e.preventDefault();
                return;
            }
        }
    }, [currentStep, corners, shapeMode, circleCenter, circleRadius]);

    // ── Mouse move ──
    const handleCanvasMouseMove = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (shapeMode === 'circle') {
            if (isDrawingCircle && circleCenter) {
                const r = Math.sqrt((x - circleCenter.x) ** 2 + (y - circleCenter.y) ** 2);
                setCircleRadius(r);
                return;
            }
            if (isDraggingRadius && circleCenter) {
                const r = Math.sqrt((x - circleCenter.x) ** 2 + (y - circleCenter.y) ** 2);
                setCircleRadius(r);
                return;
            }
            if (isDraggingCircle && circleCenter) {
                setCircleCenter({ x, y });
                return;
            }
            return;
        }

        if (draggingCorner !== -1) {
            setCorners(prev => {
                const updated = [...prev];
                updated[draggingCorner] = {
                    x: Math.max(0, Math.min(canvasSize.width, x)),
                    y: Math.max(0, Math.min(canvasSize.height, y)),
                };
                return updated;
            });
            return;
        }

        // Hover detection
        let found = -1;
        for (let i = 0; i < corners.length; i++) {
            const dx = corners[i].x - x;
            const dy = corners[i].y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 12) {
                found = i;
                break;
            }
        }
        setHoveredCorner(found);
    }, [draggingCorner, corners, canvasSize, shapeMode, isDrawingCircle, isDraggingCircle, isDraggingRadius, circleCenter]);

    // ── Mouse up ──
    const handleCanvasMouseUp = useCallback(() => {
        if (isDrawingCircle && circleRadius > 10) {
            setIsDrawingCircle(false);
            setCurrentStep(3);
        } else if (isDrawingCircle) {
            setIsDrawingCircle(false);
        }
        setIsDraggingCircle(false);
        setIsDraggingRadius(false);
        setDraggingCorner(-1);
    }, [isDrawingCircle, circleRadius]);

    // ── Helper: draw design clipped to a shape ──
    const drawClippedDesign = useCallback((ctx, w, h, pts, cc, cr, sf = 1) => {
        if (!designImage || !showDesign) return;
        ctx.save();
        ctx.beginPath();
        if (shapeMode === 'quad' && pts.length === 4) {
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
        } else if (shapeMode === 'circle' && cc && cr > 0) {
            ctx.arc(cc.x, cc.y, cr, 0, Math.PI * 2);
        } else if (shapeMode === 'freeform' && pts.length >= 3) {
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
        } else {
            ctx.restore();
            return;
        }
        ctx.clip();

        // Apply filter to design image
        const filteredSrc = applyImageFilter(designImage, designFilter);

        if (shapeMode === 'quad' && pts.length === 4) {
            const warpCanvas = document.createElement('canvas');
            warpCanvas.width = w;
            warpCanvas.height = h;
            warpImageToQuad(filteredSrc, warpCanvas, pts);
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = blendMode;
            ctx.drawImage(warpCanvas, 0, 0);
        } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            if (shapeMode === 'circle') {
                minX = cc.x - cr; minY = cc.y - cr;
                maxX = cc.x + cr; maxY = cc.y + cr;
            } else {
                for (const p of pts) {
                    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                }
            }
            const bw = maxX - minX, bh = maxY - minY;
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = blendMode;
            ctx.drawImage(filteredSrc, minX, minY, bw, bh);
        }
        ctx.restore();
    }, [designImage, showDesign, shapeMode, opacity, blendMode, designFilter]);

    // ── Helper: draw shape guides ──
    const drawShapeGuides = useCallback((ctx) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        if (shapeMode === 'circle' && circleCenter && circleRadius > 0) {
            ctx.beginPath();
            ctx.arc(circleCenter.x, circleCenter.y, circleRadius, 0, Math.PI * 2);
            ctx.stroke();
            // Center dot
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(circleCenter.x, circleCenter.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#6366f1';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if ((shapeMode === 'quad' || shapeMode === 'freeform') && corners.length > 0) {
            if (corners.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(corners[0].x, corners[0].y);
                for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
                if ((shapeMode === 'quad' && corners.length === 4) || (shapeMode === 'freeform' && freeformClosed)) ctx.closePath();
                ctx.stroke();
            }
            // Corner dots
            ctx.setLineDash([]);
            corners.forEach((pt, i) => {
                const isH = hoveredCorner === i, isD = draggingCorner === i;
                const r = isH || isD ? 10 : 7;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r + 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fillStyle = isD ? '#818cf8' : (isH ? '#a5b4fc' : '#6366f1');
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${i + 1}`, pt.x, pt.y);
            });
            // First-point close hint for freeform
            if (shapeMode === 'freeform' && corners.length >= 3 && !freeformClosed) {
                ctx.beginPath();
                ctx.arc(corners[0].x, corners[0].y, 15, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
            }
        }
        ctx.restore();
    }, [shapeMode, circleCenter, circleRadius, corners, freeformClosed, hoveredCorner, draggingCorner]);

    // ── Render canvas ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !productImage) return;
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        ctx.drawImage(productImage, 0, 0, canvasSize.width, canvasSize.height);

        // Draw design overlay
        drawClippedDesign(ctx, canvasSize.width, canvasSize.height, corners, circleCenter, circleRadius);

        // Draw shape guides
        if (currentStep <= 3) drawShapeGuides(ctx);
    }, [productImage, canvasSize, corners, circleCenter, circleRadius, designImage, opacity, blendMode, showDesign, designFilter, hoveredCorner, draggingCorner, currentStep, drawClippedDesign, drawShapeGuides]);

    // ── Helper: render full-res composite for download/save ──
    const renderFullRes = useCallback(() => {
        if (!productImage) return null;
        const imgW = productImage.naturalWidth;
        const imgH = productImage.naturalHeight;
        const sf = imgW / canvasSize.width;
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imgW;
        fullCanvas.height = imgH;
        const ctx = fullCanvas.getContext('2d');
        ctx.drawImage(productImage, 0, 0, imgW, imgH);
        const scaledCorners = corners.map(c => ({ x: c.x * sf, y: c.y * sf }));
        const scaledCenter = circleCenter ? { x: circleCenter.x * sf, y: circleCenter.y * sf } : null;
        const scaledRadius = circleRadius * sf;
        drawClippedDesign(ctx, imgW, imgH, scaledCorners, scaledCenter, scaledRadius, sf);
        return fullCanvas;
    }, [productImage, canvasSize, corners, circleCenter, circleRadius, drawClippedDesign]);

    // ── Download composite ──
    const handleDownload = useCallback(() => {
        if (!productImage || !isRegionComplete()) return;
        const fullCanvas = renderFullRes();
        if (!fullCanvas) return;
        const link = document.createElement('a');
        link.download = 'composite-product.png';
        link.href = fullCanvas.toDataURL('image/png');
        link.click();
    }, [productImage, isRegionComplete, renderFullRes]);

    // ── Reset all ──
    const handleReset = useCallback(() => {
        setCurrentStep(1);
        setProductImageSrc(null);
        setProductImage(null);
        setCorners([]);
        setCircleCenter(null);
        setCircleRadius(0);
        setFreeformClosed(false);
        setDesignImageSrc(null);
        setDesignImage(null);
        setOpacity(0.85);
        setBlendMode('multiply');
        setShowDesign(true);
        setDesignFilter('none');
    }, []);

    // ── Reset region ──
    const handleResetRegion = useCallback(() => {
        setCorners([]);
        setCircleCenter(null);
        setCircleRadius(0);
        setFreeformClosed(false);
        setCurrentStep(2);
    }, []);

    const handleSaveProduct = useCallback(async (formData) => {
        setIsSaving(true);
        try {
            const fullCanvas = renderFullRes();
            const blob = await new Promise(r => fullCanvas.toBlob(r, 'image/png'));
            const fd = new FormData();
            fd.append('name', formData.name);
            fd.append('category_id', formData.categoryId);
            fd.append('sub_category_id', formData.subcategoryId);
            fd.append('image', formData.imageBlob || blob, 'product.png');
            fd.append('type', '2d');
            await api.post('/product/create', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setIsSaveModalOpen(false);
            alert('Product saved successfully!');
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save product. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [renderFullRes]);

    // ═══════════════════════════════════════
    // ── RENDER ──
    // ═══════════════════════════════════════

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 overflow-hidden">

            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <Layers size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-800 tracking-tight">2D Compositor</h1>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Product Preview Builder</p>
                        </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center gap-1.5 ml-6">
                        {STEPS.map((step, i) => {
                            const StepIcon = step.icon;
                            const isActive = currentStep === step.id;
                            const isDone = currentStep > step.id;
                            return (
                                <React.Fragment key={step.id}>
                                    {i > 0 && <ChevronRight size={12} className="text-slate-300 mx-0.5" />}
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                                        isActive ? 'bg-indigo-100 text-indigo-700 shadow-sm' :
                                        isDone ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>
                                        <StepIcon size={12} />
                                        <span className="hidden sm:inline">{step.label}</span>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                    >
                        <RotateCcw size={14} />
                        Reset
                    </button>
                    {isRegionComplete() && designImage && (
                        <>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all hover:scale-[1.02]"
                            >
                                <Download size={14} />
                                Download
                            </button>
                            <button
                                onClick={() => setIsSaveModalOpen(true)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:scale-[1.02]"
                            >
                                <Save size={14} />
                                Save Product
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Left Panel ── */}
                <div className="w-80 flex-shrink-0 bg-white/60 backdrop-blur-xl border-r border-slate-200/60 flex flex-col overflow-y-auto">
                    <div className="p-5 space-y-5">

                        {/* Step 1: Product Upload */}
                        <div className={`rounded-2xl border transition-all duration-300 ${currentStep >= 1 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 opacity-50'}`}>
                            <div className="p-4">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                        currentStep > 1 ? 'bg-emerald-100 text-emerald-600' :
                                        currentStep === 1 ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>1</div>
                                    <span className="text-sm font-bold text-slate-700">Product Photo</span>
                                    {productImage && <span className="ml-auto text-[10px] font-bold text-emerald-500 uppercase">✓ Done</span>}
                                </div>

                                {productImageSrc ? (
                                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video">
                                        <img src={productImageSrc} alt="Product" className="w-full h-full object-cover" />
                                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer">
                                            <div className="bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                                <Upload size={12} /> Change
                                            </div>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
                                        </label>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                                            <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-500">Upload plain product photo</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Mark Region */}
                        <div className={`rounded-2xl border transition-all duration-300 ${currentStep >= 2 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 opacity-50'}`}>
                            <div className="p-4">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                        isRegionComplete() ? 'bg-emerald-100 text-emerald-600' :
                                        currentStep === 2 ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>2</div>
                                    <span className="text-sm font-bold text-slate-700">Mark Region</span>
                                    {isRegionComplete() && <span className="ml-auto text-[10px] font-bold text-emerald-500 uppercase">✓ Done</span>}
                                </div>

                                {currentStep >= 2 && (
                                    <div className="space-y-3">
                                        {/* Shape mode selector */}
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                                            {SHAPE_MODES.map(({ key, label, icon: Icon }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        if (shapeMode !== key) {
                                                            setShapeMode(key);
                                                            setCorners([]);
                                                            setCircleCenter(null);
                                                            setCircleRadius(0);
                                                            setFreeformClosed(false);
                                                        }
                                                    }}
                                                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                                        shapeMode === key
                                                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    <Icon size={12} />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            {shapeMode === 'quad' && <>Click <strong>4 corners</strong> on the product. Start <strong>top-left</strong>, go clockwise.</>}
                                            {shapeMode === 'circle' && <>Click and <strong>drag</strong> on the product to draw a circle region.</>}
                                            {shapeMode === 'freeform' && <>Click <strong>multiple points</strong> to draw any shape. Click near the first point to close.</>}
                                        </p>

                                        {shapeMode === 'quad' && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {[1, 2, 3, 4].map((n) => (
                                                        <div key={n} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                                                            corners.length >= n ? 'bg-indigo-500' : 'bg-slate-200'
                                                        }`} />
                                                    ))}
                                                </div>
                                                <p className="text-[10px] font-semibold text-slate-400">{corners.length}/4 points placed</p>
                                            </>
                                        )}

                                        {shapeMode === 'circle' && circleCenter && (
                                            <p className="text-[10px] font-semibold text-slate-400">Radius: {Math.round(circleRadius)}px • Drag edge to resize, drag center to move</p>
                                        )}

                                        {shapeMode === 'freeform' && (
                                            <p className="text-[10px] font-semibold text-slate-400">
                                                {freeformClosed ? `${corners.length} points • Shape closed` : `${corners.length} points placed${corners.length >= 3 ? ' • Click near point 1 to close' : ''}`}
                                            </p>
                                        )}

                                        {(corners.length > 0 || circleCenter) && (
                                            <button
                                                onClick={handleResetRegion}
                                                className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                <RotateCcw size={11} />
                                                Reset region
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Step 3: Design Image + Settings */}
                        <div className={`rounded-2xl border transition-all duration-300 ${currentStep >= 3 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 opacity-50'}`}>
                            <div className="p-4">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                        designImage ? 'bg-emerald-100 text-emerald-600' :
                                        currentStep === 3 ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>3</div>
                                    <span className="text-sm font-bold text-slate-700">Design Image</span>
                                    {designImage && <span className="ml-auto text-[10px] font-bold text-emerald-500 uppercase">✓ Done</span>}
                                </div>

                                {currentStep >= 3 && (
                                    <div className="space-y-3">
                                        {designImageSrc ? (
                                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video">
                                                <img src={designImageSrc} alt="Design" className="w-full h-full object-cover" />
                                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer">
                                                    <div className="bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                                        <Upload size={12} /> Change
                                                    </div>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleDesignUpload} />
                                                </label>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                                                    <ImageIcon size={14} className="text-slate-400 group-hover:text-indigo-500" />
                                                </div>
                                                <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-500">Upload design image</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleDesignUpload} />
                                            </label>
                                        )}

                                        {/* Blend controls */}
                                        {designImage && (
                                            <div className="space-y-3 pt-3 border-t border-slate-100">
                                                {/* Visibility toggle */}
                                                <button
                                                    onClick={() => setShowDesign(!showDesign)}
                                                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                                        showDesign ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                                                    }`}
                                                >
                                                    {showDesign ? <Eye size={14} /> : <EyeOff size={14} />}
                                                    {showDesign ? 'Design visible' : 'Design hidden'}
                                                </button>

                                                {/* Design Filter */}
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Photo Effect</span>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {DESIGN_FILTERS.map(({ key, label }) => (
                                                            <button
                                                                key={key}
                                                                onClick={() => setDesignFilter(key)}
                                                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                                                                    designFilter === key
                                                                        ? 'bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200'
                                                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {designFilter === 'engrave' && (
                                                        <p className="text-[9px] text-amber-600 mt-1 font-medium">✨ Best for wood/acrylic products</p>
                                                    )}
                                                </div>

                                                {/* Opacity */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Opacity</span>
                                                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{Math.round(opacity * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={opacity}
                                                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                                        className="w-full h-1.5 rounded-full bg-slate-200 appearance-none accent-indigo-500 cursor-pointer"
                                                    />
                                                </div>

                                                {/* Blend Mode */}
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Blend Mode</span>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {BLEND_MODES.map(({ key, label }) => (
                                                            <button
                                                                key={key}
                                                                onClick={() => setBlendMode(key)}
                                                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                                                                    blendMode === key
                                                                        ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Canvas Viewport ── */}
                <div ref={containerRef} className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-100/80 via-white/50 to-indigo-100/40 overflow-hidden relative">
                    {/* Checkerboard background pattern (for transparency) */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                        }}
                    />

                    {productImage ? (
                        <div className="relative">
                            {/* Shadow behind canvas */}
                            <div className="absolute -inset-3 rounded-2xl bg-black/5 blur-xl" />

                            <canvas
                                ref={canvasRef}
                                width={canvasSize.width}
                                height={canvasSize.height}
                                onClick={handleCanvasClick}
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                                className={`relative rounded-lg shadow-2xl ring-1 ring-black/5 ${
                                    currentStep === 2 && !isRegionComplete() ? 'cursor-crosshair' :
                                    hoveredCorner !== -1 ? 'cursor-grab' :
                                    draggingCorner !== -1 ? 'cursor-grabbing' :
                                    'cursor-default'
                                }`}
                                style={{ width: canvasSize.width, height: canvasSize.height }}
                            />

                            {/* Instruction overlay */}
                            {currentStep === 2 && !isRegionComplete() && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2 animate-pulse">
                                    <MousePointer2 size={14} />
                                    {shapeMode === 'quad' && `Click to place point ${corners.length + 1} of 4`}
                                    {shapeMode === 'circle' && (circleCenter ? 'Drag to set radius' : 'Click & drag to draw circle')}
                                    {shapeMode === 'freeform' && (corners.length >= 3 ? 'Click near point 1 to close shape' : `Click to add point ${corners.length + 1}`)}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center">
                                <ImageIcon size={32} className="text-slate-300" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400">No product image</p>
                                <p className="text-xs text-slate-300 mt-1">Upload a product photo to get started</p>
                            </div>
                            <label className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 cursor-pointer transition-all hover:scale-[1.02]">
                                <Upload size={16} />
                                Upload Product Photo
                                <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Save Modal ── */}
            {isSaveModalOpen && (
                <SaveProductModal
                    isOpen={isSaveModalOpen}
                    onClose={() => setIsSaveModalOpen(false)}
                    onConfirm={handleSaveProduct}
                    isSaving={isSaving}
                    categories={categories}
                    subCategories={subCategories}
                />
            )}
        </div>
    );
};


// ═══════════════════════════════════════════
// ── Save Modal (same pattern as 3D editor) ──
// ═══════════════════════════════════════════
const SaveProductModal = ({ isOpen, onClose, onConfirm, isSaving, categories, subCategories }) => {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        onConfirm({ name, categoryId, subcategoryId, imageBlob: imageFile });
    };

    const filteredSubCategories = subCategories.filter(s => s.categoryId == categoryId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-800">Save 2D Product</h3>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Image Preview */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Image</label>
                        <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-gray-300 flex flex-col items-center">
                                    <ImageIcon size={32} />
                                    <span className="text-xs mt-2">No Preview</span>
                                </div>
                            )}
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="bg-white text-gray-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                    <Camera size={16} />Change Image
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Product Name</label>
                        <input type="text" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crystal Photo Block" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Category</label>
                            <select className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(''); }}>
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
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex gap-3 justify-end">
                    <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || !name || !categoryId || !subcategoryId} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2">
                        {isSaving ? 'Saving...' : <><Save size={18} /> Confirm Save</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TwoDCompositor;
