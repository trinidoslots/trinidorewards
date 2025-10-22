"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import "./globals.css"; // keep your Tailwind styles
import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { MainNav } from "@/components/main-nav"
import { Footer } from "@/components/footer"
import { PageTransitionWrapper } from "@/components/page-transition-wrapper"

const geistSans = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className={`${geistSans.className} bg-slate-950 antialiased`}>
        <div className="flex flex-col min-h-screen">
          <MainNav />
          <main className="flex-1">
            
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
  key={pathname}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.35, ease: "easeInOut" }}
  className="relative flex-1"
>
  {children}
</motion.div>
          </AnimatePresence>
          </main>
          <Footer />
        </div>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
