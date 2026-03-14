"use client"

import React, { useEffect, useState } from 'react'

type OpenApi = any

export default function OpenApiViewer() {
  const [spec, setSpec] = useState<OpenApi | null>(null)
  const [lang, setLang] = useState<'curl' | 'python' | 'js'>('curl')

  useEffect(() => {
    let mounted = true
    fetch('/openapi.json')
      .then((r) => r.json())
      .then((j) => mounted && setSpec(j))
      .catch(() => mounted && setSpec(null))
    return () => {
      mounted = false
    }
  }, [])

  const renderExample = () => {
    // provide a small, representative example for chat completions
    const endpoint = '/v1/chat/completions'
    if (lang === 'curl') {
      return `curl -X POST \
  ${endpoint} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"Flux1schnell","messages":[{"role":"user","content":"Say hello"}]}'`
    }

    if (lang === 'python') {
      return `import requests\nresp = requests.post('${endpoint}', json={"model":"Flux1schnell","messages":[{"role":"user","content":"Say hello"}]}, headers={"Authorization":"Bearer $API_KEY"})\nprint(resp.json())`
    }

    return `const res = await fetch('${endpoint}', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer $API_KEY' }, body: JSON.stringify({ model: 'Flux1schnell', messages: [{ role: 'user', content: 'Say hello' }] }) });\nconsole.log(await res.json());`
  }

  return (
    <aside className="hidden lg:block sticky top-24 max-h-[70vh] w-1/3 pl-6">
      <div className="border rounded-md p-4 bg-white shadow-sm overflow-auto h-[70vh]">
        <h4 className="text-sm font-semibold mb-2">Live API Preview</h4>
        <p className="text-xs text-slate-600 mb-3">Spec: {spec ? spec.info?.title || 'OpenAPI' : 'loading...'}</p>

        <div className="flex gap-2 mb-3">
          <button className={`px-2 py-1 text-xs rounded ${lang === 'curl' ? 'bg-slate-100' : ''}`} onClick={() => setLang('curl')}>curl</button>
          <button className={`px-2 py-1 text-xs rounded ${lang === 'python' ? 'bg-slate-100' : ''}`} onClick={() => setLang('python')}>python</button>
          <button className={`px-2 py-1 text-xs rounded ${lang === 'js' ? 'bg-slate-100' : ''}`} onClick={() => setLang('js')}>js</button>
        </div>

        <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto whitespace-pre-wrap">{renderExample()}</pre>

        <div className="mt-4 text-xs">
          <div className="font-medium mb-1">Available Endpoints</div>
          <ul className="text-xs list-disc list-inside">
            <li>/v1/chat/completions</li>
            <li>/v1/images/generations</li>
            <li>/v1/embeddings</li>
          </ul>
        </div>

        <div className="mt-4 text-xs text-slate-600">
          <div className="font-medium">OpenAPI JSON</div>
          <code className="block break-words">/openapi.json</code>
        </div>
      </div>
    </aside>
  )
}
