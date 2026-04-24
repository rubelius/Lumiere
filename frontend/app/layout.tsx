import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/playfair-display/700.css'
import './globals.css'

export const metadata = {
  title: 'Lumière — Personal Cinema',
  description: 'Sua plataforma de cinema curado',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  )
}