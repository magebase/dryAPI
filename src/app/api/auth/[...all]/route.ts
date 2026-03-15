import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import {
	countSetCookieHeaders,
	createAuthTraceId,
	logServerAuthEvent,
	summarizeCookieHeader,
} from "@/lib/auth-debug"

export const runtime = "nodejs"

const authHandlers = toNextJsHandler(auth)

const AUTH_COOKIES_TO_CLEAR = [
	"better-auth.session_token",
	"better-auth.session_data",
	"better-auth.account_data",
	"better-auth.dont_remember",
	"better-auth.csrf_token",
] as const

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
	const requestUrl = new URL(request.url)
	const traceId = createAuthTraceId(request.headers.get("x-request-id"))
	const shouldLog = shouldLogAuthPath(requestUrl.pathname)

	if (shouldLog) {
		logServerAuthEvent("log", "api.auth.request", {
			traceId,
			method: "GET",
			pathname: requestUrl.pathname,
			search: requestUrl.search,
			cookie: summarizeCookieHeader(request.headers.get("cookie")),
		})
	}

	const response = await runAuthHandler(request, "GET", traceId, requestUrl.pathname)

	if (shouldLog) {
		logServerAuthEvent("log", "api.auth.response", {
			traceId,
			method: "GET",
			pathname: requestUrl.pathname,
			status: response.status,
			setCookieCount: countSetCookieHeaders(response.headers.get("set-cookie")),
		})

		if (requestUrl.pathname.startsWith("/api/auth/get-session")) {
			const payload = await response.clone().json().catch(() => null)
			logServerAuthEvent("log", "api.auth.get-session.payload", {
				traceId,
				status: response.status,
				...summarizeAuthSessionPayload(payload),
			})
		}
	}

	return response
}

export async function POST(request: Request): Promise<Response> {
	const requestUrl = new URL(request.url)
	const traceId = createAuthTraceId(request.headers.get("x-request-id"))
	const shouldLog = shouldLogAuthPath(requestUrl.pathname)

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
