import { useEffect, useRef, useState } from "react";

import { fetchThumbImage } from "../services/mediaStream.js";

const THUMB_POLL_MS = 5000;

export default function ThumbPollingImage({ serial, className = "" }) {
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const imageUrlRef = useRef("");

  useEffect(() => {
    if (!serial) {
      setImageUrl("");
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;
    let timerId;
    let currentController;

    const updateImage = (nextBlob) => {
      const nextUrl = URL.createObjectURL(nextBlob);
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
      imageUrlRef.current = nextUrl;
      setImageUrl(nextUrl);
    };

    const pollOnce = async () => {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      try {
        setStatus((previous) => (previous === "ready" ? previous : "loading"));
        const blob = await fetchThumbImage(serial, { signal: controller.signal });

        if (cancelled) {
          return;
        }

        updateImage(blob);
        setStatus("ready");
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        if (!cancelled) {
          setStatus("error");
        }
      }
    };

    void pollOnce();
    timerId = setInterval(() => {
      void pollOnce();
    }, THUMB_POLL_MS);

    return () => {
      cancelled = true;
      if (timerId) {
        clearInterval(timerId);
      }
      currentController?.abort();
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = "";
      }
    };
  }, [serial]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`Thumbnail ${serial}`}
        className={className}
        draggable={false}
      />
    );
  }

  if (status === "error") {
    return (
      <div className={`flex items-center justify-center text-[9px] text-slate-300 ${className}`}>
        Thumb lỗi
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center text-[9px] text-slate-300 ${className}`}>
      Đang tải...
    </div>
  );
}
