export default function ThresholdSlider({ value, onChange }) {
  return (
    <div className="threshold">
      <div className="threshold__header">
        <label htmlFor="threshold" className="field__label">
          Match mínimo
        </label>
        <span className="threshold__value" aria-live="polite">
          {value}%
        </span>
      </div>
      <input
        id="threshold"
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        aria-valuetext={`Match mínimo: ${value}%`}
        onChange={(e) => onChange(Number(e.target.value))}
        // Variable CSS para pintar la parte rellena del slider
        style={{ '--fill': `${value}%` }}
      />
      <div className="threshold__scale" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
