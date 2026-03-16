import { headers } from 'next/headers'

import { QueueScalingLivePanel, type QueueScalingPayload } from '@/components/site/dashboard/queue-scaling-live-panel'

export const dynamic = 'force-dynamic'

type HeaderStore = {
  get(name: string): string | null
}

function resolveRequestOrigin(requestHeaders: HeaderStore): string {
  const forwardedHost = requestHeaders.get('x-forwarded-host')?.trim()
  const host = forwardedHost || requestHeaders.get('host')?.trim() || ''
  const forwardedProtocol = requestHeaders.get('x-forwarded-proto')?.trim()

  if (host.length > 0) {
    const protocol =
      forwardedProtocol ||
      (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000'
}

async function getQueueScalingData(): Promise<QueueScalingPayload> {
  const requestHeaders = await headers()
  const origin = resolveRequestOrigin(requestHeaders)

  try {
    const response = await fetch(`${origin}/api/v1/queue/batch-scaling?runtimeWindowMinutes=60&snapshotWindowMinutes=60`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      return {}
    }

    return (await response.json().catch(() => ({}))) as QueueScalingPayload
  } catch {
    return {}
  }
}

export default async function QueueScalingPage() {
  const payload = await getQueueScalingData()
  return <QueueScalingLivePanel initialPayload={payload} />
}
