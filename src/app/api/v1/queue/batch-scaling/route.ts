import { NextRequest, NextResponse } from 'next/server'

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
          message: 'No dashboard API token is configured for queue scaling proxy.',
        },
      },
      { status: 500 },
    )
  }

  const baseUrl = resolveCloudflareApiBaseUrl(request)
  const upstreamUrl = new URL('/v1/queue/batch-scaling', baseUrl)

  const runtimeWindowMinutes = request.nextUrl.searchParams.get('runtimeWindowMinutes') ?? '60'
  const snapshotWindowMinutes = request.nextUrl.searchParams.get('snapshotWindowMinutes') ?? '60'
  upstreamUrl.searchParams.set('runtimeWindowMinutes', runtimeWindowMinutes)
  upstreamUrl.searchParams.set('snapshotWindowMinutes', snapshotWindowMinutes)

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  })

  const payload = await upstreamResponse.json().catch(() => null)

  return NextResponse.json(payload, { status: upstreamResponse.status })
}
