/**
 * Generates a procedural normal map for a fabric weave pattern.
 * Vertical and horizontal lines simulating threads.
 * 
 * @param {number} width - Texture width (e.g., 512)
 * @param {number} height - Texture height (e.g., 512)
 * @param {number} scale - Scale of the weave (smaller = tighter weave)
 * @returns {string} - Data URL of the generated normal map
 */
export const generateFabricNormalMap = (width = 512, height = 512, scale = 4, type = 'plain') => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // fill neutral normal color (128, 128, 255) -> (0.5, 0.5, 1.0)
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, width, height);

    // Function to draw bumps
    // We want to simulate threads which are rounded.
    // A bump in Height Map = Slope in Normal Map.
    // For simplicity, we'll draw grayscale height map details first then convert?
    // Or just draw directly to normal map by simulating the slope colors?

    // Easier approach: Draw a height map (black/white) then convert to normal map.

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = width;
    heightCanvas.height = height;
    const hCtx = heightCanvas.getContext('2d');

    // Fill background mid-grey
    hCtx.fillStyle = "#808080";
    hCtx.fillRect(0, 0, width, height);
    hCtx.lineWidth = scale / 2;
    hCtx.strokeStyle = "#C0C0C0"; // High point of thread

  if (type === 'plain') {
    const spacing = scale;
    for (let x = 0; x <= width; x += spacing) {
        hCtx.beginPath(); hCtx.moveTo(x, 0); hCtx.lineTo(x, height); hCtx.stroke();
    }
    for (let y = 0; y <= height; y += spacing) {
        hCtx.beginPath(); hCtx.moveTo(0, y); hCtx.lineTo(width, y); hCtx.stroke();
    }
}

/* ---------------- TWILL ---------------- */
else if (type === 'twill') {
    const spacing = scale;
    for (let i = -height; i < width; i += spacing) {
        hCtx.beginPath();
        hCtx.moveTo(i, 0);
        hCtx.lineTo(i + height, height);
        hCtx.stroke();
    }
}

/* ---------------- SATIN ---------------- */
else if (type === 'satin') {
    hCtx.lineWidth = scale * 0.4;
    for (let y = 0; y < height; y += scale * 3) {
        hCtx.beginPath();
        hCtx.moveTo(0, y);
        hCtx.bezierCurveTo(
            width * 0.3, y + scale,
            width * 0.6, y - scale,
            width, y
        );
        hCtx.stroke();
    }
}

/* ---------------- KNIT ---------------- */
else if (type === 'knit') {
    const loopW = scale * 2;
    const loopH = scale * 1.5;
    hCtx.lineWidth = scale / 3;

    for (let y = 0; y < height; y += loopH) {
        for (let x = 0; x < width; x += loopW) {
            const xOffset = (Math.floor(y / loopH) % 2) * (loopW / 2);
            hCtx.beginPath();
            hCtx.moveTo(x + xOffset, y);
            hCtx.quadraticCurveTo(
                x + xOffset + loopW / 2,
                y + loopH,
                x + xOffset + loopW,
                y
            );
            hCtx.stroke();
        }
    }
}

/* ---------------- RIB ---------------- */
else if (type === 'rib') {
    hCtx.lineWidth = scale;
    for (let x = 0; x < width; x += scale * 2) {
        hCtx.beginPath();
        hCtx.moveTo(x, 0);
        hCtx.lineTo(x, height);
        hCtx.stroke();
    }
}

/* ---------------- PIQUE ---------------- */
else if (type === 'pique') {
    const spacing = scale * 2;
    hCtx.lineWidth = scale / 2;

    for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
            hCtx.beginPath();
            hCtx.moveTo(x, y + spacing / 2);
            hCtx.lineTo(x + spacing / 2, y);
            hCtx.lineTo(x + spacing, y + spacing / 2);
            hCtx.lineTo(x + spacing / 2, y + spacing);
            hCtx.closePath();
            hCtx.stroke();
        }
    }
}

/* ---------------- FLEECE ---------------- */
else if (type === 'fleece') {
    for (let i = 0; i < width * height * 0.03; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * scale;
        hCtx.beginPath();
        hCtx.arc(x, y, r, 0, Math.PI * 2);
        hCtx.fillStyle = "#9a9a9a";
        hCtx.fill();
    }
}

/* ---------------- TERRY ---------------- */
else if (type === 'terry') {
    for (let y = 0; y < height; y += scale * 1.5) {
        for (let x = 0; x < width; x += scale * 1.5) {
            hCtx.beginPath();
            hCtx.arc(x, y, scale / 2, 0, Math.PI * 2);
            hCtx.fillStyle = "#b5b5b5";
            hCtx.fill();
        }
    }
}

/* ---------------- CORDUROY ---------------- */
else if (type === 'corduroy') {
    hCtx.lineWidth = scale * 1.5;
    for (let x = 0; x < width; x += scale * 2.5) {
        hCtx.beginPath();
        hCtx.moveTo(x, 0);
        hCtx.lineTo(x, height);
        hCtx.stroke();
    }
}

/* ---------------- VELVET ---------------- */
else if (type === 'velvet') {
    for (let i = 0; i < width * height * 0.015; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        hCtx.fillStyle = "#8a8a8a";
        hCtx.fillRect(x, y, 1, 1);
    }
}


    // Now convert height map to normal map logic (simplified pixel processing)
    const imgData = hCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const normalImgData = ctx.createImageData(width, height);
    const nData = normalImgData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            // Get neighbors for slope
            const left = data[idx - 4] || data[idx];
            const right = data[idx + 4] || data[idx];
            const up = data[((y - 1) * width + x) * 4] || data[idx];
            const down = data[((y + 1) * width + x) * 4] || data[idx];

            // Calculate slope
            const dx = (right - left) / 255;
            const dy = (down - up) / 255;

            // Normalize
            let nz = 1.0;
            const len = Math.sqrt(dx * dx + dy * dy + nz * nz);

            const nx = dx / len;
            const ny = dy / len;
            // const normalizedZ = nz / len; // effectively ~1 for shallow bumps

            // Map -1..1 to 0..255
            nData[idx] = (nx + 1) * 127.5;     // R
            nData[idx + 1] = (ny + 1) * 127.5; // G
            nData[idx + 2] = 255;              // B (Simplified, usually calc'd)
            nData[idx + 3] = 255;              // Alpha
        }
    }

    ctx.putImageData(normalImgData, 0, 0);
    return canvas.toDataURL();
};
