export type VisualTier = "hero" | "standard" | "background";
export type VisualSource = "procedural" | "model" | "sprite" | "custom";
export interface VisualRegistration<TVisual, TContext = void> {
    factory: (context: TContext) => TVisual;
    tier?: VisualTier;
    source?: VisualSource;
    update?: (visual: TVisual, dt: number, context: TContext) => void;
    dispose?: (visual: TVisual) => void;
}
export interface VisualInstance<TVisual, TContext = void> {
    key: string;
    visual: TVisual;
    registration: VisualRegistration<TVisual, TContext>;
    update(dt: number, context: TContext): void;
    dispose(): void;
}
/**
 * Renderer-neutral registry for presentation factories.
 *
 * The shell owns naming/lifecycle only. Three.js, Babylon, Phaser, DOM, Canvas,
 * and future renderers provide their own visual type and mounting adapter.
 * Gameplay must never read presentation geometry back into authoritative state.
 */
export declare class VisualRegistry<TVisual, TContext = void> {
    private readonly entries;
    register(key: string, registration: VisualRegistration<TVisual, TContext>): void;
    replace(key: string, registration: VisualRegistration<TVisual, TContext>): void;
    unregister(key: string): boolean;
    has(key: string): boolean;
    get(key: string): VisualRegistration<TVisual, TContext> | undefined;
    keys(): string[];
    create(key: string, context: TContext): VisualInstance<TVisual, TContext> | null;
}
export declare function createVisualRegistry<TVisual, TContext = void>(): VisualRegistry<TVisual, TContext>;
