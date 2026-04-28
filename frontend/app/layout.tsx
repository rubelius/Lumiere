import type { Metadata } from 'next'
import { MotionShell } from '@/components/system/MotionShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lumière — Personal Cinema',
  description: 'A curated cinema archive.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MotionShell>{children}</MotionShell>
      </body>
    </html>
  )
}