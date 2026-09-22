import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { EVENT_STATUSES, sourceLabel, type EventSource, type EventStatus } from "@/lib/constants";

/* ---------- Status & source ---------- */

const STATUS_CLASSES: Record<string, string> = {
  "s-enq": "bg-s-enq/15 text-s-enq",
  "s-quote": "bg-s-quote/15 text-s-quote",
  "s-await": "bg-s-await/15 text-s-await",
  "s-conf": "bg-s-conf/15 text-s-conf",
  "s-prog": "bg-s-prog/15 text-s-prog",
  "s-done": "bg-s-done/15 text-s-done",
  "s-lost": "bg-s-lost/15 text-s-lost",
};

export function StatusPill({ status, className }: { status: EventStatus; className?: string }) {
  const meta = EVENT_STATUSES.find((s) => s.value === status);
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-sm px-1.5 py-0.5",
        STATUS_CLASSES[meta?.tone ?? "s-done"],
        className,
      )}
    >
      {meta?.label ?? status}
    </span>
  );
}

export function SourceBadge({ source, className }: { source: EventSource; className?: string }) {
  const marketplace = source === "togather" || source === "poptop";
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center rounded-sm px-1.5 py-0.5 bg-ink/8 text-ink-soft",
        marketplace && "bg-ink text-cream",
        className,
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="label-mono rounded-sm border border-dashed border-ink/30 px-1 py-0.5 text-ink-soft">
      Demo
    </span>
  );
}

/* ---------- Layout ---------- */

export function TornCard({
  children,
  className,
  tilt = 0,
  as: Comp = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tilt?: -1 | 0 | 1;
  as?: "div" | "button";
} & Record<string, unknown>) {
  return (
    <Comp
      className={cn(
        "torn block w-full bg-cream text-left text-ink",
        tilt === -1 && "-rotate-[0.5deg]",
        tilt === 1 && "rotate-[0.5deg]",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function PageTitle({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[30px] leading-none">{title}</h1>
        {children}
      </div>
      {aside ? <div className="label-hand text-ink-soft">{aside}</div> : null}
    </div>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="label-hand text-ink-soft">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="torn bg-cream px-4 py-5 text-center font-mono text-[12px] text-ink-soft">
      {children}
    </div>
  );
}

/* ---------- Form primitives ---------- */

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 flex items-center gap-1 text-ink-soft">
        {label}
        {required ? <span className="text-flame">*</span> : null}
        {hint ? <span className="ml-auto normal-case tracking-normal">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const controlBase =
  "tap w-full rounded-sm border border-input bg-cream px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-soft/60 focus:border-ink focus:outline-none";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlBase, "appearance-none", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlBase, "min-h-[88px]", props.className)} />;
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-mono text-[11px] rounded-sm px-3 py-2 min-h-[36px] transition-colors",
        active ? "bg-ink text-cream" : "bg-cream text-ink-soft outline-1 outline-ink/15",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "tap inline-flex w-full items-center justify-center gap-2 rounded-sm bg-ink px-4 py-3 font-semibold text-cream shadow-press active:translate-y-[2px] active:shadow-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "tap inline-flex items-center justify-center gap-2 rounded-sm border border-ink/20 bg-cream px-4 py-2.5 font-mono text-[12px] text-ink disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[84px] z-10 -mx-5 mt-6 border-t border-ink/10 bg-paper/95 px-5 py-3 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
      {children}
    </div>
  );
}
