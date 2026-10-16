/**
 * Dependency-free relay used by tests, local prototypes and same-page controller previews.
 * Production games can implement CompanionTransport with WebSocket/WebRTC without changing
 * any session or game rules.
 */
export class LoopbackCompanionHub {
    endpoints = new Map();
    connect(endpointId) {
        const id = endpointId.trim();
        if (!id)
            throw new Error("Companion endpoint id is required");
        if (this.endpoints.has(id))
            throw new Error(`Companion endpoint already connected: ${id}`);
        const state = { listeners: new Set(), closed: false };
        this.endpoints.set(id, state);
        return {
            endpointId: id,
            send: (packet) => {
                if (state.closed)
                    throw new Error(`Companion endpoint is closed: ${id}`);
                this.dispatch({ ...structuredClone(packet), senderId: id });
            },
            onMessage: (listener) => {
                if (state.closed)
                    throw new Error(`Companion endpoint is closed: ${id}`);
                state.listeners.add(listener);
                return () => state.listeners.delete(listener);
            },
            close: () => {
                if (state.closed)
                    return;
                state.closed = true;
                state.listeners.clear();
                this.endpoints.delete(id);
            }
        };
    }
    connectedEndpointIds() {
        return [...this.endpoints.keys()];
    }
    dispatch(packet) {
        if (packet.targetId) {
            const target = this.endpoints.get(packet.targetId);
            if (!target || target.closed)
                return;
            for (const listener of target.listeners)
                listener(structuredClone(packet));
            return;
        }
        for (const [endpointId, target] of this.endpoints) {
            if (endpointId === packet.senderId || target.closed)
                continue;
            for (const listener of target.listeners)
                listener(structuredClone(packet));
        }
    }
}
