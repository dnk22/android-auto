import type { JSX } from "react";

import DebouncedButton from "../../../../components/common/DebouncedButton";
import type { SheetMergedInfoPayload } from "../../../hooks/useSheetMergedInfoModal";

interface SheetMergedInfoTriggerCellProps {
  payload: SheetMergedInfoPayload;
  onOpen: (payload: SheetMergedInfoPayload) => void;
}

export function SheetMergedInfoTriggerCell({
  payload,
  onOpen,
}: SheetMergedInfoTriggerCellProps): JSX.Element {
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
