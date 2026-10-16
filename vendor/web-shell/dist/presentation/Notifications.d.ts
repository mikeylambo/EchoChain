import { EventBus } from "../core/EventBus.js";
export type NotificationKind = "info" | "success" | "warning" | "error" | "achievement" | "unlock";
export interface Notification {
    id: string;
    kind: NotificationKind;
    title: string;
    body?: string;
    durationMs?: number;
    iconId?: string;
    priority?: number;
}
export interface NotificationEvents {
    "notification:show": Notification;
    "notification:dismiss": {
        id: string;
    };
    [key: string]: unknown;
}
export declare class NotificationCenter {
    readonly events: EventBus<NotificationEvents>;
    private readonly active;
    show(notification: Notification): void;
    dismiss(id: string): boolean;
    clear(): void;
    list(): Notification[];
}
