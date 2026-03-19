import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import {
	countSetCookieHeaders,
	createAuthTraceId,
	logServerAuthEvent,
	summarizeCookieHeader,
} from "@/lib/auth-debug"
import { resolveConfiguredBalance } from "@/lib/configured-balance"

const authHandlers = toNextJsHandler(auth)

const AUTH_COOKIES_TO_CLEAR = [
	"better-auth.session_token",
	"better-auth.session_data",
	"better-auth.account_data",
	"better-auth.dont_remember",
	"better-auth.csrf_token",
] as const

function isDeleteUserPath(pathname: string): boolean {
	return pathname === "/api/auth/delete-user" || pathname === "/api/auth/delete-user/"
}

function buildDeleteUserBlockedResponse(balance: number): Response {
	return new Response(
		JSON.stringify({
			error: {
				code: "negative_balance_blocks_deletion",
				message: "Account deletion is blocked while your credit balance is below 0.00.",
				details: {
					balance,
				},
			},
		}),
		{
			status: 409,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			},
		},
	)
}

function shouldLogAuthPath(pathname: string): boolean {
	return (
		pathname.startsWith("/api/auth/get-session")
		|| pathname.startsWith("/api/auth/sign-in")
		|| pathname.startsWith("/api/auth/sign-up")
		|| pathname.startsWith("/api/auth/sign-out")
	)
}

function summarizeAuthSessionPayload(payload: unknown): Record<string, unknown> {
	if (!payload || typeof payload !== "object") {
		return {
			hasPayload: false,
		}
	}

	const record = payload as Record<string, unknown>
	return {
		hasPayload: true,
		hasUser: Boolean(record.user),
		hasSession: Boolean(record.session),
		keys: Object.keys(record),
	}
}

function normalizeAuthSessionPayload(payload: unknown): { user: unknown | null; session: unknown | null } {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return {
			user: null,
			session: null,
		}
	}

	const record = payload as Record<string, unknown>

	return {
		user: "user" in record ? (record.user ?? null) : null,
		session: "session" in record ? (record.session ?? null) : null,
	}
}

async function parseJsonBodySafely(response: Response): Promise<unknown | null> {
	const bodyText = await response.clone().text().catch(() => "")
	if (!bodyText) {
		return null
	}

	try {
		return JSON.parse(bodyText) as unknown
	} catch {
		return null
	}
}

async function buildStableGetSessionResponse(response: Response): Promise<{
	response: Response
	payload: { user: unknown | null; session: unknown | null }
	sourceStatus: number
	recovered: boolean
}> {
	const sourceStatus = response.status
	const parsedPayload = await parseJsonBodySafely(response)
	const payload = normalizeAuthSessionPayload(parsedPayload)

	const headers = new Headers(response.headers)
	headers.set("content-type", "application/json; charset=utf-8")
	headers.set("cache-control", "no-store")

	const recovered = !response.ok || parsedPayload === null
	if (recovered) {
		appendCookieClears(headers)
	}

	return {
		response: new Response(JSON.stringify(payload), {
			status: 200,
			headers,
		}),
		payload,
		sourceStatus,
		recovered,
	}
}

function buildRecoveredGetSessionResponse(): Response {
	const headers = new Headers({
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
	})
	appendCookieClears(headers)

	return new Response(JSON.stringify({ user: null, session: null }), {
		status: 200,
		headers,
	})
}

function appendCookieClears(headers: Headers): void {
	for (const cookieName of AUTH_COOKIES_TO_CLEAR) {
		headers.append(
			"set-cookie",
			`${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
		)
	}
}

async function runAuthHandler(
	request: Request,
	method: "GET" | "POST",
	traceId: string,
	pathname: string,
): Promise<Response> {
	try {
		return method === "GET" ? await authHandlers.GET(request) : await authHandlers.POST(request)
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown-error"

		logServerAuthEvent("error", "api.auth.handler.error", {
			traceId,
			method,
			pathname,
			message,
		})

		if (pathname.startsWith("/api/auth/get-session")) {
			return buildRecoveredGetSessionResponse()
		}

		return new Response(
			JSON.stringify({ error: "Authentication handler failed" }),
			{
				status: 500,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			},
		)
	}
}

export async function GET(request: Request): Promise<Response> {
	let requestUrl: URL
	try {
		requestUrl = new URL(request.url)
	} catch {
		requestUrl = new URL("http://localhost/api/auth/get-session")
	}

	const traceId = createAuthTraceId(request.headers.get("x-request-id"))
	const pathname = requestUrl.pathname
	const shouldLog = shouldLogAuthPath(pathname)
	const isGetSessionPath = pathname.startsWith("/api/auth/get-session")

	try {
		if (shouldLog) {
			logServerAuthEvent("log", "api.auth.request", {
				traceId,
				method: "GET",
				pathname,
				search: requestUrl.search,
				cookie: summarizeCookieHeader(request.headers.get("cookie")),
			})
		}

		const authResponse = await runAuthHandler(request, "GET", traceId, pathname)

		const stableGetSession = isGetSessionPath
			? await buildStableGetSessionResponse(authResponse)
			: null

		const response = stableGetSession?.response ?? authResponse

		if (shouldLog) {
			logServerAuthEvent("log", "api.auth.response", {
				traceId,
				method: "GET",
				pathname,
				status: response.status,
				sourceStatus: stableGetSession?.sourceStatus ?? response.status,
				recovered: stableGetSession?.recovered ?? false,
				setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
			})

			if (isGetSessionPath) {
				const payload = stableGetSession?.payload ?? normalizeAuthSessionPayload(await parseJsonBodySafely(response))
				logServerAuthEvent("log", "api.auth.get-session.payload", {
					traceId,
					status: response.status,
					sourceStatus: stableGetSession?.sourceStatus ?? response.status,
					recovered: stableGetSession?.recovered ?? false,
					...summarizeAuthSessionPayload(payload),
				})
			}
		}

		return response
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown-error"

		logServerAuthEvent("error", "api.auth.get.unhandled", {
			traceId,
			pathname,
			message,
		})

		if (isGetSessionPath) {
			return buildRecoveredGetSessionResponse()
		}

		return new Response(
			JSON.stringify({ error: "Authentication handler failed" }),
			{
				status: 500,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			},
		)
	}
}

export async function POST(request: Request): Promise<Response> {
	const requestUrl = new URL(request.url)
	const traceId = createAuthTraceId(request.headers.get("x-request-id"))
	const shouldLog = shouldLogAuthPath(requestUrl.pathname)

	if (isDeleteUserPath(requestUrl.pathname)) {
		const balance = resolveConfiguredBalance()
		if (balance < 0) {
			logServerAuthEvent("warn", "api.auth.delete-user.blocked", {
				traceId,
				pathname: requestUrl.pathname,
				balance,
			})

			return buildDeleteUserBlockedResponse(balance)
		}
	}

	if (shouldLog) {
		logServerAuthEvent("log", "api.auth.request", {
			traceId,
			method: "POST",
			pathname: requestUrl.pathname,
			search: requestUrl.search,
			cookie: summarizeCookieHeader(request.headers.get("cookie")),
		})
	}

	const response = await runAuthHandler(request, "POST", traceId, requestUrl.pathname)

	if (shouldLog) {
		logServerAuthEvent("log", "api.auth.response", {
			traceId,
			method: "POST",
			pathname: requestUrl.pathname,
			status: response.status,
			setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
		})
	}

	return response
}
