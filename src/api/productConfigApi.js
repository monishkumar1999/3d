import api from './axios';

/**
 * saveProductConfig
 *
 * Single endpoint that handles BOTH create and update:
 *   - If formData contains `product_id`  → backend UPDATES existing product
 *   - If formData contains `product_name` (no product_id) → backend CREATES new product
 *
 * @param {FormData} formData - built by useProductConfigStore.saveConfig()
 * @returns {Promise<AxiosResponse>}
 */
export async function saveProductConfig(formData) {
    return api.post(`/product/config/save`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}

/**
 * getProductNames
 * Fetches lightweight product list (id + name) for selector dropdowns.
 */
export async function getProductNames() {
    return api.get(`/product/list-all`);
}

/**
 * getProductDetails
 * Fetches full product details including GLB URL and configuration.
 */
export async function getProductDetails(id) {
    return api.get(`/product/get-details/${id}`);
}

/**
 * uploadMeshUv
 * Uploads UV map images (white mask / original SVG) for a specific mesh.
 * @param {FormData} formData - must contain productId, meshName, and optionally whiteMask/originalSvg files
 * @returns {Promise<AxiosResponse>}
 */
export async function uploadMeshUv(formData) {
    return api.post(`/product/mesh/upload-uv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}
