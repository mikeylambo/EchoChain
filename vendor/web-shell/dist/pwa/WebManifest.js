export function validateWebManifest(manifest) {
    const issues = [];
    if (!manifest.name)
        issues.push("Missing name");
    if (!manifest.short_name)
        issues.push("Missing short_name");
    if (!manifest.icons?.some(icon => icon.sizes.split(/\s+/).includes("192x192")))
        issues.push("Missing 192x192 icon");
    if (!manifest.icons?.some(icon => icon.sizes.split(/\s+/).includes("512x512")))
        issues.push("Missing 512x512 icon");
    return issues;
}
