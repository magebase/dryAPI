type AuthActionResponse = {
  success?: boolean
  status?: boolean
  message?: string
  error?: string
}

function resolveAuthActionError(
  payload: AuthActionResponse | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim()
  return message && message.length > 0 ? message : fallbackMessage
}

async function postAuthAction(
  path: string,
  fallbackMessage: string,
): Promise<AuthActionResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    credentials: "include",
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as AuthActionResponse | null

  if (!response.ok) {
    throw new Error(resolveAuthActionError(payload, fallbackMessage))
  }

  return payload ?? {}
}

export async function signOutCurrentSession(): Promise<void> {
  const payload = await postAuthAction(
    "/api/auth/sign-out",
    "Unable to sign out current session.",
  )

  if (payload.success !== true) {
    throw new Error(
      resolveAuthActionError(payload, "Unable to sign out current session."),
    )
  }
}

export async function signOutOtherSessions(): Promise<void> {
  const payload = await postAuthAction(
    "/api/auth/revoke-other-sessions",
    "Unable to sign out other sessions.",
  )

  if (payload.status !== true) {
    throw new Error(
      resolveAuthActionError(payload, "Unable to sign out other sessions."),
    )
  }
}