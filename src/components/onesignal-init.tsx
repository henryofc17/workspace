"use client";

import { useEffect } from "react";

const ONESIGNAL_APP_ID = "dbf86cd4-09f0-4ec9-b25e-44639badfbb1";

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Prevent double init
    const TAG = "[OneSignal]";
    if (window.__oneSignalInitialized) return;
    window.__oneSignalInitialized = true;

    console.log(`${TAG} Starting initialization...`);

    // Load the SDK first, then init after it's ready
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      console.log(`${TAG} SDK script loaded, calling init...`);

      try {
        window.OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: {
            enable: true,
          },
          promptOptions: {
            slidedown: {
              enabled: true,
              autoPrompt: true,
              timeDelay: 5,
              pageViews: 1,
            },
          },
          allowLocalhostAsSecureOrigin: false,
          serviceWorkerParam: {
            scope: "/",
          },
          serviceWorkerPath: "OneSignalSDKWorker.js",
        });

        console.log(`${TAG} init() called successfully`);

        // Verify subscription after a delay
        setTimeout(async () => {
          try {
            const permission = await window.OneSignal.Notifications.permissionNative;
            console.log(`${TAG} Notification permission:`, permission);
          } catch (e) {
            console.warn(`${TAG} Could not check permission:`, e);
          }
        }, 6000);

      } catch (err) {
        console.error(`${TAG} init() failed:`, err);
      }
    };

    script.onerror = (err) => {
      console.error(`${TAG} Failed to load SDK script:`, err);
      window.__oneSignalInitialized = false; // Allow retry
    };
  }, []);

  return null;
}
