import { pseudoLocalize } from "../localization/Localization.js";
export function applyUIStress(root, options = {}) {
    const changedText = [];
    const originalDirection = root.dir;
    const originalFontSize = root.style.fontSize;
    if (options.expandText) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();
        while (current) {
            const text = current;
            if (text.nodeValue?.trim()) {
                changedText.push({ node: text, value: text.nodeValue });
                text.nodeValue = pseudoLocalize(text.nodeValue, options.textExpansion ?? 0.35);
            }
            current = walker.nextNode();
        }
    }
    if (options.rtl)
        root.dir = "rtl";
    if (options.textScale && options.textScale > 0)
        root.style.fontSize = `${options.textScale * 100}%`;
    return () => { for (const item of changedText)
        item.node.nodeValue = item.value; root.dir = originalDirection; root.style.fontSize = originalFontSize; };
}
