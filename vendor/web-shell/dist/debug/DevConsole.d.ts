export interface DevCommandContext {
    args: string[];
    raw: string;
}
export interface DevCommand {
    description?: string;
    run: (context: DevCommandContext) => void | Promise<void | string> | string;
}
export interface DevPanel {
    description?: string;
    read: () => unknown | Promise<unknown>;
}
export declare class DevConsoleRegistry {
    private readonly commands;
    private readonly panels;
    register(name: string, command: DevCommand): () => void;
    registerPanel(name: string, panel: DevPanel): () => void;
    list(): readonly {
        name: string;
        description?: string;
    }[];
    listPanels(): readonly {
        name: string;
        description?: string;
    }[];
    readPanel(name: string): Promise<unknown>;
    execute(line: string): Promise<string | void>;
}
export interface MountedDevConsole {
    dispose(): void;
    show(): void;
    hide(): void;
    toggle(): void;
    refresh(): Promise<void>;
}
export declare function mountBrowserDevConsole(registry: DevConsoleRegistry, options?: {
    hotkey?: string;
    title?: string;
    refreshMs?: number;
}): MountedDevConsole;
