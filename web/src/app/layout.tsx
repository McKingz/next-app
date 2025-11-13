import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import "./globals.css";
import "./design.css";
import { PWARegister } from "@/components/PWARegister";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PWAUpdateChecker } from "@/components/PWAUpdateChecker";
import { DeploymentNotificationProvider } from "@/components/DeploymentNotificationProvider";
import 'katex/dist/katex.min.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduDash Pro",
  description: "Educational dashboard for South African preschools",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduDash Pro",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    themeColor: "#111111",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Next.js automatically adds manifest link from manifest.ts */}
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduDash Pro" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PWARegister />
        <PWAInstallPrompt />
        <PWAUpdateChecker />
        <DeploymentNotificationProvider />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
