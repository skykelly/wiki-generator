import { auth } from './auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: [
    '/admin/:path*',
    '/create',
    '/chat', '/chat/:path*',
    '/w/:wikiSlug/admin/:path*',
    '/w/:wikiSlug/chat', '/w/:wikiSlug/chat/:path*',
  ],
}
