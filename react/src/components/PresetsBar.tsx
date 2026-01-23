export const PresetsBar = () => {
  const presetsList = ["preset1", "preset2"];

  return (
    <div className="presets-bar">
      <button className="presets-bar-piece">⇇</button>
      <button className="presets-bar-piece">⇉</button>
      <select className="presets-bar-name">
        {presetsList.map((item, i) => (
          <option key={i}>{item}</option>
        ))}
      </select>
      <button className="presets-bar-piece">💾</button>
    </div>
  );
};
