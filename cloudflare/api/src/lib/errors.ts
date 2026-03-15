import type { AppContext } from '../types'

type ErrorDetail = {
  [key: string]: unknown
}

export function jsonError(
  c: AppContext,
  status: number,
  code: string,
  message: string,
  detail?: ErrorDetail,
): Response {
  return c.json(
    {
      error: {
        code,
        message,
        detail: detail ?? null,
      },
    },
    status,
  )
}

export function jsonUnauthorized(c: AppContext): Response {
  return jsonError(c, 401, 'unauthorized', 'Unauthorized user.')
}

export async function jsonUpstreamError(c: AppContext, upstream: Response, provider = 'runpod'): Promise<Response> {
  const bodyText = await upstream.text().catch(() => '')
  return jsonError(c, upstream.status, 'upstream_error', `Upstream ${provider} request failed`, {
    provider,
    upstream_status: upstream.status,
    upstream_body: bodyText,
  })
}
