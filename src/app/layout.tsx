import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Wyllie March Madness",
  description: "Family bracket pool",
  icons: {
    icon: "/w.png",
    apple: "/w.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased bg-[#1a0a2e] min-h-screen`}
      >
        <div className="page-glow" />
        <div className="corner-glow-left" />
        <div className="corner-glow-right" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
