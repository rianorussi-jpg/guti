import './globals.css'
import './theme-guti.css'
export const metadata = {
  title: 'Guti.mx — Cliente',
  manifest: '/manifest.webmanifest',
  themeColor: '#ff4d00',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Guti' },
  icons: { icon: '/pwa/icon-192.png', apple: '/pwa/icon-192.png' }
}
export default function Layout({children}) {
  return <html lang="es">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet"/>
    </head>
    <body>{children}</body>
  </html>
}
