import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans, Roboto_Slab } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

// Slab serif for prices — legible, neutral, renders ₿ cleanly
const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-roboto-slab',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'BRÜ Coins — Recompensas para el Equipo',
  description: 'Gana y canjea BRÜ Coins por ser el mejor barista del equipo.',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#DFD9C7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${playfair.variable} ${dmSans.variable} ${robotoSlab.variable}`}>
      <body className="font-sans bg-bru-parchment min-h-screen">
        {children}
      </body>
    </html>
  )
}
