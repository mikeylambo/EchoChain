// Minimal Node globals for the headless tools (avoids a @types/node dependency).
declare const process: {
  argv: string[];
  exitCode?: number;
  stderr: { write(s: string): void };
};
