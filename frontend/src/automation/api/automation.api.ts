import type {
  CreateVideoFolderPayload,
  CreateVideoFolderResponse,
  OpenVideoFolderResponse,
  RenameFilePayload,
  SessionState,
  SheetRow,
  SheetResponse,
  StorageListResponse,
  UpdateSessionPayload,
  UpdateRowPayload,
} from "../types/automation.types";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000") as string;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getSheet(): Promise<SheetResponse> {
  return requestJson<SheetResponse>("/automation/sheet");
}

export async function updateRow(videoId: string, payload: UpdateRowPayload): Promise<void> {
  await requestJson<void>(`/automation/sheet/${encodeURIComponent(videoId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setReady(videoId: string): Promise<void> {
  await requestJson<void>(`/automation/sheet/${encodeURIComponent(videoId)}/ready`, {
    method: "POST",
  });
}

export async function deleteSheetByVideoName(videoName: string): Promise<void> {
  await requestJson<void>(`/automation/sheet/by-video-name/${encodeURIComponent(videoName)}`, {
    method: "DELETE",
  });
}

export async function saveSheetRows(rows: SheetRow[]): Promise<SheetResponse> {
  return requestJson<SheetResponse>("/automation/sheet", {
    method: "PUT",
    body: JSON.stringify({ rows }),
  });
}

export async function getSession(): Promise<SessionState> {
  return requestJson<SessionState>("/automation/session");
}

export async function updateSession(payload: UpdateSessionPayload): Promise<SessionState> {
  return requestJson<SessionState>("/automation/session", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createVideoFolder(
  payload: CreateVideoFolderPayload,
): Promise<CreateVideoFolderResponse> {
  return requestJson<CreateVideoFolderResponse>("/storage/createVideoFolder", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStorage(): Promise<StorageListResponse> {
  return requestJson<StorageListResponse>("/automation/storage");
}

export async function renameFile(payload: RenameFilePayload): Promise<void> {
  await requestJson<void>("/automation/storage/rename", {
    method: "POST",
    body: JSON.stringify({
      videoName: payload.videoName,
      newName: payload.newName,
    }),
  });
}

export async function deleteFile(videoName: string): Promise<void> {
  await requestJson<void>(`/automation/storage/${encodeURIComponent(videoName)}`, {
    method: "DELETE",
  });
}

export async function openStorageFolder(): Promise<OpenVideoFolderResponse> {
  return requestJson<OpenVideoFolderResponse>("/automation/storage/open-folder", {
    method: "POST",
  });
}

export async function stopJob(jobId: string): Promise<void> {
  await requestJson<void>(`/automation/job/${encodeURIComponent(jobId)}/stop`, {
    method: "POST",
  });
}
