import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n";

export const metadata: Metadata = {
  title: "AI-Based Intelligent Examination Platform",
  description:
    "Secure online examination platform with automated AI proctoring and performance analysis",
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}