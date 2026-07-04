import { NextRequest, NextResponse } from 'next/server'

const REDIRECT_MAP: Record<string, string> = {
  'sottronnom.hacofood.vn': 'https://bepcoha.hacofood.vn/sot-tron-nom',
  'www.sottronnom.hacofood.vn': 'https://bepcoha.hacofood.vn/sot-tron-nom',
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''

  if (REDIRECT_MAP[host]) {
    return NextResponse.redirect(REDIRECT_MAP[host], 301)
  }

  if (host.includes('hacofood.vn') && !host.startsWith('bepcoha.')) {
    return NextResponse.redirect('https://bepcoha.hacofood.vn/dua-ca-muoi', 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon).*)'],
}
