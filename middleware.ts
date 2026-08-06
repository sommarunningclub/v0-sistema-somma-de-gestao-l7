import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionFromRequest,
  hasModulePermission,
} from '@/lib/auth/session'
import {
  getRequiredPermission,
  isPublicApiRoute,
} from '@/lib/auth/route-permissions'
import {
  getPagePermission,
  getSpaRedirect,
  isOpenPage,
  isPublicPage,
  isStaticAsset,
} from '@/lib/auth/page-routes'

async function handleApiAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  if (isPublicApiRoute(pathname, request.method)) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const requiredPermission = getRequiredPermission(pathname)
  if (requiredPermission && !hasModulePermission(session, requiredPermission)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  return NextResponse.next()
}

async function handlePageAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  if (isOpenPage(pathname)) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)

  // Redirect rotas legadas para SPA
  const spaRedirect = getSpaRedirect(pathname, search)
  if (spaRedirect) {
    const url = request.nextUrl.clone()
    const [path, qs] = spaRedirect.split('?')
    url.pathname = path
    url.search = qs ? `?${qs}` : ''
    return NextResponse.redirect(url)
  }

  if (isPublicPage(pathname)) {
    if (session) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (!session) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = `?from=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(loginUrl)
  }

  const pagePermission = getPagePermission(pathname)
  if (pagePermission && !hasModulePermission(session, pagePermission)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = '?error=forbidden'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    return handleApiAuth(request)
  }

  return handlePageAuth(request)
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
