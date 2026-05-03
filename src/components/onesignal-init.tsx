"use client";

import { useEffect } from "react";

const ONESIGNAL_APP_ID = "dbf86cd4-09f0-4ec9-b25e-44639badfbb1";

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Avoid re-initializing if already loaded
    if (window.OneSignal) return;

    const init = async () => {
      try {
        window.OneSignal = window.OneSignal || [];
        window.OneSignal.push(function () {
          window.OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            notifyButton: {
              enable: false,
            },
            allowLocalhostAsSecureOrigin: false,
            serviceWorkerParam: {
              scope: "/",
            },
            serviceWorkerPath: "OneSignalSDKWorker.js",
            promptOptions: {
              slidedown: {
                prompts: [
                  {
                    type: "push",
                    autoPrompt: true,
                    text: {
                      actionMessage: "Queremos enviarte notificaciones importantes.",
                      acceptButton: "Permitir",
                      cancelButton: "No, gracias",
                      explanationMessage:
                        "Recibe alertas de créditos, nuevas cookies y más.",
                    },
                    delay: {
                      pageViews: 1,
                      timeDelay: 5,
                    },
                  },
                ],
              },
            },
          });
        });

        // Load the SDK
        const script = document.createElement("script");
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        script.onload = () => {
          console.log("[OneSignal] SDK loaded successfully");
        };

        script.onerror = () => {
          console.warn("[OneSignal] Failed to load SDK");
        };
      } catch (err) {
        console.warn("[OneSignal] Initialization failed:", err);
      }
    };

    init();
  }, []);

  return null;
}
