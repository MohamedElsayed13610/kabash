"use client";

import { createContext, useContext } from "react";

export interface Contact {
  phone: string;
  whatsapp: string;
}

const ContactContext = createContext<Contact | null>(null);

/** Lets client-side error screens offer a call or WhatsApp link without fetching anything while things are broken. */
export function ContactProvider({ contact, children }: { contact: Contact; children: React.ReactNode }) {
  return <ContactContext.Provider value={contact}>{children}</ContactContext.Provider>;
}

export const useContact = () => useContext(ContactContext);
