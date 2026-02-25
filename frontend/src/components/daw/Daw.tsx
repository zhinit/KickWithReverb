import "./daw.css";

import { useEffect, useState } from "react";

// components
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { LayerStrip } from "./LayerStrip";
import { PresetsBar } from "./PresetsBar";
import { KickGenBar } from "./KickGenBar";
import { LoadingOverlay } from "./LoadingOverlay";

// custom hooks
import { useAuth } from "../../hooks/use-auth";
import { useAudioEngine } from "../../hooks/use-audio-engine";
import { useKickLayer } from "../../hooks/use-kick-layer";
import { useNoiseLayer } from "../../hooks/use-noise-layer";
import { useReverbLayer } from "../../hooks/use-reverb-layer";
import { useMasterChain } from "../../hooks/use-master-chain";
import { useTransport } from "../../hooks/use-transport";
import { usePresets } from "../../hooks/use-presets";
import { useAiKicks } from "../../hooks/use-ai-kicks";

export const Daw = () => {
  // states
  const { userStatus } = useAuth();
  const isMember = userStatus === "member"; // im just here for convienence
  const [mode, setMode] = useState<"daw" | "kickGen">("daw");
  const [selectedAiKickId, setSelectedAiKickId] = useState<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Audio engine (AudioContext + WASM worklet)
  const engine = useAudioEngine();

  // AI kicks (fetch + decode + load into WASM on startup)
  const aiKicks = useAiKicks(engine);

  // custom hooks to commuicate with dsp. note that routing happens in DSP
  const kick = useKickLayer(engine, aiKicks.aiKickNameToIndex);
  const noise = useNoiseLayer(engine);
  const reverb = useReverbLayer(engine);
  const master = useMasterChain(engine);
  const transport = useTransport(engine);

  // Presets hook
  const presets = usePresets({
    kick: { setters: kick.setters, getState: kick.getState },
    noise: { setters: noise.setters, getState: noise.getState },
    reverb: { setters: reverb.setters, getState: reverb.getState },
    master: { setters: master.setters, getState: master.getState },
    transport: { setters: transport.setters, getState: transport.getState },
  });

  // loading screen flag
  const allLoaded = engine.isReady && !presets.isLoading;
  // if allLoaded becomes true while Daw is hidden
  // onTransitionEnd won't fire, so dismiss via timeout
  useEffect(() => {
    if (allLoaded && showOverlay) {
      const timer = setTimeout(() => setShowOverlay(false), 500);
      return () => clearTimeout(timer);
    }
  }, [allLoaded, showOverlay]);

  // reset state of daw when a user logs in/out
  useEffect(() => {
    setMode("daw");
    transport.stop();
    setSelectedAiKickId(null);
    setShowOverlay(true);
  }, [userStatus]);

  // handler for when user selects an AI kick in dropdown in AI mode
  const selectAiKick = (id: number) => {
    const found = aiKicks.aiKicks.find((k) => k.id === id);
    if (!found) return;
    kick.setters.setSample(found.name);
    setSelectedAiKickId(id);
  };

  // handler to generate an ai kick when a user clicks GEN
  const handleGenerate = async () => {
    const result = await aiKicks.generate();
    if (result.ok && result.kick) {
      kick.setters.setSample(result.kick.name);
      setSelectedAiKickId(result.kick.id);
    }
    return result;
  };

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
      <div className="sound-unit">
        <LayerStrip
          {...kick.uiProps}
          {...(mode === "kickGen" && {
            customDropdown: (
              <button
                className="back-to-daw-btn"
                onClick={() => setMode("daw")}
              >
                Back To DAW
              </button>
            ),
          })}
        />
        <LayerStrip {...noise.uiProps} />
        <LayerStrip {...reverb.uiProps} />
      </div>
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
