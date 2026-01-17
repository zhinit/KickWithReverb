import { useEffect, useRef, useState} from "react";
import { Knob } from "./components/Knob";
import { ControlStrip } from "./components/ControlStrip"
import { LayerStrip } from "./components/LayerStrip"
import type { LayerStripProps } from "./types/types";
import { Daw } from "./components/Daw"
import "./App.css";

function App() {
  return (
    <>
      <Daw />
    </>
  );
}

export default App;
