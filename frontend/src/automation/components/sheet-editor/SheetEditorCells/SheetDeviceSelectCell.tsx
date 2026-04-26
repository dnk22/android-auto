import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useController } from "react-hook-form";

import DebouncedButton from "../../../../components/common/DebouncedButton";
import type { SheetEditorTableProps } from "../../../../types/automation/editor.types";

interface SheetDeviceSelectCellProps {
  rowIndex: number;
  deviceOptions: string[];
  control: SheetEditorTableProps["control"];
  isEditable: boolean;
}

export function SheetDeviceSelectCell({
  rowIndex,
  deviceOptions,
  control,
  isEditable,
}: SheetDeviceSelectCellProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { field } = useController({
    control,
    name: `rows.${rowIndex}.deviceId`,
  });

  const options = useMemo(() => ["all", ...deviceOptions], [deviceOptions]);
  const selectedValues = Array.isArray(field.value) && field.value.length > 0
    ? field.value
    : ["all"];
  const visibleValues = selectedValues.slice(0, 2);
  const hiddenCount = Math.max(0, selectedValues.length - visibleValues.length);

  const toggleValue = (value: string) => {
    if (!isEditable) {
      return;
    }

    if (value === "all") {
      field.onChange(["all"]);
      return;
    }

    const withoutAll = selectedValues.filter((item) => item !== "all");
    const exists = withoutAll.includes(value);
    const next = exists
      ? withoutAll.filter((item) => item !== value)
      : [...withoutAll, value];

    field.onChange(next.length === 0 ? ["all"] : next);
  };

  const removeValue = (value: string) => {
    if (!isEditable) {
      return;
    }

    if (value === "all") {
      return;
    }

    const next = selectedValues.filter((item) => item !== "all" && item !== value);
    field.onChange(next.length === 0 ? ["all"] : next);
  };

  useEffect(() => {
    if (!isEditable) {
      setOpen(false);
    }
  }, [isEditable]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block max-w-[200px]" ref={rootRef}>
      <DebouncedButton
        type="button"
        onClick={() => {
          if (!isEditable) {
            return;
          }
          setOpen((prev) => !prev);
        }}
        disabled={!isEditable}
        className="min-h-10 w-fit max-w-[200px] rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex max-w-[190px] items-center gap-1.5 overflow-hidden">
          {visibleValues.map((value) => {
            const label = value === "all" ? "Tất cả" : value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--card-border)] px-2 py-1 text-[11px] text-[var(--ink)]"
              >
                <span className="max-w-[90px] truncate">{label}</span>
                {value !== "all" && isEditable ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer text-[10px] font-semibold leading-none text-[var(--muted)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeValue(value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeValue(value);
                      }
                    }}
                  >
                    x
                  </span>
                ) : null}
              </span>
            );
          })}
          {hiddenCount > 0 ? (
            <span className="rounded-md bg-[var(--card-border)] px-2 py-1 text-[11px] text-[var(--muted)]">
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      </DebouncedButton>

      {open ? (
        <div className="absolute left-0 z-30 mt-1 min-w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] shadow-lg">
          <div className="max-h-56 overflow-auto p-1">
            {options.map((value) => {
              const checked = selectedValues.includes(value);
              const label = value === "all" ? "Tất cả" : value;

              return (
                <DebouncedButton
                  key={value}
                  type="button"
                  onClick={() => toggleValue(value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-[var(--card-border)]"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={checked}
                    className="h-4 w-4 rounded border-[var(--card-border)]"
                  />
                  <span className="truncate text-[var(--ink)]">{label}</span>
                </DebouncedButton>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
