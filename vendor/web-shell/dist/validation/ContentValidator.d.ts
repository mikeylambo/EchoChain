export type ValidationSeverity = "error" | "warning";
export interface ValidationIssue {
    severity: ValidationSeverity;
    code: string;
    message: string;
    path?: string;
}
export interface ValidationResult {
    ok: boolean;
    issues: ValidationIssue[];
}
export type ContentRule<T> = (value: T) => ValidationIssue[];
export declare class ContentValidator<T> {
    private readonly rules;
    use(rule: ContentRule<T>): this;
    validate(value: T): ValidationResult;
}
export declare const uniqueBy: <T>(items: readonly T[], key: (item: T) => string, path?: string) => ValidationIssue[];
export declare const requiredReference: (id: string | undefined, available: ReadonlySet<string>, path: string, label?: string) => ValidationIssue[];
