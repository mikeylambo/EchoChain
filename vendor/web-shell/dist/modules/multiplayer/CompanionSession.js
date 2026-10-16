import { EventBus } from "../../core/EventBus.js";
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomString(length, alphabet) {
    const values = new Uint32Array(length);
    if (globalThis.crypto?.getRandomValues)
        globalThis.crypto.getRandomValues(values);
    else
        for (let i = 0; i < values.length; i++)
            values[i] = Math.floor(Math.random() * 0xffffffff);
    let result = "";
    for (const value of values)
        result += alphabet.charAt(value % alphabet.length);
    return result;
}
function clone(value) {
    return structuredClone(value);
}
/**
 * Host-authoritative state for shared-screen + personal-screen multiplayer.
 * Public truth and per-player private truth are stored separately by construction.
 */
export class CompanionSessionManager {
    events = new EventBus();
    roomCode;
    maxPlayers;
    now;
    reconnectTokenFactory;
    messageLimit;
    players = new Map();
    publicState = {};
    privateState = new Map();
    messages = [];
    phaseValue = "lobby";
    messageSequence = 0;
    constructor(options = {}) {
        this.maxPlayers = options.maxPlayers ?? 4;
        if (!Number.isInteger(this.maxPlayers) || this.maxPlayers < 1 || this.maxPlayers > 8) {
            throw new Error("Companion maxPlayers must be an integer from 1 to 8");
        }
        this.roomCode = options.roomCode?.trim().toUpperCase() || randomString(4, ROOM_ALPHABET);
        if (!/^[A-Z0-9]{4,8}$/.test(this.roomCode))
            throw new Error("Companion roomCode must be 4-8 letters or numbers");
        this.now = options.now ?? (() => Date.now());
        this.reconnectTokenFactory = options.reconnectTokenFactory ?? (() => randomString(24, TOKEN_ALPHABET));
        this.messageLimit = options.messageLimit ?? 256;
        if (!Number.isInteger(this.messageLimit) || this.messageLimit < 1)
            throw new Error("Companion messageLimit must be positive");
    }
    phase() {
        return this.phaseValue;
    }
    join(deviceId, displayName) {
        const normalizedDeviceId = deviceId.trim();
        if (!normalizedDeviceId)
            throw new Error("Companion deviceId is required");
        const existing = [...this.players.values()].find((player) => player.deviceId === normalizedDeviceId);
        if (existing) {
            if (displayName?.trim())
                existing.displayName = displayName.trim();
            if (!existing.connected) {
                existing.connected = true;
                this.events.emit("companion:player-reconnected", this.publicPlayer(existing));
            }
            return this.receipt(existing);
        }
        if (this.players.size >= this.maxPlayers)
            throw new Error("No companion player slots available");
        const slot = this.nextSlot();
        const player = {
            id: `player-${slot}`,
            slot,
            deviceId: normalizedDeviceId,
            displayName: displayName?.trim() || `P${slot}`,
            reconnectToken: this.reconnectTokenFactory(slot),
            ready: false,
            connected: true,
            view: "shared"
        };
        this.players.set(player.id, player);
        this.privateState.set(player.id, {});
        this.events.emit("companion:player-joined", this.publicPlayer(player));
        return this.receipt(player);
    }
    reconnect(reconnectToken, deviceId) {
        const token = reconnectToken.trim();
        const nextDeviceId = deviceId.trim();
        if (!token || !nextDeviceId)
            throw new Error("Reconnect token and deviceId are required");
        const player = [...this.players.values()].find((candidate) => candidate.reconnectToken === token);
        if (!player)
            throw new Error("Unknown companion reconnect token");
        player.deviceId = nextDeviceId;
        player.connected = true;
        this.events.emit("companion:player-reconnected", this.publicPlayer(player));
        return this.receipt(player);
    }
    disconnect(playerId) {
        const player = this.requirePlayer(playerId);
        player.connected = false;
        const snapshot = this.publicPlayer(player);
        this.events.emit("companion:player-disconnected", snapshot);
        return snapshot;
    }
    leave(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        this.players.delete(playerId);
        this.privateState.delete(playerId);
        this.events.emit("companion:player-left", this.publicPlayer(player));
        return true;
    }
    setReady(playerId, ready = true) {
        const player = this.requirePlayer(playerId);
        player.ready = ready;
        const snapshot = this.publicPlayer(player);
        this.events.emit("companion:player-ready", snapshot);
        return snapshot;
    }
    allReady(minPlayers = 1) {
        return this.players.size >= minPlayers && [...this.players.values()].every((player) => player.connected && player.ready);
    }
    start(minPlayers = 1) {
        if (!this.allReady(minPlayers))
            throw new Error("Companion session cannot start until all joined players are connected and ready");
        this.transition("together");
    }
    split(assignments) {
        if (this.phaseValue !== "together" && this.phaseValue !== "regroup") {
            throw new Error(`Companion session cannot split during ${this.phaseValue}`);
        }
        for (const playerId of Object.keys(assignments))
            this.requirePlayer(playerId);
        let privatePlayers = 0;
        for (const player of this.players.values()) {
            const zone = assignments[player.id]?.trim();
            if (zone) {
                player.view = "private";
                player.privateZoneId = zone;
                privatePlayers++;
            }
            else {
                player.view = "shared";
                delete player.privateZoneId;
            }
        }
        if (privatePlayers === 0)
            throw new Error("Companion split requires at least one private player zone");
        this.transition("split");
    }
    regroup() {
        if (this.phaseValue !== "split")
            throw new Error(`Companion session cannot regroup during ${this.phaseValue}`);
        for (const player of this.players.values()) {
            player.view = "shared";
            delete player.privateZoneId;
        }
        this.transition("regroup");
    }
    resumeTogether() {
        if (this.phaseValue !== "regroup")
            throw new Error(`Companion session cannot resume together during ${this.phaseValue}`);
        this.transition("together");
    }
    finish(payload = null) {
        this.broadcast("session:finished", payload);
        this.transition("results");
    }
    setPublicState(key, value) {
        const normalizedKey = this.requireKey(key);
        this.publicState[normalizedKey] = clone(value);
        this.events.emit("companion:public-state", { key: normalizedKey, value: clone(value) });
    }
    setPrivateState(playerId, key, value) {
        this.requirePlayer(playerId);
        const normalizedKey = this.requireKey(key);
        const state = this.privateState.get(playerId) ?? {};
        state[normalizedKey] = clone(value);
        this.privateState.set(playerId, state);
        this.events.emit("companion:private-state", { playerId, key: normalizedKey, value: clone(value) });
    }
    broadcast(type, payload) {
        return this.pushMessage(type, { kind: "all" }, payload);
    }
    sendPrivate(playerId, type, payload) {
        this.requirePlayer(playerId);
        return this.pushMessage(type, { kind: "player", playerId }, payload);
    }
    submitAction(playerId, type, payload) {
        const player = this.requireConnectedPlayer(playerId);
        const normalizedType = type.trim();
        if (!normalizedType)
            throw new Error("Companion action type is required");
        const action = {
            playerId,
            type: normalizedType,
            payload: clone(payload),
            phase: this.phaseValue,
            view: player.view,
            ...(player.privateZoneId ? { privateZoneId: player.privateZoneId } : {}),
            createdAt: this.now()
        };
        this.events.emit("companion:action", clone(action));
        return clone(action);
    }
    viewFor(playerId, afterSequence = 0) {
        const player = this.requirePlayer(playerId);
        return {
            roomCode: this.roomCode,
            phase: this.phaseValue,
            player: this.receipt(player),
            players: this.listPlayers(),
            publicState: clone(this.publicState),
            privateState: clone(this.privateState.get(playerId) ?? {}),
            messages: this.messages
                .filter((message) => message.sequence > afterSequence && (message.audience.kind === "all" || message.audience.playerId === playerId))
                .map((message) => clone(message))
        };
    }
    hostSnapshot() {
        const privateStateByPlayer = {};
        for (const [playerId, state] of this.privateState)
            privateStateByPlayer[playerId] = clone(state);
        return {
            roomCode: this.roomCode,
            phase: this.phaseValue,
            players: this.listPlayers(),
            publicState: clone(this.publicState),
            privateStateByPlayer
        };
    }
    listPlayers() {
        return [...this.players.values()]
            .sort((a, b) => a.slot - b.slot)
            .map((player) => this.publicPlayer(player));
    }
    pushMessage(type, audience, payload) {
        const normalizedType = type.trim();
        if (!normalizedType)
            throw new Error("Companion message type is required");
        const message = {
            id: `message-${++this.messageSequence}`,
            sequence: this.messageSequence,
            type: normalizedType,
            audience: clone(audience),
            payload: clone(payload),
            createdAt: this.now()
        };
        this.messages.push(message);
        while (this.messages.length > this.messageLimit)
            this.messages.shift();
        this.events.emit("companion:message", clone(message));
        return clone(message);
    }
    transition(next) {
        if (this.phaseValue === next)
            return;
        const previous = this.phaseValue;
        this.phaseValue = next;
        this.events.emit("companion:phase-changed", { previous, current: next });
    }
    nextSlot() {
        const used = new Set([...this.players.values()].map((player) => player.slot));
        for (let slot = 1; slot <= this.maxPlayers; slot++)
            if (!used.has(slot))
                return slot;
        throw new Error("No companion player slots available");
    }
    requirePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            throw new Error(`Unknown companion player: ${playerId}`);
        return player;
    }
    requireConnectedPlayer(playerId) {
        const player = this.requirePlayer(playerId);
        if (!player.connected)
            throw new Error(`Companion player is disconnected: ${playerId}`);
        return player;
    }
    requireKey(key) {
        const normalized = key.trim();
        if (!normalized)
            throw new Error("Companion state key is required");
        return normalized;
    }
    publicPlayer(player) {
        return clone({
            id: player.id,
            slot: player.slot,
            displayName: player.displayName,
            ready: player.ready,
            connected: player.connected,
            view: player.view,
            ...(player.privateZoneId ? { privateZoneId: player.privateZoneId } : {})
        });
    }
    receipt(player) {
        return { ...this.publicPlayer(player), reconnectToken: player.reconnectToken };
    }
}
