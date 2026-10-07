import Image from "next/image";

const BLOCKS = [
  "bg-forest text-ivory",
  "bg-ember text-ivory",
  "bg-saffron text-charcoal",
  "bg-forest-deep text-leaf",
];

/**
 * Food photo, or (until a real photo is uploaded) a color block carrying the item name
 * in the display face. Swapping in a photo only needs items.image_url to be set.
 */
export function ItemArt({
  name,
  src,
  index = 0,
  sizes = "160px",
  className = "",
}: {
  name: string;
  src: string | null;
  index?: number;
  sizes?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={src} alt={name} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`relative grid place-items-center overflow-hidden p-3 text-center ${BLOCKS[index % BLOCKS.length]} ${className}`}
      role="img"
      aria-label={name}
    >
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full opacity-[0.14]">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 2.5" />
      </svg>
      <span className="relative font-display text-xl leading-tight">{name}</span>
    </div>
  );
}
