import { useCallback, useEffect, useRef, useState } from "react";
import {
  kickFiles,
  kickNames,
  noiseFiles,
  noiseNames,
  irFiles,
  irNames,
} from "../utils/audio-assets";

export interface AudioEngine {
  postMessage: (message: { type: string; [key: string]: unknown }) => void;
  resume: () => Promise<void>;
  isReady: boolean;
  kickNameToIndex: Record<string, number>;
  noiseNameToIndex: Record<string, number>;
  irNameToIndex: Record<string, number>;
  loadKickSample: (url: string) => Promise<number>;
}

// Build name:index maps (stable, computed once)
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

const BLOCK = 128;
const MAX_RING_BLOCKS = 64;

// SharedArrayBuffer layout: dryWriteCount(4) + wetWriteCount(4) + dryRing + wetRingL + wetRingR
const SAB_SIZE = 8 + MAX_RING_BLOCKS * BLOCK * 4 * 3;

// Audio engine custom hook which is used in DAW component
export const useAudioEngine = (): AudioEngine => {
  // states
  const [isReady, setIsReady] = useState(false);

  // refs for audio context and audio worklet since we dont want these to restart on render
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const nextKickIndexRef = useRef(kickNames.length);

  // tail worker refs
  const tailWorkerRef = useRef<Worker | null>(null);
  const tailGlueCodeRef = useRef<string | null>(null);
  const irDataRef = useRef<{ irSamples: Float32Array; irLength: number; numChannels: number }[]>([]);

  // starts (or restarts) the tail worker for a given IR
  const startTailWorker = useCallback(
    async (irIndex: number) => {
      const node = workletNodeRef.current;
      const glueCode = tailGlueCodeRef.current;
      const irEntry = irDataRef.current[irIndex];
      if (!node || !glueCode || !irEntry) return;

      // terminate previous worker
      if (tailWorkerRef.current) {
        tailWorkerRef.current.terminate();
        tailWorkerRef.current = null;
      }

      const worker = new Worker("/tail-worker.js");
      tailWorkerRef.current = worker;

      // init WASM in worker
      await new Promise<void>((resolve) => {
        worker.onmessage = (e) => {
          if (e.data.type === "ready") resolve();
        };
        worker.postMessage({ type: "init", scriptCode: glueCode });
      });

      // create and distribute SharedArrayBuffer
      const sab = new SharedArrayBuffer(SAB_SIZE);
      node.port.postMessage({ type: "sharedBuffer", sab });
      worker.postMessage({ type: "sharedBuffer", sab });

      // forward tailReady from worker to worklet
      worker.onmessage = (e) => {
        if (e.data.type === "tailReady") {
          node.port.postMessage({ type: "tailReady" });
        }
      };

      // send IR to tail worker (loads all levels, then enters processLoop)
      const irCopy = new Float32Array(irEntry.irSamples);
      worker.postMessage({
        type: "loadIR",
        irSamples: irCopy,
        irLength: irEntry.irLength,
        numChannels: irEntry.numChannels,
      });
    },
    []
  );

  // function to send msg to WASM DSP (intercepts selectIR for tail worker)
  const postMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      workletNodeRef.current?.port.postMessage(message);

      if (message.type === "selectIR" && typeof message.index === "number") {
        startTailWorker(message.index);
      }
    },
    [startTailWorker]
  );

  // function so that audio can play (browser starts as suspended)
  const resume = useCallback(async () => {
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, []);

  // function take sample from url decode raw bytes into a float32 arr and send to worklet
  const loadKickSample = useCallback(async (url: string): Promise<number> => {
    const ctx = audioContextRef.current;
    const node = workletNodeRef.current;
    if (!ctx || !node) throw new Error("Engine not ready");

    const response = await fetch(url); // response with header/payload
    const arrayBuffer = await response.arrayBuffer(); // .wav/.mp3
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer); // channels of samples
    const samples = new Float32Array(audioBuffer.getChannelData(0)); // samples
    const nextKickIndex = nextKickIndexRef.current++;

    node.port.postMessage({ type: "loadKickSample", samples }, [
      samples.buffer,
    ]);
    return nextKickIndex;
  }, []);

  // initialization use effect
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // create audio context and connect to ref
      const ctx = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = ctx;

      // Fetch Emscripten glue code for both engines
      const [engineResponse, tailResponse] = await Promise.all([
        fetch("/audio-engine.js"),
        fetch("/tail-engine.js"),
      ]);
      const emscriptenGlueCode = await engineResponse.text();
      tailGlueCodeRef.current = await tailResponse.text();

      // loads and runs dsp-processor.js in the audio worklet
      await ctx.audioWorklet.addModule("/dsp-processor.js");

      // creates worklet node on worklet that was just created and connects to ref
      const node = new AudioWorkletNode(ctx, "dsp-processor", {
        outputChannelCount: [2],
      });
      node.connect(ctx.destination);
      workletNodeRef.current = node;

      // Send glue code and wait for WASM ready
      await new Promise<void>((resolve) => {
        node.port.onmessage = (e) => {
          if (e.data.type === "ready") resolve();
        };
        node.port.postMessage({ type: "init", scriptCode: emscriptenGlueCode });
      });

      // guard to make sure we havent cleaned up while awaiting
      if (cancelled) return;

      // Decode an audio URL
      async function decodeAudio(url: string) {
        const response = await fetch(url); // response with header/payload
        const arrayBuffer = await response.arrayBuffer(); // mp3/wav
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer); //channels of samples
        return audioBuffer;
      }

      // Load all kick samples (mono)
      for (const name of kickNames) {
        const audioBuffer = await decodeAudio(kickFiles[name]);
        const samples = new Float32Array(audioBuffer.getChannelData(0));
        node.port.postMessage({ type: "loadKickSample", samples }, [
          samples.buffer,
        ]);
      }

      // Load all noise samples (mono)
      for (const name of noiseNames) {
        const audioBuffer = await decodeAudio(noiseFiles[name]);
        const samples = new Float32Array(audioBuffer.getChannelData(0));
        node.port.postMessage({ type: "loadNoiseSample", samples }, [
          samples.buffer,
        ]);
      }

      // Load all IRs (store data for tail worker)
      for (const name of irNames) {
        const audioBuffer = await decodeAudio(irFiles[name]);

        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        const samples = new Float32Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
          samples[i * 2] = left[i];
          samples[i * 2 + 1] = right[i];
        }

        // store for tail worker (needs a copy since we transfer the original)
        irDataRef.current.push({
          irSamples: new Float32Array(samples),
          irLength: audioBuffer.length,
          numChannels: audioBuffer.numberOfChannels,
        });

        node.port.postMessage(
          {
            type: "loadIR",
            irSamples: samples,
            irLength: audioBuffer.length,
            numChannels: audioBuffer.numberOfChannels,
          },
          [samples.buffer]
        );
      }

      if (!cancelled) setIsReady(true);
    }

    // call init function
    init().catch(console.error);

    // cleanup
    return () => {
      cancelled = true;
      tailWorkerRef.current?.terminate();
      workletNodeRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  // return items so they can easily be accessed elsewhere
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
