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
