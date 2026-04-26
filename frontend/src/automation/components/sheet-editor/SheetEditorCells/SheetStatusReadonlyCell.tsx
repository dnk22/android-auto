import type { JSX } from "react";

import type { SheetStatus } from "../../../types/sheetStatus.types";
import {
  getSheetStatusLabelVi,
  getSheetStatusToneClasses,
} from "../../../utils/constants/sheetStatus.constants";

interface SheetStatusReadonlyCellProps {
  status: SheetStatus;
}

export function SheetStatusReadonlyCell({
  status,
}: SheetStatusReadonlyCellProps): JSX.Element {
  const toneClasses = getSheetStatusToneClasses(status);

  return (
    <div
      className={`inline-flex min-w-[96px] items-center justify-center rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${toneClasses}`}
    >
      {getSheetStatusLabelVi(status)}
    </div>
  );
}
