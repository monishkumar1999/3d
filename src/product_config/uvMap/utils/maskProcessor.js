/**
 * Processes a wireframe image to create a solid silhouette.
 * Uses a blur + threshold technique to close gaps between wireframe lines.
 * 
 * @param {string} imageUrl - The URL of the input image.
 * @returns {Promise<string>} - A Promise solving to the Data URL of the processed solid white mask.
 */
export const processWireframeToSolid = (imageUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set dimensions
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            // 1. Draw with BLUR to fill gaps
            // 4px blur is usually enough to bridge UV wireframes without destroying shape
            ctx.filter = 'blur(4px)';
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none'; // Reset filter

            // 2. Get Pixel Data for Thresholding
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 3. Thresholding: Turn any non-transparent pixel (result of blur) into Solid White
            // Alpha threshold can be low (e.g. 10) because the blur feathers out.
            const threshold = 10;

            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha > threshold) {
                    // Force Solid White
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                    data[i + 3] = 255; // A (Full Opacity)
                } else {
                    // Force Transparent
                    data[i + 3] = 0;
                }
            }

            // 4. Put processed data back
            ctx.putImageData(imageData, 0, 0);

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = (err) => {
            console.error("Mask processing failed:", err);
            reject(err); // Or resolve with original as fallback
        };
    });
};
