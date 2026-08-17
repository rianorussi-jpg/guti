import './globals.css'
export const metadata = {
  title: 'Guti.mx — Negocio',
  manifest: '/manifest.webmanifest',
  themeColor: '#f4510b',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Guti Negocios' },
  icons: { icon: '/pwa/icon-192.png', apple: '/pwa/icon-192.png' }
}
export default function Layout({children}) {
  return <html lang="es"><body>{children}</body></html>
}
