/** Orientation-aware device-motion look source generalized from Traversal FPS. */
export class GyroLook {
    options;
    x = 0;
    y = 0;
    enabled = false;
    permission = false;
    mode;
    sensitivity;
    constructor(options = {}) {
        this.options = options;
        this.mode = options.mode ?? "off";
        this.sensitivity = options.sensitivity ?? 0.7;
    }
    async requestPermission() {
        if (typeof DeviceMotionEvent === "undefined")
            return false;
        const ctor = DeviceMotionEvent;
        try {
            this.permission = ctor.requestPermission ? (await ctor.requestPermission()) === "granted" : true;
        }
        catch {
            this.permission = false;
        }
        return this.permission;
    }
    attach(target = window) { const handler = (event) => this.onMotion(event); target.addEventListener("devicemotion", handler); this.enabled = true; return () => { target.removeEventListener("devicemotion", handler); this.enabled = false; }; }
    setMode(mode) { this.mode = mode; }
    setSensitivity(value) { this.sensitivity = Math.max(0, value); }
    consume() { const value = { x: this.x, y: this.y }; this.x = 0; this.y = 0; return value; }
    get granted() { return this.permission; }
    onMotion(event) {
        if (!this.enabled || !this.permission || this.mode === "off")
            return;
        if (this.mode === "conditional" && !this.options.condition?.())
            return;
        const rotation = event.rotationRate;
        if (!rotation)
            return;
        const angle = Number(screen.orientation?.angle ?? 0);
        let yaw = rotation.gamma ?? 0, pitch = rotation.beta ?? 0;
        if (angle === 90) {
            yaw = rotation.beta ?? 0;
            pitch = -(rotation.gamma ?? 0);
        }
        else if (angle === 270) {
            yaw = -(rotation.beta ?? 0);
            pitch = rotation.gamma ?? 0;
        }
        else if (angle === 180) {
            yaw = -(rotation.gamma ?? 0);
            pitch = -(rotation.beta ?? 0);
        }
        this.x += yaw * this.sensitivity;
        this.y += pitch * this.sensitivity;
    }
}
