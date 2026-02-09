import { useCallback, useEffect, useRef, useState } from "react";
import {
  kickFiles,
  kickNames,
  noiseFiles,
  noiseNames,
  irFiles,
  irNames,
} from "../utils/audioAssets";

export interface AudioEngine {
  postMessage: (message: { type: string; [key: string]: unknown }) => void;
  resume: () => Promise<void>;
  isReady: boolean;
  kickNameToIndex: Record<string, number>;
  noiseNameToIndex: Record<string, number>;
  irNameToIndex: Record<string, number>;
  loadKickSample: (url: string) => Promise<number>;
}

// Build name→index maps (stable, computed once)
const kickNameToIndex: Record<string, number> = {};
kickNames.forEach((name, i) => {
  kickNameToIndex[name] = i;
});

const noiseNameToIndex: Record<string, number> = {};
noiseNames.forEach((name, i) => {
  noiseNameToIndex[name] = i;
});

const irNameToIndex: Record<string, number> = {};
irNames.forEach((name, i) => {
  irNameToIndex[name] = i;
});

export const useAudioEngine = (): AudioEngine => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextKickIndexRef = useRef(kickNames.length);
  const [isReady, setIsReady] = useState(false);

  const postMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      workletNodeRef.current?.port.postMessage(message);
    },
    [],
  );

  const resume = useCallback(async () => {
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, []);

  const loadKickSample = useCallback(async (url: string): Promise<number> => {
    const ctx = audioContextRef.current;
    const node = workletNodeRef.current;
    if (!ctx || !node) throw new Error("Engine not ready");

    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const samples = new Float32Array(audioBuffer.getChannelData(0));
    const index = nextKickIndexRef.current++;

    node.port.postMessage({ type: "loadKickSample", samples }, [samples.buffer]);
    return index;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ctx = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = ctx;

      // Fetch Emscripten glue code
      const response = await fetch("/audio-engine.js");
      const scriptCode = await response.text();

      // Load worklet processor
      await ctx.audioWorklet.addModule("/dsp-processor.js");

      // Create worklet node (stereo output)
      const node = new AudioWorkletNode(ctx, "dsp-processor", {
        outputChannelCount: [2],
        numberOfOutputs: 1,
      });
      node.connect(ctx.destination);
      workletNodeRef.current = node;

      // Send glue code and wait for WASM ready
      await new Promise<void>((resolve) => {
        node.port.onmessage = (e) => {
          if (e.data.type === "ready") resolve();
        };
        node.port.postMessage({ type: "init", scriptCode });
      });

      if (cancelled) return;

      // Decode an audio URL to Float32Array
      async function decodeAudio(url: string) {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        return audioBuffer;
      }

      // Load all kick samples (mono)
      for (const name of kickNames) {
        const buf = await decodeAudio(kickFiles[name]);
        const samples = new Float32Array(buf.getChannelData(0));
        node.port.postMessage(
          { type: "loadKickSample", samples },
          [samples.buffer],
        );
      }

      // Load all noise samples (mono)
      for (const name of noiseNames) {
        const buf = await decodeAudio(noiseFiles[name]);
        const samples = new Float32Array(buf.getChannelData(0));
        node.port.postMessage(
          { type: "loadNoiseSample", samples },
          [samples.buffer],
        );
      }

      // Load all IRs (may be stereo — interleaved [L0,R0,L1,R1,...])
      for (const name of irNames) {
        const buf = await decodeAudio(irFiles[name]);
        let samples: Float32Array;

        if (buf.numberOfChannels === 1) {
          samples = new Float32Array(buf.getChannelData(0));
        } else {
          const left = buf.getChannelData(0);
          const right = buf.getChannelData(1);
          samples = new Float32Array(left.length * 2);
          for (let i = 0; i < left.length; i++) {
            samples[i * 2] = left[i];
            samples[i * 2 + 1] = right[i];
          }
        }

        node.port.postMessage(
          {
            type: "loadIR",
            irSamples: samples,
            irLength: buf.length,
            numChannels: buf.numberOfChannels,
          },
          [samples.buffer],
        );
      }

      if (!cancelled) setIsReady(true);
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      workletNodeRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  return {
    postMessage,
    resume,
    isReady,
    kickNameToIndex,
    noiseNameToIndex,
    irNameToIndex,
    loadKickSample,
  };
};
