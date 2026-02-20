import "./daw.css";
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import { PresetsBar } from "./PresetsBar";
import { KickGenBar } from "./KickGenBar";
import { useAudioEngine } from "../../hooks/use-audio-engine";
import { useKickLayer } from "../../hooks/use-kick-layer";
import { useNoiseLayer } from "../../hooks/use-noise-layer";
import { useReverbLayer } from "../../hooks/use-reverb-layer";
import { useMasterChain } from "../../hooks/use-master-chain";
import { useTransport } from "../../hooks/use-transport";
import { usePresets } from "../../hooks/use-presets";
import { useAiKicks } from "../../hooks/use-ai-kicks";
import { useAuth } from "../../hooks/use-auth";
import { LoadingOverlay } from "./LoadingOverlay";
import { useEffect, useState } from "react";

export const Daw = () => {
  const { userStatus } = useAuth();
  const isMember = userStatus === "member";

  const [mode, setMode] = useState<"daw" | "kickGen">("daw");
  const [selectedAiKickId, setSelectedAiKickId] = useState<number | null>(null);

  const [showOverlay, setShowOverlay] = useState(true);

  // Audio engine (AudioContext + WASM worklet)
  const engine = useAudioEngine();

  // AI kicks (fetch + decode + load into WASM on startup)
  const aiKicks = useAiKicks(engine);

  // Layer hooks — all routing is internal to the C++ engine
  const kick = useKickLayer(engine, aiKicks.aiKickNameToIndex);
  const noise = useNoiseLayer(engine);
  const reverb = useReverbLayer(engine);
  const master = useMasterChain(engine);

  // Select an AI kick — updates useKickLayer state so Selectah + WASM stay in sync
  const selectAiKick = (id: number) => {
    const found = aiKicks.aiKicks.find((k) => k.id === id);
    if (!found) return;
    kick.setters.setSample(found.name);
    setSelectedAiKickId(id);
  };

  // Wrap generate to select the new kick after it's created
  const handleGenerate = async () => {
    const result = await aiKicks.generate();
    if (result.ok && result.kick) {
      kick.setters.setSample(result.kick.name);
      setSelectedAiKickId(result.kick.id);
    }
    return result;
  };

  // Transport hook
  const transport = useTransport(engine);

  // Reset kickGen mode and stop playback on user change (Daw stays mounted across sessions)
  // Re-show overlay so it covers the preset fetch transition
  useEffect(() => {
    setMode("daw");
    setSelectedAiKickId(null);
    transport.stop();
    setShowOverlay(true);
  }, [userStatus]);

  // Presets hook
  const presets = usePresets({
    kick: { setters: kick.setters, getState: kick.getState },
    noise: { setters: noise.setters, getState: noise.getState },
    reverb: { setters: reverb.setters, getState: reverb.getState },
    master: { setters: master.setters, getState: master.getState },
    transport: { setters: transport.setters, getState: transport.getState },
  });

  const allLoaded = engine.isReady && !presets.isLoading;

  // Fallback: if allLoaded becomes true while Daw is hidden (display: none),
  // onTransitionEnd won't fire, so dismiss via timeout
  useEffect(() => {
    if (allLoaded && showOverlay) {
      const timer = setTimeout(() => setShowOverlay(false), 500);
      return () => clearTimeout(timer);
    }
  }, [allLoaded, showOverlay]);

  return (
    <div className="daw">
      {showOverlay && (
        <LoadingOverlay
          isReady={allLoaded}
          onFaded={() => setShowOverlay(false)}
        />
      )}
      <h1>{mode === "kickGen" ? "AI KICK GEN MODE" : "KICK WITH REVERB"}</h1>
      {mode === "kickGen" ? (
        <KickGenBar
          aiKicks={aiKicks.aiKicks}
          selectedKickId={selectedAiKickId}
          onSelectKick={selectAiKick}
          onGenerate={handleGenerate}
          onDelete={aiKicks.remove}
          isGenerating={aiKicks.isGenerating}
          remainingGensToday={aiKicks.remainingGensToday}
          totalGensCount={aiKicks.totalGensCount}
        />
      ) : (
        <PresetsBar
          isMember={isMember}
          presets={presets.presets}
          currentPresetId={presets.currentPresetId}
          currentPresetName={presets.currentPresetName}
          canDelete={presets.canDelete}
          onLoadPreset={presets.loadPreset}
          onSave={presets.savePreset}
          onDelete={presets.deleteCurrentPreset}
          onNext={presets.nextPreset}
          onPrev={presets.prevPreset}
        />
      )}
      <ControlStrip {...transport.controlProps} />
      <SoundUnit
        kickKnobProps={{
          ...kick.uiProps,
          ...(mode === "kickGen" && {
            customDropdown: (
              <button
                className="back-to-daw-btn"
                onClick={() => setMode("daw")}
              >
                Back To DAW
              </button>
            ),
          }),
        }}
        noiseKnobProps={noise.uiProps}
        reverbKnobProps={reverb.uiProps}
      />
      <MasterStrip {...master.uiProps} />
      {isMember && mode === "daw" && (
        <button
          className="generate-ai-kick-btn"
          onClick={() => {
            setMode("kickGen");
            if (aiKicks.aiKicks.length > 0) {
              selectAiKick(aiKicks.aiKicks[0].id);
            }
          }}
        >
          Generate AI Kick From The Ether
        </button>
      )}
    </div>
  );
};
