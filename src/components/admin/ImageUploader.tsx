"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { btn } from "./ui";

const BUCKET = "menu";
const MAX_FILE_MB = 15;
const PREVIEW_W = 300;

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Folder inside the bucket, e.g. "items" or "offers". */
  folder: string;
  /** width / height of the saved image. 1 = square (items), 16/9 = banners. */
  aspect?: number;
  /** Width in px of the saved image. Height follows from the aspect. */
  outputWidth?: number;
  label: string;
}

const publicUrlToPath = (url: string) => url.split(`/storage/v1/object/public/${BUCKET}/`)[1];

/** Removes a file this form uploaded but that never got saved (cancelled editor, replaced photo). */
export async function discardUpload(url: string | null | undefined) {
  if (!url) return;
  const path = publicUrlToPath(url);
  if (path) await createSupabaseBrowser().storage.from(BUCKET).remove([path]).catch(() => {});
}

export function ImageUploader({ value, onChange, folder, aspect = 1, outputWidth = 1000, label }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image centre offset from box centre, in preview px
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const uploadedHere = useRef<string | null>(null);

  const boxW = PREVIEW_W;
  const boxH = Math.round(PREVIEW_W / aspect);

  // scale that makes the image just cover the box, times the user's zoom
  const scaleFor = (b: ImageBitmap, z: number) => Math.max(boxW / b.width, boxH / b.height) * z;
  const clamp = (b: ImageBitmap, z: number, p: { x: number; y: number }) => {
    const s = scaleFor(b, z);
    const maxX = Math.max(0, (b.width * s - boxW) / 2);
    const maxY = Math.max(0, (b.height * s - boxH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c || !bitmap) return;
    const ctx = c.getContext("2d")!;
    const s = scaleFor(bitmap, zoom);
    ctx.clearRect(0, 0, boxW, boxH);
    ctx.drawImage(bitmap, boxW / 2 + pos.x - (bitmap.width * s) / 2, boxH / 2 + pos.y - (bitmap.height * s) / 2, bitmap.width * s, bitmap.height * s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, zoom, pos]);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("اختار صورة (JPG أو PNG أو WebP).");
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setError(`الصورة كبيرة أوي. الحد ${MAX_FILE_MB} ميجا.`);
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" }); // respects phone rotation
      setBitmap(b);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    } catch {
      setError("مقدرناش نفتح الصورة دي. جرب صورة تانية.");
    }
  }

  async function confirm() {
    if (!bitmap) return;
    setBusy(true);
    setError(null);
    try {
      const outW = outputWidth;
      const outH = Math.round(outputWidth / aspect);
      const k = outW / boxW; // preview px -> output px
      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      const s = scaleFor(bitmap, zoom) * k;
      ctx.drawImage(bitmap, outW / 2 + pos.x * k - (bitmap.width * s) / 2, outH / 2 + pos.y * k - (bitmap.height * s) / 2, bitmap.width * s, bitmap.height * s);

      let blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/webp", 0.82));
      if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.85)); // old Safari
      if (!blob) throw new Error("encode");

      setPreview(URL.createObjectURL(blob)); // instant preview while it uploads
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const supabase = createSupabaseBrowser();
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

      if (uploadedHere.current) await discardUpload(uploadedHere.current); // replaced a photo that was never saved
      uploadedHere.current = data.publicUrl;
      onChange(data.publicUrl);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return null; // from now on show the real stored photo
      });
      setBitmap(null);
    } catch (e) {
      setPreview(null);
      setError(/row-level|policy|403/i.test(String((e as Error).message)) ? "مفيش عندك صلاحية ترفع صور." : "مقدرناش نرفع الصورة. اتأكد من النت وجرب تاني.");
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? value;

  return (
    <div>
      <p className="mb-1 block font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-charcoal/10 text-sm text-charcoal/50"
          style={{ width: 96, height: Math.round(96 / aspect) }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            "مفيش صورة"
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} className={btn.ghost}>
            {shown ? "غيّر الصورة" : "اختار صورة"}
          </button>
          {shown && (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
              className="h-12 px-3 text-ember underline"
            >
              شيل
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-ember">
          {error}
        </p>
      )}

      <BottomSheet open={!!bitmap} onClose={() => !busy && setBitmap(null)} label="اقص الصورة">
        <div className="px-5 pb-4">
          <h3 className="font-display text-3xl text-forest">اقص الصورة</h3>
          <p className="text-sm text-charcoal/70">اسحب الصورة عشان تظبطها، وكبّر بالشريط.</p>
          <div
            data-testid="crop-box"
            className="relative mx-auto mt-3 touch-none overflow-hidden rounded-xl bg-charcoal/10 ring-2 ring-forest"
            style={{ width: boxW, height: boxH }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current || !bitmap) return;
              setPos(clamp(bitmap, zoom, { x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
            }}
            onPointerUp={() => (drag.current = null)}
            onWheel={(e) => bitmap && setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY / 500)))}
          >
            <canvas ref={canvas} width={boxW} height={boxH} className="size-full" />
          </div>
          <label className="mx-auto mt-3 flex max-w-xs items-center gap-3">
            <span className="text-sm">تكبير</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(z);
                if (bitmap) setPos((p) => clamp(bitmap, z, p));
              }}
              className="h-11 flex-1 accent-forest"
              aria-label="تكبير الصورة"
            />
          </label>
          <div className="mt-4 flex gap-3">
            <button type="button" disabled={busy} onClick={confirm} className={`${btn.primary} flex-1`}>
              {busy ? "بنرفع…" : "تمام، ارفع الصورة"}
            </button>
            <button type="button" disabled={busy} onClick={() => setBitmap(null)} className={btn.ghost}>
              رجوع
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
