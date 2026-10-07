import { CartProvider } from "@/components/cart/CartProvider";
import { BottomNav } from "@/components/site/BottomNav";
import { CartBar } from "@/components/site/CartBar";
import { getSettings } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { announcement_ar } = await getSettings();
  return (
    <CartProvider>
      {announcement_ar?.trim() && (
        <div role="status" className="bg-saffron px-4 py-2 text-center font-medium text-charcoal">
          {announcement_ar}
        </div>
      )}
      <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))]">{children}</div>
      <CartBar />
      <BottomNav />
    </CartProvider>
  );
}
