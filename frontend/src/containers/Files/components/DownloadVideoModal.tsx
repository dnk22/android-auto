import { useEffect, useState } from "react";

import DebouncedButton from "../../../components/common/DebouncedButton";

type DownloadVideoModalProps = {
  isOpen: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (url: string) => void;
};

export function DownloadVideoModal({
  isOpen,
  pending = false,
  onCancel,
  onConfirm,
}: DownloadVideoModalProps): JSX.Element | null {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setUrl("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-xl rounded-2xl p-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">
          Tải video từ URL
        </h3>

        <input
          id="download-video-url"
          autoFocus
          type="url"
          value={url}
          disabled={pending}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
          placeholder="https://www.tiktok.com/..."
          className="mt-2 w-full rounded-lg border text-black placeholder:text-[var(--muted)] border-[var(--card-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-70"
        />
        {pending ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Đang tải video, vui lòng chờ...
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <DebouncedButton
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-[var(--card-border)] px-8 py-4 text-sm text-[var(--ink)] disabled:opacity-60"
          >
            Hủy
          </DebouncedButton>
          <DebouncedButton
            type="button"
            onClick={() => {
              onConfirm(url);
            }}
            disabled={pending}
            className="rounded-lg bg-[var(--chip-success-bg)] px-8 py-4 text-sm font-semibold text-[var(--chip-success-fg)] disabled:opacity-60"
          >
            {pending ? "Đang tải..." : "Ok"}
          </DebouncedButton>
        </div>
      </div>
    </div>
  );
}
