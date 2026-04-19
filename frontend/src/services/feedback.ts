import { toast } from "react-toastify";
import type { AsyncAction, ToastMessages } from "../types/common/feedback.types";

export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    error
    && typeof error === "object"
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallbackMessage;
}

export async function toastAction<T>(
  action: AsyncAction<T>,
  messages: ToastMessages,
): Promise<T> {
  return toast.promise(Promise.resolve().then(action), {
    pending: messages.pending,
    success: messages.success,
    error: {
      render({ data }) {
        return getErrorMessage(data, messages.error);
      },
    },
  });
}