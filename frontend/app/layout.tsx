import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n";

export const metadata: Metadata = {
  title: "AI-Based Intelligent Examination Platform",
  description: "Secure online examination platform with automated AI proctoring and performance analysis",
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
