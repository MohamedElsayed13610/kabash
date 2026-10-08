import type { Metadata } from "next";
import Link from "next/link";
import { StateScreen, primaryBtn, secondaryBtn } from "@/components/site/StateScreen";

export const metadata: Metadata = { title: "الصفحة دي مش موجودة | كباش", robots: { index: false } };

export default function NotFound() {
  return (
    <StateScreen
      eyebrow="٤٠٤"
      title="الصفحة دي مش على السفرة"
      actions={
        <>
          <Link href="/menu" className={primaryBtn}>
            شوف المنيو
          </Link>
          <Link href="/" className={secondaryBtn}>
            الرئيسية
          </Link>
        </>
      }
    >
      <p>يمكن الرابط اتغير أو اتكتب غلط. المنيو لسه مليان أكل يستاهل.</p>
    </StateScreen>
  );
}
