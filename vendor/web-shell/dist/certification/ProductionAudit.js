export function auditProduction(input) {
    const issues = [];
    if (input.voice)
        for (const message of input.voice.validate())
            issues.push({ scope: "voice", message, severity: "error" });
    if (input.requiredVoiceIds && input.voice)
        for (const id of input.requiredVoiceIds)
            if (!input.voice.get(id))
                issues.push({ scope: "voice", message: `Missing required voice line: ${id}`, severity: "error" });
    if (input.requiredSubtitleVoiceIds) {
        const found = new Set((input.subtitleTracks ?? []).flatMap(track => track.cues.map(cue => cue.voiceId).filter((id) => !!id)));
        for (const id of input.requiredSubtitleVoiceIds)
            if (!found.has(id))
                issues.push({ scope: "subtitles", message: `Missing subtitle cue for voice line: ${id}`, severity: "error" });
    }
    for (const feature of input.requiredFeatures ?? [])
        if (!feature.enabled)
            issues.push({ scope: "feature", message: `Required feature disabled: ${feature.id}`, severity: "error" });
    return { ok: issues.every(issue => issue.severity !== "error"), issues };
}
