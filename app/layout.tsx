import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono as GeistMono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/somma/toast"
import { PWAUpdateNotifier } from "@/components/pwa-update-notifier"
import { dynamicCacheInvalidation } from "@/lib/cache-invalidation"

/**
 * Inter para texto e interface; Geist Mono reservada a números, códigos e
 * identificadores. Antes o painel inteiro era monoespaçado, o que prejudicava
 * a leitura de nomes, descrições e formulários.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const geistMono = GeistMono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

const _cacheKey = dynamicCacheInvalidation

export const metadata: Metadata = {
  title: "Somma Dashboard",
  description: "Sistema de gestão Somma Assessoria",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Somma",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom liberado: bloquear escala viola a WCAG 1.4.4 e atrapalha quem
  // depende de ampliação no iPhone.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#08090B",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Somma" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans bg-canvas text-ink antialiased`}
      >
        <a
          href="#main-content-scroll"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Pular para o conteúdo
        </a>
        {children}
        <Toaster />
        <PWAUpdateNotifier />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then((reg) => {
                    setInterval(() => { reg.update() }, 60000)
                  })
                  .catch(() => {})
              })
            }
          `,
          }}
        />
      </body>
    </html>
  )
}
