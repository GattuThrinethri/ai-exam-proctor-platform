import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
