export function Tile({
  label,
  value,
  unit,
  meta,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  meta?: string | null;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? Math.round(value).toLocaleString()
        : value;

  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value">
        {display}
        {unit && display !== "—" ? <span className="unit">{unit}</span> : null}
      </div>
      {meta ? <div className="meta">{meta}</div> : null}
    </div>
  );
}
