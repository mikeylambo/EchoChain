export interface CreditEntry {
    role: string;
    names: string[];
    section?: string;
    note?: string;
}
export interface CreditsDocument {
    title?: string;
    entries: CreditEntry[];
    legal?: string[];
}
export declare class CreditsRegistry {
    private document;
    set(document: CreditsDocument): void;
    add(entry: CreditEntry): void;
    snapshot(): CreditsDocument;
    sections(): string[];
    bySection(section: string): CreditEntry[];
}
