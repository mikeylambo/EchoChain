export type WebAppDisplay = "fullscreen" | "standalone" | "minimal-ui" | "browser";
export interface WebManifestIcon {
    src: string;
    sizes: string;
    type?: string;
    purpose?: "any" | "maskable" | "monochrome" | string;
}
export interface WebGameManifest {
    id?: string;
    name: string;
    short_name: string;
    description?: string;
    start_url?: string;
    scope?: string;
    display?: WebAppDisplay;
    orientation?: "any" | "natural" | "landscape" | "portrait" | "landscape-primary" | "portrait-primary";
    background_color?: string;
    theme_color?: string;
    categories?: string[];
    icons?: WebManifestIcon[];
}
export declare function validateWebManifest(manifest: WebGameManifest): string[];
