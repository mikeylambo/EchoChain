export interface UIStressOptions {
    expandText?: boolean;
    textExpansion?: number;
    rtl?: boolean;
    textScale?: number;
}
export declare function applyUIStress(root: HTMLElement, options?: UIStressOptions): () => void;
