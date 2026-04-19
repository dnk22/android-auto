import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";

import { useStorage } from "../hooks/useStorage";
import { useAutomationStore } from "../store/automation.store";

export function StoragePanel(): JSX.Element {
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const { files, loading, refetch, renameFile, deleteWithPolicy, isDeleting, isRenaming } = useStorage();
  const sheet = useAutomationStore((state) => state.sheet);

  const rowByVideoName = useMemo(() => {
    const map = new Map<string, (typeof sheet)[number]>();
    for (const row of sheet) {
      map.set(row.videoName, row);
    }
    return map;
  }, [sheet]);

  const onDrop = (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) {
      return;
    }
    toast.info("Backend chưa có endpoint upload. Hãy copy file vào folder storage trên server, rồi bấm Reload.");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const pending = isDeleting || isRenaming;

  return (
    <section className="card fade-in rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Storage</h2>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--ink)]"
        >
          Reload
        </button>
      </div>

      <div
        {...getRootProps()}
        className={`mb-3 cursor-pointer rounded-xl border border-dashed p-3 text-center text-xs ${
          isDragActive ? "border-[var(--accent-2)] bg-blue-50" : "border-[var(--card-border)] bg-[var(--panel-soft)]"
        }`}
      >
        <input {...getInputProps()} />
        Drag & drop files here. Upload endpoint not available yet; this panel triggers manual sync workflow.
      </div>

      <div className="max-h-56 overflow-auto rounded-xl border border-[var(--card-border)]">
        {loading ? (
          <p className="p-3 text-sm text-[var(--muted)]">Loading files...</p>
        ) : (
          <ul className="divide-y divide-[var(--card-border)]">
            {files.map((fileName) => {
              const row = rowByVideoName.get(fileName);
              const draft = renameDraft[fileName] ?? "";

              return (
                <li key={fileName} className="flex flex-col gap-2 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[var(--ink)]">{fileName}</span>
                    {row?.status === "missing_file" && (
                      <span className="rounded-full bg-[var(--chip-danger-bg)] px-2 py-1 text-[11px] text-[var(--chip-danger-fg)]">missing</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={draft}
                      onChange={(event) =>
                        setRenameDraft((state) => ({
                          ...state,
                          [fileName]: event.target.value,
                        }))
                      }
                      placeholder="new name (optional)"
                      className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1 text-xs outline-none focus:border-[var(--accent-2)]"
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void renameFile({
                          videoName: fileName,
                          newName: draft || undefined,
                        })
                      }
                      className="rounded-lg bg-[var(--accent-2)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={async () => {
                        try {
                          await deleteWithPolicy({
                            videoName: fileName,
                            rowStatus: row?.status,
                            jobId: typeof row?.meta?.jobId === "string" ? row.meta.jobId : undefined,
                          });
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Delete file failed");
                        }
                      }}
                      className="rounded-lg bg-[var(--chip-danger-fg)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
