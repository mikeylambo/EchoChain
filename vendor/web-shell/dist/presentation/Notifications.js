import { EventBus } from "../core/EventBus.js";
export class NotificationCenter {
    events = new EventBus();
    active = new Map();
    show(notification) { const item = structuredClone(notification); this.active.set(item.id, item); this.events.emit("notification:show", item); }
    dismiss(id) { const removed = this.active.delete(id); if (removed)
        this.events.emit("notification:dismiss", { id }); return removed; }
    clear() { for (const id of [...this.active.keys()])
        this.dismiss(id); }
    list() { return [...this.active.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(item => structuredClone(item)); }
}
