export type InputDeviceType = "keyboard" | "gamepad" | "touch";

export interface GamepadState {
  connected: boolean;
  padName: string;
  primaryPressed: boolean;    // Button 0 (A / Cross)
  cancelPressed: boolean;     // Button 1 (B / Circle)
  syncPressed: boolean;       // Button 2 or 3 (X / Square or Y / Triangle)
  pausePressed: boolean;      // Button 9 (Start / Options)
  codexPressed: boolean;      // Button 3 (Y / Triangle) or Button 8
  dpadLeft: boolean;          // Button 14 or Left Stick Left
  dpadRight: boolean;         // Button 15 or Left Stick Right
  dpadUp: boolean;            // Button 12 or Left Stick Up
  dpadDown: boolean;          // Button 13 or Left Stick Down
}

export class GamepadManager {
  private prevButtons: boolean[] = [];
  private prevStickLeft = false;
  private prevStickRight = false;
  private prevStickUp = false;
  private prevStickDown = false;
  private activeDevice: InputDeviceType = "keyboard";

  constructor() {
    window.addEventListener("gamepadconnected", (e) => {
      console.log(`[EchoChain] Controller connected: ${e.gamepad.id}`);
      this.activeDevice = "gamepad";
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(`[EchoChain] Controller disconnected: ${e.gamepad.id}`);
    });

    window.addEventListener("keydown", () => {
      this.activeDevice = "keyboard";
    });

    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") {
        this.activeDevice = "touch";
      } else {
        this.activeDevice = "keyboard";
      }
    });
  }

  get device(): InputDeviceType {
    return this.activeDevice;
  }

  setDevice(type: InputDeviceType): void {
    this.activeDevice = type;
  }

  poll(): GamepadState {
    const empty: GamepadState = {
      connected: false,
      padName: "",
      primaryPressed: false,
      cancelPressed: false,
      syncPressed: false,
      pausePressed: false,
      codexPressed: false,
      dpadLeft: false,
      dpadRight: false,
      dpadUp: false,
      dpadDown: false,
    };

    if (typeof navigator === "undefined" || !navigator.getGamepads) return empty;
    const gamepads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      const g = gamepads[i];
      if (g && g.connected) {
        pad = g;
        break;
      }
    }

    if (!pad) {
      this.prevButtons = [];
      return empty;
    }

    // Check if any button was pressed on gamepad to set active device
    const currentButtons = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const anyDown = currentButtons.some((b) => b) || Math.abs(pad.axes[0] ?? 0) > 0.4 || Math.abs(pad.axes[1] ?? 0) > 0.4;
    if (anyDown) {
      this.activeDevice = "gamepad";
    }

    const isJustPressed = (idx: number): boolean => {
      const now = !!currentButtons[idx];
      const prev = !!this.prevButtons[idx];
      return now && !prev;
    };

    // Analog stick with deadzone (0.45)
    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;
    const stickLeft = axisX < -0.45;
    const stickRight = axisX > 0.45;
    const stickUp = axisY < -0.45;
    const stickDown = axisY > 0.45;

    const dpadLeft = isJustPressed(14) || (stickLeft && !this.prevStickLeft);
    const dpadRight = isJustPressed(15) || (stickRight && !this.prevStickRight);
    const dpadUp = isJustPressed(12) || (stickUp && !this.prevStickUp);
    const dpadDown = isJustPressed(13) || (stickDown && !this.prevStickDown);

    this.prevStickLeft = stickLeft;
    this.prevStickRight = stickRight;
    this.prevStickUp = stickUp;
    this.prevStickDown = stickDown;

    const state: GamepadState = {
      connected: true,
      padName: pad.id,
      primaryPressed: isJustPressed(0), // A / Cross
      cancelPressed: isJustPressed(1),  // B / Circle
      syncPressed: isJustPressed(2) || isJustPressed(3), // X / Square or Y / Triangle
      pausePressed: isJustPressed(9),   // Start / Options
      codexPressed: isJustPressed(3) || isJustPressed(8), // Y or Select
      dpadLeft,
      dpadRight,
      dpadUp,
      dpadDown,
    };

    this.prevButtons = currentButtons;
    return state;
  }

  getPrimaryPrompt(): string {
    if (this.activeDevice === "gamepad") return "[ Ⓐ / ✕ ]";
    if (this.activeDevice === "touch") return "[TAP]";
    return "[SPACE]";
  }

  getSyncPrompt(): string {
    if (this.activeDevice === "gamepad") return "[ Ⓧ / Ⓨ ]";
    if (this.activeDevice === "touch") return "[SYNC]";
    return "[S / ENTER]";
  }

  getPausePrompt(): string {
    if (this.activeDevice === "gamepad") return "[ ☰ ]";
    if (this.activeDevice === "touch") return "[ ⏸ ]";
    return "[ESC]";
  }
}
