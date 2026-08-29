"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

type SettingsDialogContextValue = {
  openSettings: () => void;
};

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export function useSettingsDialog(): SettingsDialogContextValue {
  const context = useContext(SettingsDialogContext);
  if (!context) {
    throw new Error("useSettingsDialog must be used within SettingsDialogProvider");
  }
  return context;
}

/**
 * Task 4: Settings is an overlay, not a route — user-menu.tsx and
 * mobile-nav.tsx both need to open the same dialog. A Base UI Menu.Item
 * unmounts DropdownMenuContent (and anything rendered inside it) the moment
 * it's clicked, so a Dialog nested inside the menu would be torn down in
 * the same tick it opens. Hoisting the dialog above both consumers — one
 * shared `open` state here — is what lets it survive the menu closing, and
 * gives both entry points one dialog instead of two.
 */
export function SettingsDialogProvider({
  lang,
  dict,
  email,
  passwordSet,
  children,
}: {
  lang: Locale;
  dict: Dictionary;
  email: string | null;
  passwordSet: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openSettings = useCallback(() => setOpen(true), []);

  return (
    <SettingsDialogContext.Provider value={{ openSettings }}>
      {children}
      <SettingsDialog open={open} onOpenChange={setOpen} lang={lang} dict={dict} email={email} passwordSet={passwordSet} />
    </SettingsDialogContext.Provider>
  );
}
