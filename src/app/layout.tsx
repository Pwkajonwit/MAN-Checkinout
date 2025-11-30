import type { Metadata } from "next";
import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const notoSansThai = Noto_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "CHECKINOUT - Admin Dashboard",
  description: "Employee attendance management system",
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${notoSansThai.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
