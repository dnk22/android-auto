import { apiClient } from "../../api/client";
import type {
  RenameFilePayload,
  SheetResponse,
  StorageListResponse,
  UpdateRowPayload,
} from "../types/automation.types";

export async function getSheet(): Promise<SheetResponse> {
  const response = await apiClient.get<SheetResponse>("/automation/sheet");
  return response.data;
}

export async function updateRow(videoId: string, payload: UpdateRowPayload): Promise<void> {
  await apiClient.patch(`/automation/sheet/${encodeURIComponent(videoId)}`, payload);
}

export async function setReady(videoId: string): Promise<void> {
  await apiClient.post(`/automation/sheet/${encodeURIComponent(videoId)}/ready`);
}

export async function stopJob(jobId: string): Promise<void> {
  await apiClient.post(`/automation/job/${encodeURIComponent(jobId)}/stop`);
}

export async function getStorage(): Promise<StorageListResponse> {
  const response = await apiClient.get<StorageListResponse>("/automation/storage");
  return response.data;
}

export async function renameFile(payload: RenameFilePayload): Promise<void> {
  await apiClient.post("/automation/storage/rename", payload);
}

export async function deleteFile(videoName: string): Promise<void> {
  await apiClient.delete(`/automation/storage/${encodeURIComponent(videoName)}`);
}
