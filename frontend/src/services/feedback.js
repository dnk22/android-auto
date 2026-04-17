import { toast } from "react-toastify";

export function getErrorMessage(error, fallbackMessage) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object" && typeof error.message === "string") {
    return error.message;
  }

  return fallbackMessage;
}

export async function toastAction(action, messages) {
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