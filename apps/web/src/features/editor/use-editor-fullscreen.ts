import { useCallback, useEffect, useRef, useState } from 'react';

interface UseEditorFullscreenOptions {
  /** Called after the editor element really entered fullscreen. */
  onEntered?: () => void;
}

interface EditorFullscreenApi {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  /** True after the browser refused or does not expose the Fullscreen API. */
  fallback: boolean;
  dismissFallback: () => void;
  toggle: () => Promise<void>;
  exit: () => Promise<void>;
}

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Browser fullscreen for the editor container (never `document.body`), with
 * state synced to `fullscreenchange` (including the browser's Esc exit) and a
 * graceful fallback for browsers or iframes where the API is unavailable.
 */
export function useEditorFullscreen(
  options: UseEditorFullscreenOptions = {},
): EditorFullscreenApi {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onEnteredRef = useRef(options.onEntered);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallback, setFallback] = useState(false);
  onEnteredRef.current = options.onEntered;

  useEffect(() => {
    const handleChange = () => {
      const active =
        containerRef.current !== null &&
        document.fullscreenElement === containerRef.current;
      setIsFullscreen(active);
      if (active) onEnteredRef.current?.();
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return;

    try {
      await document.exitFullscreen();
    } catch {
      // The browser already left fullscreen or refuses to exit; the
      // fullscreenchange listener keeps the button state in sync anyway.
    }
    setIsFullscreen(false);
  }, []);

  const enter = useCallback(async () => {
    const element = containerRef.current;
    const request = element?.requestFullscreen?.bind(element);

    if (!element || !request) {
      setFallback(true);
      return;
    }

    try {
      await request();
    } catch {
      setFallback(true);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) await exit();
    else await enter();
  }, [enter, exit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typingTarget(event.target)) return;

      const isShortcut =
        event.key === 'F11' ||
        (event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          event.key.toLowerCase() === 'f');

      if (!isShortcut) return;

      const container = containerRef.current;
      if (!container) return;

      const active = document.activeElement;
      const inEditor =
        active === document.body ||
        (active instanceof Node && container.contains(active));

      if (!inEditor) return;

      event.preventDefault();
      void toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return {
    containerRef,
    isFullscreen,
    fallback,
    dismissFallback: () => setFallback(false),
    toggle,
    exit,
  };
}
