export type ClientControlMessage =
  | { type: "start"; script: string }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "seek"; cursor: number };

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
    }
  | {
      type: "status";
      state: "ready" | "listening" | "stopped";
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
};
