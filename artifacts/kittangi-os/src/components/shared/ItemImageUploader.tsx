import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  /** Captured / uploaded photos for this pledged item, as base64 data URLs. */
  value: string[];
  /** Called whenever the photo list changes. */
  onChange: (next: string[]) => void;
  /** Maximum allowed number of photos. */
  max?: number;
  /** Maximum allowed file size in MB per photo. */
  maxSizeMb?: number;
};

/**
 * Multi-photo capture / drag-and-drop component for jewel / gold items being
 * pledged in `PawnOrigination`. Combines:
 *   - Drag-and-drop OR file-picker for one-or-many image files.
 *   - Inline device camera capture for branches that need to photograph the
 *     item on the counter.
 *
 * IMPORTANT: The photos collected here are intentionally surfaced via the
 * `onChange` callback so that the submitting screen (PawnOrigination) can pass
 * them straight into the Pledged Inventory store. Once a pawn ticket is
 * generated they appear automatically in the Pledged Inventory gallery and
 * its "Manage Item" modal — there is no separate upload step.
 */
export default function ItemImageUploader({
  value,
  onChange,
  max = 6,
  maxSizeMb = 5,
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopStream(), []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const remainingSlots = Math.max(0, max - value.length);

  const acceptFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const slots = remainingSlots;
    if (slots <= 0) {
      toast.error(`You can attach at most ${max} photos.`);
      return;
    }
    const accepted = arr.slice(0, slots).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" is not an image.`);
        return false;
      }
      if (f.size > maxSizeMb * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds ${maxSizeMb}MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    Promise.all(
      accepted.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(
                typeof reader.result === "string" ? reader.result : null,
              );
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((results) => {
      const ok = results.filter((s): s is string => Boolean(s));
      if (ok.length === 0) {
        toast.error("Could not read the selected images.");
        return;
      }
      onChange([...value, ...ok]);
      toast.success(
        ok.length === 1 ? "1 photo added" : `${ok.length} photos added`,
      );
    });
  };

  const startCamera = async () => {
    setStreamError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStreamError("Camera API not available in this browser.");
      toast.error("Camera not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1024, height: 768 },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[ItemImageUploader] getUserMedia failed", err);
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied."
          : "Could not start the camera.";
      setStreamError(message);
      toast.error(message);
    }
  };

  const cancelCamera = () => {
    stopStream();
    setMode("idle");
  };

  const captureSnapshot = () => {
    if (remainingSlots <= 0) {
      toast.error(`You can attach at most ${max} photos.`);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1024;
    const h = video.videoHeight || 768;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Could not capture photo.");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onChange([...value, dataUrl]);
    toast.success("Item photo captured");
    if (remainingSlots - 1 <= 0) cancelCamera();
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      {mode === "camera" ? (
        <div
          className="relative overflow-hidden rounded-xl border bg-black"
          style={{ borderColor: "rgba(74,111,165,0.30)" }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full object-cover"
            aria-label="Item camera preview"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Frame the jewel item clearly. {remainingSlots} of {max} slots left.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={captureSnapshot}
                className="h-9 px-3 text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
                disabled={remainingSlots <= 0}
              >
                <Camera size={14} className="mr-1.5" />
                Capture
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancelCamera}
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "var(--text-main)",
                }}
              >
                <X size={14} className="mr-1.5" />
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOver(true);
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsOver(false);
            if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
          }}
          className="rounded-xl border-2 border-dashed px-5 py-7 transition-colors"
          style={{
            borderColor: isOver
              ? "var(--brand-primary)"
              : "rgba(74,111,165,0.25)",
            backgroundColor: isOver
              ? "rgba(74,111,165,0.06)"
              : "rgba(233,244,251,0.45)",
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--brand-light)" }}
            >
              <ImagePlus
                size={20}
                style={{ color: "var(--brand-primary)" }}
              />
            </div>
            <div className="text-sm">
              <span
                className="font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                Drag &amp; drop item photos here
              </span>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                or use the buttons below
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              JPG / PNG / WebP · up to {maxSizeMb}MB each · {value.length} of{" "}
              {max} attached
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "var(--text-main)",
                }}
                disabled={remainingSlots <= 0}
              >
                <Upload size={14} className="mr-1.5" />
                Choose files
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void startCamera()}
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "var(--brand-primary)",
                }}
                disabled={remainingSlots <= 0}
              >
                <Camera size={14} className="mr-1.5" />
                Open camera
              </Button>
            </div>
            {streamError ? (
              <p className="text-[11px]" style={{ color: "#B91C1C" }}>
                {streamError}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Thumbnail tray */}
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((src, i) => (
            <div
              key={`${i}-${src.slice(-12)}`}
              className="group relative overflow-hidden rounded-lg border bg-white"
              style={{ borderColor: "rgba(74,111,165,0.18)" }}
            >
              <img
                src={src}
                alt={`Item photo ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition-opacity hover:bg-white"
              >
                <Trash2 size={13} style={{ color: "#B91C1C" }} />
              </button>
              <div
                className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white"
              >
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) acceptFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
