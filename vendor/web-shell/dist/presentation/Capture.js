export class CaptureService {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async capture(id, options) { if (!this.adapter)
        throw new Error("No capture adapter configured"); return this.adapter.capture(id, options); }
}
