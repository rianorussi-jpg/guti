import './globals.css'
export const metadata = {
  title: 'Guti.mx — Cliente',
  manifest: '/manifest.webmanifest',
  themeColor: '#f4510b',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Guti' },
  icons: { icon: '/pwa/icon-192.png', apple: '/pwa/icon-192.png' }
}
export default function Layout({children}) {
  return <html lang="es"><body>{children}</body></html>
}
