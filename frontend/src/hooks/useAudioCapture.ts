import { useEffect, useRef, useState } from "react";

type CaptureState = {
  isCapturing: boolean;
  error: string | null;
};

export function useAudioCapture() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sinkNodeRef = useRef<GainNode | null>(null);
  const [state, setState] = useState<CaptureState>({
    isCapturing: false,
    error: null
  });

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  async function start(onAudioFrame: (frame: ArrayBuffer) => void) {
    if (state.isCapturing) {
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule("/recorder-worklet.js");

      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-recorder");
      const sinkNode = audioContext.createGain();
      sinkNode.gain.value = 0;

      workletNode.port.onmessage = (event) => {
        onAudioFrame(event.data as ArrayBuffer);
      };

      sourceNode.connect(workletNode);
      workletNode.connect(sinkNode);
      sinkNode.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      mediaStreamRef.current = mediaStream;
      sourceNodeRef.current = sourceNode;
      workletNodeRef.current = workletNode;
      sinkNodeRef.current = sinkNode;

      setState({ isCapturing: true, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "麦克风启动失败";
      setState({ isCapturing: false, error: message });
      throw error;
    }
  }

  async function stop() {
    workletNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    sinkNodeRef.current?.disconnect();

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    workletNodeRef.current = null;
    sourceNodeRef.current = null;
    sinkNodeRef.current = null;

    setState((current) => ({ ...current, isCapturing: false }));
  }

  return {
    ...state,
    start,
    stop
  };
}
