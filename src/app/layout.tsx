import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { UserPointsProvider } from "@/components/providers/UserPointsProvider";
import AppLayout from "@/components/layout/AppLayout";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "English Learning App",
  description: "日本人向け英語学習サービス",
  other: {
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} antialiased`}
      >
        <AuthProvider>
          <UserPointsProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster position="top-center" toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
                maxWidth: '500px',
              }
            }} />
          </UserPointsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
