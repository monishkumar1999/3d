
import * as THREE from 'three';

/**
 * Generates a solid white silhouette mask from a mesh's UV coordinates.
 * 
 * @param {THREE.Mesh} mesh - The mesh to extract UVs from.
 * @param {number} size - The dimension of the square canvas (default 2048).
 * @returns {string} - Data URL of the generated PNG mask.
 */
export const generateUvMask = (mesh, size = 2048) => {
    if (!mesh || !mesh.isMesh || !mesh.geometry) return null;

    const geometry = mesh.geometry;
    const uvAttribute = geometry.attributes.uv;
    const indexAttribute = geometry.index;

    if (!uvAttribute) {
        // console.warn(`Mesh ${mesh.name} has no UV coordinates.`);
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Clear background (transparent)
    ctx.clearRect(0, 0, size, size);

    // Set style for the silhouette
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1; // Small overlap to prevent gaps
    ctx.lineJoin = 'round';

    ctx.beginPath();

    const drawTriangle = (a, b, c) => {
        const u1 = uvAttribute.getX(a) * size;
        const v1 = (1 - uvAttribute.getY(a)) * size; // Flip Y
        const u2 = uvAttribute.getX(b) * size;
        const v2 = (1 - uvAttribute.getY(b)) * size;
        const u3 = uvAttribute.getX(c) * size;
        const v3 = (1 - uvAttribute.getY(c)) * size;

        ctx.moveTo(u1, v1);
        ctx.lineTo(u2, v2);
        ctx.lineTo(u3, v3);
        ctx.lineTo(u1, v1);
    };

    if (indexAttribute) {
        for (let i = 0; i < indexAttribute.count; i += 3) {
            drawTriangle(
                indexAttribute.getX(i),
                indexAttribute.getX(i + 1),
                indexAttribute.getX(i + 2)
            );
        }
    } else {
        const positionAttribute = geometry.attributes.position;
        for (let i = 0; i < positionAttribute.count; i += 3) {
            drawTriangle(i, i + 1, i + 2);
        }
    }

    // Fill the accumulated path
    ctx.fill();
    // Stroke to fill tiny anti-aliasing gaps between triangles
    ctx.stroke();

    return canvas.toDataURL('image/png');
};
