export type ClientControlMessage =
  | { type: "start"; script: string }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "seek"; cursor: number };

export type BackendState = "ready" | "listening" | "stopped";
export type ScreenMode = "single" | "dual";
export type FontPreset = "serif" | "sans";

export type ServerMessage =
  | {
      type: "cursor";
      position: number;
      score?: number;
      matched?: string;
    }
  | {
      type: "transcript";
      text: string;
      is_final: boolean;
      latency_ms?: number;
    }
  | {
      type: "status";
      state: BackendState;
    }
  | {
      type: "error";
      message: string;
    };

export type TeleprompterSettings = {
  fontSize: number;
  lineHeight: number;
  viewportHeight: number;
  anchorRatio: number;
  transitionMs: number;
  textWidth: number;
  letterSpacing: number;
  dimReadText: boolean;
  previewSpeed: number;
  screenMode: ScreenMode;
  fontPreset: FontPreset;
  appBackgroundStart: string;
  appBackgroundEnd: string;
  workspaceBackground: string;
  panelBackground: string;
  teleprompterBackgroundTop: string;
  teleprompterBackgroundBottom: string;
  readTextColor: string;
  currentTextColor: string;
  upcomingTextColor: string;
  guideColor: string;
  currentAccentColor: string;
};
