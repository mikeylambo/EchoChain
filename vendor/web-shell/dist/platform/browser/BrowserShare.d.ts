export interface SharePayload {
    title: string;
    text?: string;
    url?: string;
    files?: File[];
}
export interface ShareResult {
    method: "native" | "clipboard" | "none";
    shared: boolean;
}
/** Browser share helper generalized from Descent's results-screen sharing flow. */
export declare class BrowserShare {
    share(payload: SharePayload): Promise<ShareResult>;
}
