import { useState, type JSX } from "react";
import { useController } from "react-hook-form";

import type { SheetEditorTableProps } from "../../../../types/automation/editor.types";

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
