export const metadata = {
  title: 'OSM POI Platform',
  description: 'OpenStreetMap point of interests with photos and descriptions'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
