import DebouncedButton from "../common/DebouncedButton";

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
}

export default function ToolbarButton({ label, onClick }: ToolbarButtonProps): JSX.Element {
  return (
    <DebouncedButton
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--card-border)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ink)]"
    >
      {label}
    </DebouncedButton>
  );
}
