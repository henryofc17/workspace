"use client";

import { useEffect } from "react";

const ONESIGNAL_APP_ID = "dbf86cd4-09f0-4ec9-b25e-44639badfbb1";

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const TAG = "[OneSignal]";

    // Prevent double init
    if ((window as unknown as Record<string, boolean>).__os_init) return;
    (window as unknown as Record<string, boolean>).__os_init = true;

    // Set up the OneSignalDeferred proxy queue BEFORE loading the SDK.
    // This ensures that any calls made between now and SDK load are queued
    // and replayed once the real OneSignal object is available.
    const proxyQueue: Array<() => void> = [];
    const proxyHandler: ProxyHandler<unknown> = {
      get(_target, prop) {
        if (prop === "push") {
          return (fn: () => void) => {
            proxyQueue.push(fn);
          };
        }
        return (...args: unknown[]) => {
          proxyQueue.push(() => {
            const real = window.OneSignal;
            if (real && typeof (real as Record<string, unknown>)[prop as string] === "function") {
              return (real as Record<string, unknown>)[prop as string](...args);
            }
          });
        };
      },
      set(_target, prop, value) {
        proxyQueue.push(() => {
          const real = window.OneSignal;
          if (real) {
            (real as Record<string, unknown>)[prop as string] = value;
          }
        });
        return true;
      },
    };

    // Only set the proxy if OneSignal is not already defined by the SDK
    if (!window.OneSignal) {
      window.OneSignal = new Proxy({}, proxyHandler) as unknown as typeof window.OneSignal;
    }

    // Load the SDK as an external script (NOT inline) from the allowed CDN origin
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;

    script.onload = () => {
      console.log(`${TAG} SDK loaded from CDN`);

      // Small delay to let the SDK fully initialize its internal state
      setTimeout(() => {
        try {
          const os = window.OneSignal;
          if (!os || typeof os.init !== "function") {
            console.error(`${TAG} OneSignal.init is not available after SDK load`);
            return;
          }

          os.init({
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

          console.log(`${TAG} init() called`);

          // Log permission status after slidedown should have appeared
          setTimeout(async () => {
            try {
              if (os.Notifications) {
                const perm = await os.Notifications.permissionNative;
                console.log(`${TAG} Permission:`, perm);
              }
            } catch (e) {
              console.warn(`${TAG} Could not read permission`, e);
            }
          }, 7000);
        } catch (err) {
          console.error(`${TAG} init() error:`, err);
          (window as unknown as Record<string, boolean>).__os_init = false;
        }
      }, 100);
    };

    script.onerror = () => {
      console.error(`${TAG} Failed to load SDK script`);
      (window as unknown as Record<string, boolean>).__os_init = false;
    };

    document.head.appendChild(script);
  }, []);

  return null;
}
