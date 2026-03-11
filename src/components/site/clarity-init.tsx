"use client";

import { useEffect } from "react";
import Clarity from "@microsoft/clarity";

type ClarityConsentV2 = {
  ad_Storage: "granted" | "denied";
  analytics_Storage: "granted" | "denied";
};

type CookieConsentPalette = {
  popup?: {
    background?: string;
    text?: string;
  };
  button?: {
    background?: string;
    text?: string;
  };
};

type CookieConsentPopup = {
  destroy: () => void;
  hasConsented: () => boolean;
};

type CookieConsentOptions = {
  palette?: CookieConsentPalette;
  theme?: string;
  position?: string;
  type?: "info" | "opt-in" | "opt-out";
  revokable?: boolean;
  content?: {
    message?: string;
    allow?: string;
    deny?: string;
    link?: string;
    href?: string;
    dismiss?: string;
    policy?: string;
  };
  cookie?: {
    secure?: boolean;
    path?: string;
  };
  onInitialise?: (this: CookieConsentPopup) => void;
  onStatusChange?: (this: CookieConsentPopup) => void;
  onRevokeChoice?: () => void;
};

type CookieConsentApi = {
  initialise: (
    options: CookieConsentOptions,
    complete?: (popup: CookieConsentPopup) => void,
    error?: (error: unknown, popup: CookieConsentPopup) => void,
  ) => void;
};

declare global {
  interface Window {
    cookieconsent?: CookieConsentApi;
  }
}

type ClarityInitProps = {
  projectId: string;
};

const clarityConsentGranted: ClarityConsentV2 = {
  ad_Storage: "denied",
  analytics_Storage: "granted",
};

const clarityConsentDenied: ClarityConsentV2 = {
  ad_Storage: "denied",
  analytics_Storage: "denied",
};

function applyClarityConsent(granted: boolean) {
  // Keep both consent APIs in sync while Clarity v1 and v2 are both supported.
  Clarity.consentV2(granted ? clarityConsentGranted : clarityConsentDenied);
  Clarity.consent(granted);
}

export function ClarityInit({ projectId }: ClarityInitProps) {
  useEffect(() => {
    if (!projectId) {
      return;
    }

    Clarity.init(projectId);
    applyClarityConsent(false);

    let isActive = true;
    let popup: CookieConsentPopup | undefined;

    const initCookieConsent = async () => {
      try {
        await import("cookieconsent/build/cookieconsent.min.js");

        if (!isActive || typeof window === "undefined" || !window.cookieconsent) {
          return;
        }

        window.cookieconsent.initialise(
          {
            theme: "classic",
            position: "bottom",
            type: "opt-in",
            revokable: true,
            palette: {
              popup: {
                background: "#101f31",
                text: "#f4f8ff",
              },
              button: {
                background: "#ff8b2b",
                text: "#0b1420",
              },
            },
            content: {
              message: "We use analytics cookies to improve site performance.",
              allow: "Accept analytics cookies",
              deny: "Reject non-essential cookies",
              link: "Privacy policy",
              href: "/privacy-policy",
              dismiss: "Close",
              policy: "Cookie preferences",
            },
            cookie: {
              secure: true,
              path: "/",
            },
            onInitialise: function onInitialise() {
              applyClarityConsent(this.hasConsented());
            },
            onStatusChange: function onStatusChange() {
              applyClarityConsent(this.hasConsented());
            },
            onRevokeChoice: function onRevokeChoice() {
              applyClarityConsent(false);
            },
          },
          (instance) => {
            popup = instance;
          },
        );
      } catch {
        applyClarityConsent(false);
      }
    };

    void initCookieConsent();

    return () => {
      isActive = false;
      popup?.destroy();
    };
  }, [projectId]);

  return null;
}
