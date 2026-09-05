"use client";

export const RANGES = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  return (
    <div className="ranges" role="tablist" aria-label="Chart range">
      {RANGES.map((range) => (
        <button
          key={range.key}
          type="button"
          role="tab"
          aria-selected={range.key === value}
          className={range.key === value ? "range active" : "range"}
          onClick={() => onChange(range.key)}
        >
          {range.key}
        </button>
      ))}
    </div>
  );
}
