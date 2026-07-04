import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cookie Checker Pro",
  description:
    "Herramienta de verificacion de cookies y generacion de tokens de acceso.",
  keywords: [
    "Cookie Checker",
    "NFToken",
    "Account Checker",
  ],

  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },

  openGraph: {
    title: "Cookie Checker Pro",
    description:
      "Herramienta de verificacion de cookies y generacion de tokens de acceso.",
    images: ["/logo.svg"],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Cookie Checker Pro",
    description:
      "Herramienta de verificacion de cookies y generacion de tokens de acceso.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141414] text-white flex flex-col min-h-screen`}
      >
        <div className="flex-1">{children}</div>

        {/* Footer con aviso legal */}
        <footer className="w-full border-t border-white/[0.04] bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <p className="text-white/15 text-[10px] leading-relaxed text-center">
              Aviso Legal: Este sitio web no esta afiliado, asociado, respaldado ni conectado oficialmente de ninguna manera con ningun servicio de streaming ni ninguna de sus filiales o marcas registradas. Todas las marcas comerciales mencionadas pertenecen a sus respectivos propietarios.
            </p>
          </div>
        </footer>

        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: "#1F1F1F",
              border: "1px solid #333",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}