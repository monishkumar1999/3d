/**
 * Image caching utility using localStorage
 * Caches processed images to avoid re-fetching on tab switches
 */

const CACHE_PREFIX = 'img_cache_';
const CACHE_VERSION = 'v1_';

/**
 * Generate a unique cache key from a URL
 * Uses a simple hash to create a shorter, safe key
 */
const generateCacheKey = (url) => {
    // Simple hash function for URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return CACHE_PREFIX + CACHE_VERSION + Math.abs(hash).toString(36);
};

/**
 * Get cached image data URL from localStorage
 * @param {string} url - The original image URL
 * @returns {string|null} - The cached data URL or null if not found
 */
export const getCachedImage = (url) => {
    try {
        const key = generateCacheKey(url);
        const cached = localStorage.getItem(key);
        if (cached) {
            // console.log('[ImageCache] Cache hit for:', url.substring(0, 50) + '...');
            return cached;
        }
        // console.log('[ImageCache] Cache miss for:', url.substring(0, 50) + '...');
        return null;
    } catch (error) {
        // console.warn('[ImageCache] Failed to read from cache:', error);
        return null;
    }
};

/**
 * Store processed image data URL to localStorage
 * @param {string} url - The original image URL
 * @param {string} dataUrl - The processed image data URL
 */
export const setCachedImage = (url, dataUrl) => {
    try {
        const key = generateCacheKey(url);
        localStorage.setItem(key, dataUrl);
        // console.log('[ImageCache] Cached image for:', url.substring(0, 50) + '...');
    } catch (error) {
        // localStorage might be full or unavailable
        // console.warn('[ImageCache] Failed to cache image:', error);
        // Try to clear some old cache entries if quota exceeded
        if (error.name === 'QuotaExceededError') {
            clearOldCacheEntries();
            try {
                localStorage.setItem(key, dataUrl);
            } catch (retryError) {
                // console.warn('[ImageCache] Still unable to cache after cleanup');
            }
        }
    }
};

/**
 * Clear all cached images from localStorage
 */
export const clearImageCache = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        // console.log('[ImageCache] Cleared', keysToRemove.length, 'cached images');
    } catch (error) {
        // console.warn('[ImageCache] Failed to clear cache:', error);
    }
};

/**
 * Clear old cache entries (keeps the most recent ones)
 * Called when localStorage quota is exceeded
 */
const clearOldCacheEntries = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Remove entries from old cache versions
            if (key && key.startsWith(CACHE_PREFIX) && !key.includes(CACHE_VERSION)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        // console.log('[ImageCache] Cleaned up', keysToRemove.length, 'old cache entries');
    } catch (error) {
        // console.warn('[ImageCache] Failed to cleanup old entries:', error);
    }
};

/**
 * In-memory cache for current session (faster than localStorage)
 * Used as a first-level cache before falling back to localStorage
 */
const memoryCache = new Map();

/**
 * Get cached image with memory cache fallback
 * Checks memory first, then localStorage
 * @param {string} url - The original image URL
 * @returns {string|null} - The cached data URL or null
 */
export const getCachedImageFast = (url) => {
    // Check memory cache first
    if (memoryCache.has(url)) {
        // console.log('[ImageCache] Memory cache hit');
        return memoryCache.get(url);
    }

    // Fall back to localStorage
    const cached = getCachedImage(url);
    if (cached) {
        // Store in memory for faster access next time
        memoryCache.set(url, cached);
    }
    return cached;
};

/**
 * Store image in both memory and localStorage
 * @param {string} url - The original image URL
 * @param {string} dataUrl - The processed image data URL
 */
export const setCachedImageFast = (url, dataUrl) => {
    // Store in memory
    memoryCache.set(url, dataUrl);
    // Also persist to localStorage
    setCachedImage(url, dataUrl);
};
