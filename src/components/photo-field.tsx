"use client";

import { useRef, useState } from "react";
import { AVATAR_TYPES } from "@/lib/profile-options";

const MAX_SIDE = 800;

// Shrinks a photo in the browser before it is uploaded, so phone photos (often 3-8 MB)
// become roughly 100-300 KB. Falls back to the original file if anything goes wrong;
// the server then checks the size and type again.
async function shrink(file: File): Promise<File> {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff"; // transparent PNGs become white, not black
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function PhotoField({
  currentUrl,
  error,
}: {
  currentUrl: string | null;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const shown = remove ? null : (preview ?? currentUrl);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    if (!picked) return;
    const smaller = await shrink(picked);
    const transfer = new DataTransfer();
    transfer.items.add(smaller);
    input.files = transfer.files;
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(smaller);
    });
    setRemove(false);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-3xl text-zinc-500 dark:bg-zinc-800">
        {shown ? (
          // A plain <img>: the address is a short-lived signed link, not a fixed image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Your profile photo" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">🙂</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id="avatar"
          name="avatar"
          type="file"
          accept={AVATAR_TYPES.join(",")}
          onChange={onPick}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-10 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {shown ? "Change photo" : "Add a photo"}
        </button>
        {(currentUrl || preview) && !remove && (
          <button
            type="button"
            onClick={() => {
              setRemove(true);
              setPreview(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-left text-sm text-zinc-500 underline"
          >
            Remove photo
          </button>
        )}
        {remove && <input type="hidden" name="remove_avatar" value="on" />}
        <p className="text-xs text-zinc-500">Optional. JPEG, PNG or WebP.</p>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
