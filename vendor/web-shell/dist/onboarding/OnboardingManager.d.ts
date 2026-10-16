import { EventBus } from "../core/EventBus.js";
export interface OnboardingLesson {
    id: string;
    title?: string;
    text: string;
    action?: string;
    tags?: string[];
    payload?: unknown;
    repeatable?: boolean;
}
export interface OnboardingFlow {
    id: string;
    lessons: string[];
    skippable?: boolean;
}
export interface OnboardingState {
    completedLessons: string[];
    completedFlows: string[];
    skippedFlows: string[];
}
export interface OnboardingEvents {
    "onboarding:flow-start": {
        flowId: string;
    };
    "onboarding:lesson": {
        flowId: string | null;
        lesson: OnboardingLesson;
        index: number;
    };
    "onboarding:lesson-complete": {
        lessonId: string;
    };
    "onboarding:flow-complete": {
        flowId: string;
    };
    "onboarding:flow-skip": {
        flowId: string;
    };
    "onboarding:dismiss": {
        lessonId: string;
    };
    [key: string]: unknown;
}
/** Renderer-neutral first-run/contextual teaching state generalized from shipped game onboarding. */
export declare class OnboardingManager {
    readonly events: EventBus<OnboardingEvents>;
    private readonly lessons;
    private readonly flows;
    private completedLessons;
    private completedFlows;
    private skippedFlows;
    private activeFlow;
    private index;
    private activeLesson;
    registerLessons(lessons: readonly OnboardingLesson[]): void;
    registerFlows(flows: readonly OnboardingFlow[]): void;
    start(flowId: string, options?: {
        force?: boolean;
    }): OnboardingLesson | null;
    /** Show a contextual/help lesson without entering a flow. */
    show(lessonId: string, options?: {
        force?: boolean;
    }): OnboardingLesson | null;
    completeCurrent(): OnboardingLesson | null;
    dismiss(): void;
    skipFlow(): boolean;
    hasCompletedLesson(id: string): boolean;
    hasCompletedFlow(id: string): boolean;
    snapshot(): OnboardingState;
    hydrate(state: Partial<OnboardingState>): void;
    get current(): OnboardingLesson | null;
    get flowId(): string | null;
    private advance;
    private emitLesson;
}
