export interface ToastMessages {
  pending: string;
  success: string;
  error: string;
}

export type AsyncAction<T = unknown> = () => Promise<T>;
