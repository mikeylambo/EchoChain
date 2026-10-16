export function validateReleaseManifest(manifest) {
    const issues = [];
    if (!manifest.gameId)
        issues.push("Missing gameId");
    if (!manifest.version)
        issues.push("Missing version");
    if (manifest.channel === "demo" && manifest.demo === false)
        issues.push("Demo channel cannot declare demo=false");
    return issues;
}
