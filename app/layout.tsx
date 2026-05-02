import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://splitsafe.vercel.app"),
  title: "SplitSafe",
  description: "AI-powered expense splitting and settlement for private groups.",
  openGraph: {
    title: "SplitSafe",
    description: "AI-powered expense splitting and settlement for private groups.",
    images: [
      {
        url: "/splitsafe-cover.png",
        width: 1200,
        height: 630,
        alt: "SplitSafe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitSafe",
    description: "AI-powered expense splitting and settlement for private groups.",
    images: ["/splitsafe-cover.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/splitsafe-logo.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
