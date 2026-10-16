import type { Unsubscribe } from "../../core/types.js";
export interface CompanionTransportPacket<T = unknown> {
    senderId: string;
    targetId?: string;
    type: string;
    payload: T;
}
export interface CompanionTransport {
    readonly endpointId: string;
    send<T = unknown>(packet: Omit<CompanionTransportPacket<T>, "senderId">): void | Promise<void>;
    onMessage(listener: (packet: CompanionTransportPacket) => void): Unsubscribe;
    close(): void | Promise<void>;
}
/**
 * Dependency-free relay used by tests, local prototypes and same-page controller previews.
 * Production games can implement CompanionTransport with WebSocket/WebRTC without changing
 * any session or game rules.
 */
export declare class LoopbackCompanionHub {
    private endpoints;
    connect(endpointId: string): CompanionTransport;
    connectedEndpointIds(): string[];
    private dispatch;
}
