/**
 * XRSessionManager.js
 * 
 * Utility module for detecting WebXR support and managing WebXR immersive-ar session lifecycles.
 * Handles hit-test feature requests, reference space creation, DOM overlays, and clean session termination.
 */

/**
 * Checks if the browser environment supports WebXR immersive-ar sessions.
 * @returns {Promise<boolean>} True if immersive-ar is supported.
 */
export async function checkARSupport() {
    if (typeof window === "undefined" || !navigator || !navigator.xr) {
        return false;
    }
    try {
        const isSupported = await navigator.xr.isSessionSupported("immersive-ar");
        return Boolean(isSupported);
    } catch (err) {
        console.warn("[XRSessionManager] Error checking WebXR AR support:", err);
        return false;
    }
}

/**
 * Requests an immersive-ar WebXR session with hit-test and optional DOM overlay.
 * @param {Object} options Configuration parameters.
 * @param {HTMLElement} [options.domOverlayElement] Optional DOM container for AR UI overlay.
 * @returns {Promise<XRSession>} WebXR Session instance.
 */
export async function requestARSession({ domOverlayElement = null } = {}) {
    if (!navigator || !navigator.xr) {
        throw new Error("WebXR is not available on this browser.");
    }

    // Keep requiredFeatures minimal for maximum mobile device compatibility (e.g. hit-test only)
    const sessionInit = {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["local-floor", "dom-overlay", "light-estimation", "anchors"],
    };

    if (domOverlayElement) {
        sessionInit.domOverlay = { root: domOverlayElement };
    }

    try {
        const session = await navigator.xr.requestSession("immersive-ar", sessionInit);
        return session;
    } catch (err) {
        console.error("[XRSessionManager] Failed to launch WebXR AR session:", err);
        throw err;
    }
}

/**
 * Safely ends an active WebXR session.
 * @param {XRSession} session Active WebXR session object.
 */
export async function endARSession(session) {
    if (session && typeof session.end === "function") {
        try {
            await session.end();
        } catch (err) {
            console.warn("[XRSessionManager] Error ending WebXR session:", err);
        }
    }
}
