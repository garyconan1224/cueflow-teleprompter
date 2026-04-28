import { useEffect, useRef, useState } from "react";
import type {
  BackendState,
  ClientControlMessage,
  ServerMessage
} from "../types/messages";

export type WSConnectionState = "idle" | "connecting" | "connected" | "error";

type HookState = {
  connectionState: WSConnectionState;
  backendState: BackendState | null;
  transcript: string;
  cursorPosition: number | null;
  matchScore: number | null;
  matchedText: string;
  lastLatencyMs: number | null;
  lastError: string | null;
};

const initialState: HookState = {
  connectionState: "idle",
  backendState: null,
  transcript: "",
  cursorPosition: null,
  matchScore: null,
  matchedText: "",
  lastLatencyMs: null,
  lastError: null
};

export function useTeleprompterWS() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<HookState>(initialState);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  async function connect(url: string, script: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendControl({ type: "start", script });
      return;
    }

    setState((current) => ({
      ...current,
      connectionState: "connecting",
      lastError: null
    }));

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        wsRef.current = ws;
        setState((current) => ({
          ...current,
          connectionState: "connected",
          lastError: null
        }));
        ws.send(JSON.stringify({ type: "start", script } satisfies ClientControlMessage));
        resolve();
      };

      ws.onerror = () => {
        setState((current) => ({
          ...current,
          connectionState: "error",
          lastError: "WebSocket 连接失败"
        }));
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState((current) => ({
          ...current,
          connectionState: current.connectionState === "error" ? "error" : "idle",
          backendState: null
        }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as ServerMessage;
          if (payload.type === "status") {
            setState((current) => ({ ...current, backendState: payload.state }));
            return;
          }

          if (payload.type === "transcript") {
            setState((current) => ({
              ...current,
              transcript: mergeTranscript(current.transcript, payload.text),
              lastLatencyMs: payload.latency_ms ?? current.lastLatencyMs
            }));
            return;
          }

          if (payload.type === "cursor") {
            setState((current) => ({
              ...current,
              cursorPosition: payload.position,
              matchScore:
                payload.score !== undefined ? payload.score : current.matchScore,
              matchedText: payload.matched ?? current.matchedText
            }));
            return;
          }

          if (payload.type === "error") {
            setState((current) => ({
              ...current,
              lastError: payload.message
            }));
          }
        } catch {
          setState((current) => ({
            ...current,
            lastError: "服务端返回了无法解析的消息"
          }));
        }
      };
    });
  }

  function disconnect() {
    wsRef.current?.close();
    wsRef.current = null;
    setState((current) => ({
      ...current,
      connectionState: "idle",
      backendState: null
    }));
  }

  function sendControl(message: ClientControlMessage) {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify(message));
  }

  function sendAudioFrame(frame: ArrayBuffer) {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(frame);
  }

  function clearTranscript() {
    setState((current) => ({
      ...current,
      transcript: "",
      matchedText: "",
      matchScore: null,
      lastLatencyMs: null,
      lastError: null
    }));
  }

  return {
    ...state,
    connect,
    disconnect,
    sendControl,
    sendAudioFrame,
    clearTranscript
  };
}

function mergeTranscript(current: string, next: string) {
  if (!current) {
    return next;
  }
  if (!next || current.endsWith(next)) {
    return current;
  }
  return `${current}${next}`;
}
