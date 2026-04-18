import type { StreamStatus } from "./device";

export interface StreamResponse {
  wsUrl: string;
  status: StreamStatus;
}
