import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Trash2, Upload, User, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  /** Current photo as a base64 data URL, if any. */
  value: string | null;
  /** Called whenever the user captures or uploads a new photo. */
  onChange: (next: string | null) => void;
  /** Optional label shown above the frame (e.g. "Profile Photo"). */
  label?: string;
  /** Maximum allowed file size in MB for uploaded files. */
  maxSizeMb?: number;
};

/**
 * Single-photo capture / upload component used for customer profile photos.
 * Supports two acquisition modes:
 *   1. Upload a file from disk (drag-and-click input).
 *   2. Stream the device camera via `navigator.mediaDevices.getUserMedia` and
 *      take a snapshot, which is encoded to a JPEG data URL via canvas.
 *
 * Camera streams are always stopped on unmount and when the user cancels or
 * switches back to the still preview, so device indicators do not stay lit.
 */
export default function PhotoCapture({
  value,
  onChange,
  label = "Profile Photo",
  maxSizeMb = 5,
}: Props) {
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup on unmount — never leak the camera.
  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      // Wait for the next paint so the <video> element exists in the DOM.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            /* autoplay blocked is fine; user can click play */
          });
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[PhotoCapture] getUserMedia failed", err);
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow access and try again."
          : "Could not start the camera. Try uploading a photo instead.";
      setStreamError(message);
      toast.error(message);
    }
  };

  const cancelCamera = () => {
    stopStream();
    setMode("idle");
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
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
    onChange(dataUrl);
    cancelCamera();
    toast.success("Photo captured");
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG / PNG / WebP).");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Image is larger than ${maxSizeMb}MB. Choose a smaller one.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
        toast.success("Photo uploaded");
      }
    };
    reader.onerror = () => toast.error("Failed to read the image file.");
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-main)" }}
      >
        {label}
      </div>

      <div
        className="flex items-start gap-4 rounded-xl border bg-white p-4"
        style={{ borderColor: "rgba(74,111,165,0.15)" }}
      >
        {/* Frame: still preview OR live camera */}
        <div
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-2"
          style={{
            backgroundColor: "rgba(191,221,245,0.25)",
            // @ts-expect-error CSS var
            "--tw-ring-color": "var(--brand-light)",
          }}
        >
          {mode === "camera" ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-label="Camera preview"
            />
          ) : value ? (
            <img
              src={value}
              alt="Customer profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ color: "var(--text-muted)" }}
            >
              <User size={36} />
            </div>
          )}
        </div>

        {/* Action stack */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {mode === "camera" ? (
            <>
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Position the customer in the frame and tap Capture.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={captureSnapshot}
                  className="h-9 px-3 text-xs font-semibold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
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
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {value
                  ? "Photo on file. Replace it by uploading a new one or retaking with the camera."
                  : "Upload a clear, well-lit photo or take one with the device camera."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3 text-xs"
                  style={{
                    borderColor: "rgba(74,111,165,0.25)",
                    color: "var(--text-main)",
                  }}
                >
                  <Upload size={14} className="mr-1.5" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startCamera()}
                  className="h-9 px-3 text-xs"
                  style={{
                    borderColor: "rgba(74,111,165,0.25)",
                    color: "var(--text-main)",
                  }}
                >
                  <Camera size={14} className="mr-1.5" />
                  {value ? "Retake" : "Use Camera"}
                </Button>
                {value ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={removePhoto}
                    className="h-9 px-3 text-xs"
                    style={{
                      borderColor: "rgba(220,38,38,0.30)",
                      color: "#B91C1C",
                    }}
                    aria-label="Remove photo"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Remove
                  </Button>
                ) : null}
                {streamError ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void startCamera()}
                    className="h-9 px-3 text-xs"
                    style={{
                      borderColor: "rgba(234,179,8,0.40)",
                      color: "#A16207",
                    }}
                  >
                    <RotateCcw size={14} className="mr-1.5" />
                    Retry camera
                  </Button>
                ) : null}
              </div>
              {streamError ? (
                <p className="text-[11px]" style={{ color: "#B91C1C" }}>
                  {streamError}
                </p>
              ) : null}
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            // Allow selecting the same file again later.
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
