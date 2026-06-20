import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { auth } from '@/auth'
import Link from 'next/link'
import EmbeddedChrome from '@/components/EmbeddedChrome'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wiki Generator',
  description: 'LLM이 자동으로 위키를 생성하고 지속 업데이트합니다.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-100 min-h-screen`}>
        <EmbeddedChrome />
        <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
            <Link href="/" className="text-white font-semibold tracking-tight">Wiki Generator</Link>
            <div className="flex items-center gap-4">
              {session ? (
                <Link href="/auth/signout" className="text-sm text-neutral-400 hover:text-white transition-colors">로그아웃</Link>
              ) : (
                <Link href="/auth/signin" className="text-sm text-neutral-400 hover:text-white transition-colors">로그인</Link>
              )}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
