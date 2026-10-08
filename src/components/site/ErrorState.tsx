"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useContact } from "./ContactProvider";
import { StateScreen, primaryBtn, secondaryBtn } from "./StateScreen";

/** Server error screen: honest, calm, with a way forward (retry, home, or talk to a person). */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const contact = useContact();
  useEffect(() => {
    console.error(error);
  }, [error]);

  const canCall = !!contact && /^\d+$/.test(contact.phone);
  const canWhatsapp = !!contact && /^\d+$/.test(contact.whatsapp);

  return (
    <StateScreen
      eyebrow="أوه!"
      title="الصينية وقعت مننا"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryBtn}>
            جرّب تاني
          </button>
          <Link href="/" className={secondaryBtn}>
            الرئيسية
          </Link>
        </>
      }
    >
      <p>حصلت مشكلة عندنا، مش عندك. لو كنت بتبعت طلب، شوف «تتبع طلبك» قبل ما تبعته تاني.</p>
      {(canCall || canWhatsapp) && (
        <p className="mt-3 text-base">
          محتاج حاجة دلوقتي؟{" "}
          {canCall && (
            <a href={`tel:${contact!.phone}`} className="inline-flex min-h-11 items-center font-medium text-forest underline">
              كلمنا
            </a>
          )}
          {canCall && canWhatsapp && " أو "}
          {canWhatsapp && (
            <a href={`https://wa.me/${contact!.whatsapp}`} className="inline-flex min-h-11 items-center font-medium text-forest underline">
              ابعتلنا واتساب
            </a>
          )}
        </p>
      )}
      {error.digest && (
        <p className="mt-3 text-sm text-charcoal/70" dir="ltr">
          {error.digest}
        </p>
      )}
    </StateScreen>
  );
}
