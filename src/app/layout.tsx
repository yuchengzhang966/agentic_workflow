import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atoms — Build apps with AI',
  description: 'Describe any web app and watch it come to life.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
