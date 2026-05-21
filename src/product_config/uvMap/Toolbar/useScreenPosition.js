import { useState, useLayoutEffect } from 'react';

export const useScreenPosition = (containerRef, position) => {
    const [screenPos, setScreenPos] = useState(null);

    useLayoutEffect(() => {
        if (!containerRef?.current || !position) return;

        const updatePosition = () => {
            if (!containerRef?.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setScreenPos({
                left: rect.left + position.left,
                top: rect.top + position.top
            });
        };

        const rafId = requestAnimationFrame(() => {
            updatePosition();
        });

        const intervalId = setInterval(updatePosition, 50);
        const timeoutId = setTimeout(() => clearInterval(intervalId), 500);

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            cancelAnimationFrame(rafId);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [containerRef, position?.left, position?.top]);

    return screenPos;
};
