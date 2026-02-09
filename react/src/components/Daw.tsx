import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import { PresetsBar } from "./PresetsBar";
import { KickGenBar } from "./KickGenBar";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import { useReverbLayer } from "../hooks/useReverbLayer";
import { useMasterChain } from "../hooks/useMasterChain";
import { useTransport } from "../hooks/useTransport";
import { usePresets } from "../hooks/usePresets";
import { useAiKicks } from "../hooks/useAiKicks";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";

export const Daw = () => {
  const { userStatus } = useAuth();
  const isMember = userStatus === "member";

  const [mode, setMode] = useState<"daw" | "kickGen">("daw");
  const [selectedAiKickId, setSelectedAiKickId] = useState<number | null>(null);

  // Reset kickGen mode on user change (Daw stays mounted across sessions)
  useEffect(() => {
    setMode("daw");
    setSelectedAiKickId(null);
  }, [userStatus]);

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

  // Presets hook
  const presets = usePresets({
    kick: { setters: kick.setters, getState: kick.getState },
    noise: { setters: noise.setters, getState: noise.getState },
    reverb: { setters: reverb.setters, getState: reverb.getState },
    master: { setters: master.setters, getState: master.getState },
    transport: { setters: transport.setters, getState: transport.getState },
  });

  return (
    <div className="daw">
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
      <div className="daw-grid">
        <ControlStrip {...transport.controlProps} />
        <SoundUnit
          kickKnobProps={{
            ...kick.uiProps,
            ...(mode === "kickGen" && {
              customDropdown: (
                <button className="back-to-daw-btn" onClick={() => setMode("daw")}>Back To DAW</button>
              ),
            }),
          }}
          noiseKnobProps={noise.uiProps}
          reverbKnobProps={reverb.uiProps}
        />
        <MasterStrip {...master.uiProps} />
      </div>
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
