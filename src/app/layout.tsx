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
  title: "Netflix Cookie Checker Pro",
  description:
    "Verifica cookies de Netflix, genera NFTokens y extrae metadatos de cuenta.",
  keywords: [
    "Netflix",
    "Cookie Checker",
    "NFToken",
    "Netflix Account Checker",
  ],

  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },

  openGraph: {
    title: "Netflix Cookie Checker Pro",
    description:
      "Verifica cookies de Netflix, genera NFTokens y extrae metadatos de cuenta.",
    images: ["/logo.svg"],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Netflix Cookie Checker Pro",
    description:
      "Verifica cookies de Netflix, genera NFTokens y extrae metadatos de cuenta.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#141414] text-white overflow-x-hidden`}
      >
        {children}

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
