import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, MEMBER_COOKIE, createAdminIpProof, requestAccessMetadata, verifySessionToken, type SessionPayload } from '@/lib/security'
import { adminPagePermission } from '@/lib/permissions'
import { isMemberPagePath } from '@/lib/member-pages'

async function currentAuth(request: NextRequest, role: 'admin' | 'member', session?: SessionPayload) {
  const endpoint = new URL(`/api/auth/${role}/session`, request.url)
  try {
    const requestHeaders: Record<string, string> = { cookie: request.headers.get('cookie') || '' }
    if (role === 'admin' && session) {
      const ipAddress = requestAccessMetadata(request).ipAddress
      requestHeaders['x-efukuri-admin-client-ip'] = ipAddress
      requestHeaders['x-efukuri-admin-ip-proof'] = createAdminIpProof(ipAddress, session.subjectId)
    }
    const response = await fetch(endpoint, {
      headers: requestHeaders,
      cache: 'no-store',
    })
    const body = await response.json().catch(() => null) as Record<string, unknown> | null
    return response.ok || response.status === 403 ? body : null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const linkToken = request.nextUrl.searchParams.get('efk_login')
  if (linkToken && (path === '/login.html' || isMemberPagePath(path))) {
    const cleanTarget = request.nextUrl.clone()
    cleanTarget.searchParams.delete('efk_login')
    const destination = new URL('/api/auth/member/link', request.url)
    destination.searchParams.set('token', linkToken)
    destination.searchParams.set('returnTo', path === '/login.html' ? '/dashboard.html' : cleanTarget.pathname + cleanTarget.search)
    return NextResponse.redirect(destination)
  }
  if (/^\/admin(?:-[a-z]+)*\.html$/i.test(path) && path !== '/admin-login.html') {
    const session = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value, 'admin')
    if (!session) return NextResponse.redirect(new URL('/admin-login.html', request.url))
    const admin = await currentAuth(request, 'admin', session)
    if (admin?.ipRestricted) {
      const response = NextResponse.redirect(new URL('/admin-login.html?ipDenied=1', request.url))
      response.cookies.delete(ADMIN_COOKIE)
      return response
    }
    if (!admin?.authenticated) return NextResponse.redirect(new URL('/admin-login.html', request.url))
    const required = adminPagePermission[path]
    const permissions = Array.isArray(admin.permissions) ? admin.permissions : []
    if (required && (required === 'owner' ? admin.isOwner !== true : admin.isOwner !== true && !permissions.includes(required))) return NextResponse.redirect(new URL('/admin.html?denied=1', request.url))
  }
  if (isMemberPagePath(path)) {
    const session = await verifySessionToken(request.cookies.get(MEMBER_COOKIE)?.value, 'member')
    const member = session ? await currentAuth(request, 'member') : null
    if (!session || !member?.authenticated) {
      const destination = new URL('/login.html', request.url)
      const returnTo = request.nextUrl.pathname + request.nextUrl.search
      if (returnTo !== '/dashboard.html') destination.searchParams.set('returnTo', returnTo)
      return NextResponse.redirect(destination)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/login.html',
    '/admin.html',
    '/admin-access-logs.html',
    '/admin-analytics.html',
    '/admin-companies.html',
    '/admin-consultations.html',
    '/admin-experts.html',
    '/admin-mainvisual.html',
    '/admin-menu.html',
    '/admin-notices.html',
    '/admin-seminars.html',
    '/admin-services.html',
    '/admin-settings.html',
    '/admin-topics.html',
    '/admin-videos.html',
    '/dashboard.html',
    '/seminar.html',
    '/expert.html',
    '/saliva-checker.html',
    '/embed-expert.html',
    '/embed-fp.html',
    '/embed-fudosan.html',
    '/embed-horitsu.html',
    '/embed-iryo.html',
    '/embed-lifeplan.html',
    '/embed-dc-simulator.html',
    '/dc-simulator/:path*',
    '/embed-manehapi.html',
    '/embed-menu.html',
    '/embed-service.html',
    '/embed-service.htm',
    '/embed-toshi.html',
    '/embed-zeimu.html',
  ],
}
