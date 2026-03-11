import { execSync } from "node:child_process"

import { createDatabase, createLocalDatabase, FilesystemBridge } from "@tinacms/datalayer"
import type { Level } from "@tinacms/graphql"
import { GitHubProvider } from "tinacms-gitprovider-github"
import { RedisLevel } from "upstash-redis-level"

const branch =
  process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.CF_PAGES_BRANCH || "main"

const useGitHubGitProvider = process.env.TINA_USE_GITHUB_GIT_PROVIDER === "true"

const readGitHubTokenFromCli = () => {
  if (process.env.CI === "true") {
    return undefined
  }

  try {
    const token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()

    return token.length > 0 ? token : undefined
  } catch {
    return undefined
  }
}

const database = (() => {
  if (!useGitHubGitProvider) {
    return createLocalDatabase({
      namespace: branch,
      tinaDirectory: "tina",
    })
  }

  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || readGitHubTokenFromCli()
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!owner || !repo || !token || !redisUrl || !redisToken) {
    throw new Error(
      "GitHub Git Provider is enabled, but GITHUB_OWNER, GITHUB_REPO, GITHUB_PERSONAL_ACCESS_TOKEN, " +
        "UPSTASH_REDIS_REST_URL, or UPSTASH_REDIS_REST_TOKEN is missing."
    )
  }

  // `upstash-redis-level` and Tina can resolve `abstract-level` through different
  // type instances, so we cast the adapter even though runtime behavior is compatible.
  const databaseAdapter = new RedisLevel<string, Record<string, unknown>>({
    redis: {
      url: redisUrl,
      token: redisToken,
    },
    debug: process.env.DEBUG === "true",
    namespace: branch,
  }) as unknown as Level

  return createDatabase({
    bridge: new FilesystemBridge(process.cwd()),
    databaseAdapter,
    gitProvider: new GitHubProvider({
      branch,
      owner,
      repo,
      token,
    }),
    namespace: branch,
  })
})()

export default database