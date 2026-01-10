import "./App.css";

const Knob = () => {
  return <button>Knob</button>;
};

const Selectah = () => (
  <select>
    <option>option 1</option>
    <option>option 2</option>
    <option>option 3</option>
  </select>
);

const ControlStrip = () => (
  <>
    <button>CUE</button>
    <button>PLAY</button>
    <button>BPM</button>
  </>
);

const LayerStrip = () => (
  <>
    <div>
      <div>
        <Selectah />
      </div>
      <div>
        <Knob />
      </div>
      <div>
        <Knob />
      </div>
      <div>
        <Knob />
      </div>
    </div>
  </>
);

const SoundUnit = () => (
  <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
    <LayerStrip />
    <LayerStrip />
    <LayerStrip />
  </div>
);

const MasterStrip = () => (
  <>
    <p>Fully Deep Mastering Chain</p>
    <div>
      <Knob />
      <Knob />
      <Knob />
    </div>
  </>
);

const Daw = () => (
  <>
    <h1>KICK WITH REVERB</h1>
    <h2>Fully featured fully sophisticated DAW</h2>
    <h2>for the modern tik tok techno purist.</h2>
    <ControlStrip />
    <SoundUnit />
    <MasterStrip />
  </>
);

function App() {
  return (
    <>
      <Daw />
    </>
  );
}

export default App;
