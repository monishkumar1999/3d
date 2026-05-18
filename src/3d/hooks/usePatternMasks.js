import { useState, useEffect } from "react";

export const usePatternMasks = (maskUrl) => {
    const [maskImg, setMaskImg] = useState(null);
    const [wireframeImg, setWireframeImg] = useState(null);

    useEffect(() => {
        if (!maskUrl) return;
        
        import('../utils/maskProcessor').then(({ processWireframeToSolid }) => {
            processWireframeToSolid(maskUrl)
                .then(solidDataUrl => {
                    const img = new window.Image();
                    img.src = solidDataUrl;
                    img.onload = () => setMaskImg(img);
                })
                .catch(() => {
                    const img = new window.Image();
                    img.src = maskUrl;
                    img.onload = () => setMaskImg(img);
                });
        });

        // Load wireframe with its original colors
        const wfImg = new window.Image();
        wfImg.crossOrigin = "Anonymous";
        wfImg.src = maskUrl;
        wfImg.onload = () => setWireframeImg(wfImg);
        wfImg.onerror = () => setWireframeImg(null);
    }, [maskUrl]);

    return { maskImg, wireframeImg };
};
