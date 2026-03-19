#!/usr/bin/env node
// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'

const outPath = path.join(process.cwd(), 'content', 'llm-text.txt')
const origin = process.env.ORIGIN_URL || process.env.NEXT_PUBLIC_API_ORIGIN || 'https://api.example.com'

const content = `DryAPI LLM artifact - generated at ${new Date().toISOString()}

Public OpenAPI: ${origin}/openapi.json

Endpoints provided (OpenAI/OpenRouter-compatible shapes):
- /v1/chat/completions
- /v1/images/generations
- /v1/embeddings

Use these endpoints with an Authorization: Bearer $API_KEY header.
`

async function main() {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, content, 'utf8')
  console.log('Wrote', outPath)
}

main().catch(console.error)
