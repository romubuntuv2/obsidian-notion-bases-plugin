import { MouseEventHandler, useCallback, useEffect, useRef } from "react";

interface UseClickOrDoubleClickOptions {
    onClick?: () => void;
    onDoubleClick?: () => void;
    doubleClickDelay?: number;
}

interface ClickHandlers<T extends HTMLElement> {
    onClick: MouseEventHandler<T>;
    onDoubleClick: MouseEventHandler<T>;
}

export function useClickOrDoubleClick<T extends HTMLElement = HTMLDivElement>({
    onClick,
    onDoubleClick,
    doubleClickDelay = 250,
}: UseClickOrDoubleClickOptions): ClickHandlers<T> {

    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleClick = useCallback<MouseEventHandler<T>>((event) => {
        event.stopPropagation();

        // Ignore le deuxième click d'un double-click.
        if (event.detail > 1) {
            return;
        }

        timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            onClick?.();
        }, doubleClickDelay);
    }, [onClick, doubleClickDelay]);

    const handleDoubleClick = useCallback<MouseEventHandler<T>>((event) => {
        event.stopPropagation();

        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        onDoubleClick?.();
    }, [onDoubleClick]);

    return {
        onClick: handleClick,
        onDoubleClick: handleDoubleClick,
    };
}
