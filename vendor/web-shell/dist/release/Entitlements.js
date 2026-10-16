/** Small release gate for free-demo/full-game SKUs. Games register semantic
 * content ids or features and ask the shell whether the active entitlement may
 * enter them. Store/platform ownership can update the state at runtime. */
export class EntitlementManager {
    state;
    rules = new Map();
    features = new Set();
    constructor(initial = "full") { this.state = initial; }
    setState(state) { this.state = state; }
    get current() { return this.state; }
    register(rules) { for (const rule of rules)
        this.rules.set(rule.id, { ...rule }); }
    grantFeature(id) { this.features.add(id); }
    revokeFeature(id) { this.features.delete(id); }
    hasFeature(id) { return this.features.has(id); }
    allows(id) {
        const rule = this.rules.get(id);
        if (!rule)
            return this.state === "full";
        if (rule.requiredFeature && !this.features.has(rule.requiredFeature))
            return false;
        if (this.state === "full")
            return true;
        return rule.demoAllowed === true;
    }
    assertAllowed(id) { if (!this.allows(id))
        throw new Error(`Content is not available for the active entitlement: ${id}`); }
}
