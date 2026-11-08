import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClaimGuard — Cashless Claims & TPA Workspace | Nashik Hospital",
  description:
    "Pre-authorisation checklist gatekeeper, multimodal AI scan verification, and IRDAI SLA tracking workspace.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans min-h-screen flex flex-col selection:bg-teal-700 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
