import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useController } from "react-hook-form";

import DebouncedButton from "../../../components/common/DebouncedButton";
import type { SheetEditorTableProps } from "../../../types/automation/editor.types";
import type { SheetStatus } from "../../types/sheetStatus.types";
import type { SheetMergedInfoPayload } from "../../hooks/useSheetMergedInfoModal";
import { getSheetStatusLabelVi } from "../../utils/constants/sheetStatus.constants";

interface SheetTextInputCellProps {
  rowIndex: number;
  field: "hashtagInline";
  register: SheetEditorTableProps["register"];
}

export function SheetTextInputCell({ rowIndex, field, register }: SheetTextInputCellProps): JSX.Element {
  return (
    <input
      className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2"
      {...register(`rows.${rowIndex}.${field}` as const)}
    />
  );
}

interface SheetProductsChipsInputCellProps {
  rowIndex: number;
  control: SheetEditorTableProps["control"];
}

export function SheetProductsChipsInputCell({
  rowIndex,
  control,
}: SheetProductsChipsInputCellProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const { field } = useController({
    control,
    name: `rows.${rowIndex}.products`,
  });

  const products = Array.isArray(field.value) ? field.value : [];

  const commitDraft = () => {
    const value = draft.trim();
    if (!value) {
      return;
    }

    const next = Array.from(new Set([...products, value]));
    field.onChange(next);
    setDraft("");
  };

  const removeProduct = (value: string) => {
    const next = products.filter((item) => item !== value);
    field.onChange(next);
  };

  return (
    <div className="min-h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {products.map((product) => (
          <span
            key={product}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--card-border)] px-2 py-1 text-[11px] text-[var(--ink)]"
          >
            <span className="max-w-[110px] truncate">{product}</span>
            <span
              role="button"
              tabIndex={0}
              className="cursor-pointer text-[10px] font-semibold leading-none text-[var(--muted)]"
              onClick={() => removeProduct(product)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  removeProduct(product);
                }
              }}
            >
              x
            </span>
          </span>
        ))}

        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder="Thêm sản phẩm"
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 outline-none"
        />
      </div>
    </div>
  );
}

interface SheetDeviceSelectCellProps {
  rowIndex: number;
  deviceOptions: string[];
  control: SheetEditorTableProps["control"];
}

export function SheetDeviceSelectCell({
  rowIndex,
  deviceOptions,
  control,
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
    if (value === "all") {
      return;
    }

    const next = selectedValues.filter((item) => item !== "all" && item !== value);
    field.onChange(next.length === 0 ? ["all"] : next);
  };

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
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-10 w-fit max-w-[200px] rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-2 text-left"
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
                {value !== "all" ? (
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

interface SheetStatusReadonlyCellProps {
  status: SheetStatus;
}

export function SheetStatusReadonlyCell({ status }: SheetStatusReadonlyCellProps): JSX.Element {
  return (
    <div className="inline-flex min-w-[96px] items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      {getSheetStatusLabelVi(status)}
    </div>
  );
}

interface SheetMergedInfoTriggerCellProps {
  payload: SheetMergedInfoPayload;
  onOpen: (payload: SheetMergedInfoPayload) => void;
}

export function SheetMergedInfoTriggerCell({ payload, onOpen }: SheetMergedInfoTriggerCellProps): JSX.Element {
  return (
    <DebouncedButton
      type="button"
      onClick={() => onOpen(payload)}
      className="w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-left"
      title="View merged details"
    >
      Chi tiết
    </DebouncedButton>
  );
}

interface SheetSaveButtonCellProps {
  rowIndex: number;
  onSaveRow: (index: number) => void;
}

export function SheetSaveButtonCell({ rowIndex, onSaveRow }: SheetSaveButtonCellProps): JSX.Element {
  return (
    <DebouncedButton
      type="button"
      className="h-10 w-full rounded-md bg-[var(--accent-2)] px-4 py-2 text-white"
      onClick={() => onSaveRow(rowIndex)}
    >
      Save
    </DebouncedButton>
  );
}
