/** Central registry for VO ids so narrative, subtitles, localization and audio stay aligned. */
export class VoiceManifest {
    lines = new Map();
    register(lines) { for (const line of lines) {
        if (!line.id || !line.assetId)
            throw new Error("Voice line requires id and assetId");
        this.lines.set(line.id, structuredClone(line));
    } }
    get(id) { const line = this.lines.get(id); return line ? structuredClone(line) : null; }
    list() { return [...this.lines.values()].map(line => structuredClone(line)); }
    validate() { const issues = []; for (const line of this.lines.values()) {
        if (!line.speaker)
            issues.push(`${line.id}: missing speaker`);
        if (line.durationMs !== undefined && line.durationMs <= 0)
            issues.push(`${line.id}: invalid duration`);
    } return issues; }
}
