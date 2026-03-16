import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function resolveApiToken(): string | null {
  const token =
    process.env.DASHBOARD_API_KEY?.trim() ||
    process.env.DEAPI_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    process.env.INTERNAL_API_KEY?.trim() ||
    ''

  return token !== '' ? token : null
}

function resolveCloudflareApiBaseUrl(request: NextRequest): string {
  const configured =
    process.env.CLOUDFLARE_API_BASE_URL?.trim() ||
    process.env.DASHBOARD_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    ''

  if (configured !== '') {
    return configured.replace(/\/$/, '')
  }

  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const token = resolveApiToken()
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: 'missing_api_token',
          message: 'No dashboard API token is configured for queue scaling stream proxy.',
        },
      },
      { status: 500 },
    )
  }

  const baseUrl = resolveCloudflareApiBaseUrl(request)
  const upstreamUrl = new URL('/v1/queue/batch-scaling/stream', baseUrl)

  const runtimeWindowMinutes = request.nextUrl.searchParams.get('runtimeWindowMinutes') ?? '60'
  const snapshotWindowMinutes = request.nextUrl.searchParams.get('snapshotWindowMinutes') ?? '60'
  const pollSeconds = request.nextUrl.searchParams.get('pollSeconds') ?? '3'
  const maxEvents = request.nextUrl.searchParams.get('maxEvents') ?? '120'

  upstreamUrl.searchParams.set('runtimeWindowMinutes', runtimeWindowMinutes)
  upstreamUrl.searchParams.set('snapshotWindowMinutes', snapshotWindowMinutes)
  upstreamUrl.searchParams.set('pollSeconds', pollSeconds)
  upstreamUrl.searchParams.set('maxEvents', maxEvents)

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'text/event-stream',
    },
    cache: 'no-store',
  })

  const headers = new Headers()
  headers.set('content-type', upstreamResponse.headers.get('content-type') ?? 'text/event-stream; charset=utf-8')
  headers.set('cache-control', 'no-cache, no-transform')
  headers.set('connection', 'keep-alive')

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  })
}
