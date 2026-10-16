import { ContentValidator, type ValidationResult } from "../validation/ContentValidator.js";
export interface DataContentDocument<T> {
    schemaVersion: number;
    group: string;
    entries: T[];
}
export type DataContentParser<T> = (value: unknown) => T;
export declare class DataContentLoader<T extends {
    id: string;
}> {
    private readonly parser;
    private readonly validator?;
    constructor(parser: DataContentParser<T>, validator?: ContentValidator<readonly T[]> | undefined);
    parse(input: string | unknown): {
        document: DataContentDocument<T>;
        validation: ValidationResult;
    };
}
export declare class LiveContentSource {
    private revision;
    private readonly listeners;
    bump(): void;
    currentRevision(): number;
    onChange(listener: (revision: number) => void): () => void;
}
