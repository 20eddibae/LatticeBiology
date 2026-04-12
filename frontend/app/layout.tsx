import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LatticeBio — Virtual Wet Lab Platform",
  description: "AI-powered virtual wet lab for biomedical research, structural biology, and drug discovery.",
  keywords: ["biotech", "bioinformatics", "entity extraction", "pipeline", "AI", "NER"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Mol* (Molstar) pre-built CSS for 3D molecular viewer */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/molstar@5.8.0/build/viewer/molstar.css" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-slate-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
