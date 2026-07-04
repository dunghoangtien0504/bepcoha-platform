import { NextRequest, NextResponse } from 'next/server'

const SUBDOMAIN_ROUTES: Record<string, string> = {
  'sottronnom.hacofood.vn': '/sot-tron-nom',
  'raumadauxanh.hacofood.vn': '/rau-ma-dau-xanh',
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const target = SUBDOMAIN_ROUTES[host]

  if (target && req.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL(target, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon).*)'],
}
