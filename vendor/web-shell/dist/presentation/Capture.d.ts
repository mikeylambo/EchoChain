export interface CaptureResult {
    id: string;
    mimeType: string;
    data?: Blob | string;
    metadata?: Record<string, string | number | boolean>;
}
export interface CaptureAdapter {
    capture(id: string, options?: Record<string, unknown>): Promise<CaptureResult>;
}
export declare class CaptureService {
    private readonly adapter?;
    constructor(adapter?: CaptureAdapter | undefined);
    capture(id: string, options?: Record<string, unknown>): Promise<CaptureResult>;
}
