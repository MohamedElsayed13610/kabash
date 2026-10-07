import { ar } from "@/messages/ar";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-forest text-ivory">
      <div className="text-center">
        <h1 className="font-display text-7xl">{ar.brand.name}</h1>
        <p className="mt-2 tracking-[0.3em] text-leaf">{ar.brand.latin}</p>
        <p className="mt-6 text-saffron">{ar.brand.tagline}</p>
      </div>
    </main>
  );
}
