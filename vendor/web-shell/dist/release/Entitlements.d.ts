export type EntitlementState = "demo" | "full";
export interface EntitlementRule {
    id: string;
    demoAllowed?: boolean;
    requiredFeature?: string;
}
/** Small release gate for free-demo/full-game SKUs. Games register semantic
 * content ids or features and ask the shell whether the active entitlement may
 * enter them. Store/platform ownership can update the state at runtime. */
export declare class EntitlementManager {
    private state;
    private readonly rules;
    private readonly features;
    constructor(initial?: EntitlementState);
    setState(state: EntitlementState): void;
    get current(): EntitlementState;
    register(rules: readonly EntitlementRule[]): void;
    grantFeature(id: string): void;
    revokeFeature(id: string): void;
    hasFeature(id: string): boolean;
    allows(id: string): boolean;
    assertAllowed(id: string): void;
}
