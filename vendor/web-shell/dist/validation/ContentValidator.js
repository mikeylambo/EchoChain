export class ContentValidator {
    rules = [];
    use(rule) { this.rules.push(rule); return this; }
    validate(value) { const issues = this.rules.flatMap(rule => rule(value)); return { ok: !issues.some(issue => issue.severity === "error"), issues }; }
}
export const uniqueBy = (items, key, path = "items") => {
    const seen = new Set();
    const issues = [];
    items.forEach((item, index) => { const id = key(item); if (seen.has(id))
        issues.push({ severity: "error", code: "duplicate-id", message: `Duplicate id '${id}'`, path: `${path}[${index}]` }); seen.add(id); });
    return issues;
};
export const requiredReference = (id, available, path, label = "reference") => {
    if (!id)
        return [{ severity: "error", code: "missing-reference", message: `Missing ${label}`, path }];
    return available.has(id) ? [] : [{ severity: "error", code: "invalid-reference", message: `Unknown ${label} '${id}'`, path }];
};
