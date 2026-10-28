/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

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

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
