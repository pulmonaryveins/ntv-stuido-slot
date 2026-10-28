/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { bffPlugin } from './server/vitePlugin.ts'

/** Production security headers from vercel.json, reused by `vite preview` (minus HTTPS-only ones). */
function previewHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[]
  }
  const out: Record<string, string> = {}
  for (const { key, value } of config.headers[0]?.headers ?? []) {
    if (key === 'Strict-Transport-Security') continue
    out[key] = value.replace('; upgrade-insecure-requests', '')
  }
  return out
}

const SERVER_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SESSION_SECRET'] as const

export default defineConfig(({ mode }) => {
  // Server-only vars from .env for the dev/preview BFF. They are never exposed to the client:
  // only VITE_* vars reach the bundle, and the app reads none of these.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_VARS) if (!process.env[key] && env[key]) process.env[key] = env[key]
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY) {
    console.warn('[studio] VITE_SUPABASE_* vars are no longer used. Rename them to SUPABASE_URL / SUPABASE_ANON_KEY.')
  }
  const backend = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? 'bff' : 'mock'

  return {
    plugins: [react(), tailwindcss(), bffPlugin()],
    define: { 'import.meta.env.VITE_BACKEND': JSON.stringify(backend) },
    server: { port: 5173 },
    preview: { headers: previewHeaders() },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) =>
            /node_modules[\\/](three|@react-three)[\\/]/.test(id) ? 'three' : undefined,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
      testTimeout: 30_000,
    },
  }
})
