import type { SelectahProps } from "../../types/types"

export const Selectah = ({ dropdownItems, value, onChange }: SelectahProps) => (
  <select value={value} onChange={(e) => onChange?.(e.target.value)}>
    {dropdownItems.map((item, i) => (
      <option key={i} value={item}>
        {item}
      </option>
    ))}
  </select>
);