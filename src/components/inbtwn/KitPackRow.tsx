import type { KitLine } from "@/lib/kit";

/** Small − n/total + control. */
export function Stepper({
  value,
  total,
  onChange,
  label,
}: {
  value: number;
  total: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center border border-ink/25">
      <button
        type="button"
        aria-label={`One fewer ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="tap flex size-9 items-center justify-center font-mono text-[16px]"
      >
        −
      </button>
      <span className="min-w-[44px] text-center font-mono text-[13px]">
        {value}/{total}
      </span>
      <button
        type="button"
        aria-label={`One more ${label}`}
        onClick={() => onChange(Math.min(total, value + 1))}
        className="tap flex size-9 items-center justify-center font-mono text-[16px]"
      >
        +
      </button>
    </div>
  );
}

/**
 * Packing row for an Event Kit line. Quantity 1 = single checkbox.
 * Quantity > 1 = checkbox packs all at once, stepper for partial.
 */
export function KitPackRow({ line, onPacked }: { line: KitLine; onPacked: (n: number) => void }) {
  const done = line.packedComplete;
  const multi = line.required > 1;
  return (
    <div className="flex items-center border-b border-ink/10 py-1 last:border-0">
      <button
        type="button"
        onClick={() => onPacked(done ? 0 : line.required)}
        aria-pressed={done}
        aria-label={`${done ? "Unpack" : "Pack"} ${line.item.name}`}
        className="tap -ml-2 flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
            done ? "border-ink bg-ink text-cream" : "border-ink/40 bg-paper"
          }`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
      <div className={`min-w-0 flex-1 ${done ? "text-ink-soft line-through opacity-60" : ""}`}>
        <div className="text-[14px] leading-tight">{line.item.name}</div>
        {multi && !done && line.packed > 0 ? (
          <div className="font-mono text-[10px] text-flame">Packed {line.packed}/{line.required}</div>
        ) : null}
      </div>
      {multi && !done ? (
        <Stepper value={line.packed} total={line.required} onChange={onPacked} label={line.item.name} />
      ) : (
        <span className="shrink-0 font-mono text-[14px]">
          {multi ? `${line.required}/${line.required}` : line.required}
        </span>
      )}
    </div>
  );
}
