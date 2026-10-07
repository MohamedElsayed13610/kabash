import { CartProvider } from "@/components/cart/CartProvider";
import { BottomNav } from "@/components/site/BottomNav";
import { CartBar } from "@/components/site/CartBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))]">{children}</div>
      <CartBar />
      <BottomNav />
    </CartProvider>
  );
}
