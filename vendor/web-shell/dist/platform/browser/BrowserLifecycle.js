export function installBrowserLifecycle(handlers, canvas) {
    if (typeof window === "undefined" || typeof document === "undefined")
        return () => { };
    const onVisibility = () => { if (document.hidden)
        handlers.onBackground?.();
    else
        handlers.onForeground?.(); };
    const onConnected = (event) => handlers.onControllerConnected?.(event.gamepad.index, event.gamepad.id);
    const onDisconnected = (event) => handlers.onControllerDisconnected?.(event.gamepad.index, event.gamepad.id);
    const onContextLost = (event) => { event.preventDefault(); handlers.onContextLost?.(); };
    const onContextRestored = () => handlers.onContextRestored?.();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("gamepadconnected", onConnected);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    canvas?.addEventListener("webglcontextlost", onContextLost);
    canvas?.addEventListener("webglcontextrestored", onContextRestored);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("gamepadconnected", onConnected); window.removeEventListener("gamepaddisconnected", onDisconnected); canvas?.removeEventListener("webglcontextlost", onContextLost); canvas?.removeEventListener("webglcontextrestored", onContextRestored); };
}
