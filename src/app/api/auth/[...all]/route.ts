import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import {
	countSetCookieHeaders,
	createAuthTraceId,
	logServerAuthEvent,
	summarizeCookieHeader,
} from "@/lib/auth-debug"
import { resolveConfiguredBalance } from "@/lib/configured-balance"
import {
	applyRequestPerfHeaders,
	createRequestPerfTracker,
	logServerPerfEvent,
	readCloudflareRequestMetadata,
	resolvePerfSlowThresholdMs,
	shouldEmitServerPerf,
	type RequestPerfTracker,
} from "@/lib/server-observability"

export const dynamic = "force-dynamic"

const authHandlers = toNextJsHandler(auth)

const AUTH_ROUTE_SLOW_MS = resolvePerfSlowThresholdMs("AUTH_PERF_SLOW_MS", 250)

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

function withPerfHeaders(
	response: Response,
	traceId: string,
	tracker: RequestPerfTracker,
): Response {
	const headers = new Headers(response.headers)
	applyRequestPerfHeaders(headers, traceId, tracker)

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

function emitAuthPerfSummary(args: {
	request: Request
	traceId: string
	method: "GET" | "POST"
	pathname: string
	tracker: RequestPerfTracker
	response: Response
	extra?: Record<string, unknown>
}): void {
	const totalDurationMs = args.tracker.getTotalDurationMs()
	const payload = args.tracker.summary({
		traceId: args.traceId,
		method: args.method,
		pathname: args.pathname,
		status: args.response.status,
		slowThresholdMs: AUTH_ROUTE_SLOW_MS,
		...readCloudflareRequestMetadata(args.request.headers),
		...(args.extra || {}),
	})

	if (totalDurationMs >= AUTH_ROUTE_SLOW_MS) {
		logServerPerfEvent("warn", "api.auth.summary.slow", payload)
		return
	}

	if (shouldEmitServerPerf("log")) {
		logServerPerfEvent("log", "api.auth.summary", payload)
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
	const tracker = createRequestPerfTracker({
		traceId,
		method: "GET",
		pathname,
	})

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

		const authResponse = await tracker.measure(
			"auth.handler",
			() => runAuthHandler(request, "GET", traceId, pathname),
		)

		const stableGetSession = isGetSessionPath
			? await tracker.measure(
				"auth.get-session.normalize",
				() => buildStableGetSessionResponse(authResponse),
			)
			: null

		const response = withPerfHeaders(
			stableGetSession?.response ?? authResponse,
			traceId,
			tracker,
		)

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

		emitAuthPerfSummary({
			request,
			traceId,
			method: "GET",
			pathname,
			tracker,
			response,
			extra: {
				recovered: stableGetSession?.recovered ?? false,
				sourceStatus: stableGetSession?.sourceStatus ?? response.status,
				setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
			},
		})
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
			const response = withPerfHeaders(
				buildRecoveredGetSessionResponse(),
				traceId,
				tracker,
			)
			emitAuthPerfSummary({
				request,
				traceId,
				method: "GET",
				pathname,
				tracker,
				response,
				extra: {
					error: message,
					recovered: true,
				},
			})
			return response
		}

		const response = withPerfHeaders(
			new Response(
			JSON.stringify({ error: "Authentication handler failed" }),
			{
				status: 500,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			},
			),
			traceId,
			tracker,
		)

		emitAuthPerfSummary({
			request,
			traceId,
			method: "GET",
			pathname,
			tracker,
			response,
			extra: {
				error: message,
			},
		})

		return response
	}
}

export async function POST(request: Request): Promise<Response> {
	const requestUrl = new URL(request.url)
	const traceId = createAuthTraceId(request.headers.get("x-request-id"))
	const shouldLog = shouldLogAuthPath(requestUrl.pathname)
	const tracker = createRequestPerfTracker({
		traceId,
		method: "POST",
		pathname: requestUrl.pathname,
	})

	if (isDeleteUserPath(requestUrl.pathname)) {
		const balance = resolveConfiguredBalance()
		if (balance < 0) {
			logServerAuthEvent("warn", "api.auth.delete-user.blocked", {
				traceId,
				pathname: requestUrl.pathname,
				balance,
			})

			tracker.record("auth.delete-user.blocked", 0, { balance })
			const response = withPerfHeaders(
				buildDeleteUserBlockedResponse(balance),
				traceId,
				tracker,
			)
			emitAuthPerfSummary({
				request,
				traceId,
				method: "POST",
				pathname: requestUrl.pathname,
				tracker,
				response,
				extra: {
					blockedByNegativeBalance: true,
					balance,
				},
			})
			return response
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

	const response = withPerfHeaders(
		await tracker.measure(
			"auth.handler",
			() => runAuthHandler(request, "POST", traceId, requestUrl.pathname),
		),
		traceId,
		tracker,
	)

	if (shouldLog) {
		logServerAuthEvent("log", "api.auth.response", {
			traceId,
			method: "POST",
			pathname: requestUrl.pathname,
			status: response.status,
			setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
		})
	}

	emitAuthPerfSummary({
		request,
		traceId,
		method: "POST",
		pathname: requestUrl.pathname,
		tracker,
		response,
		extra: {
			setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
		},
	})

	return response
}
