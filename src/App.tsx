import { supabaseConfigured } from './lib/supabase'

// Phase 1 placeholder. Auth, List view and 3D scene arrive in phases 2-4.
export function App() {
  return (
    <main className="grid h-full place-items-center bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Studio Slots</h1>
        <p className="mt-2 text-sm opacity-70">
          {supabaseConfigured
            ? 'Supabase configured.'
            : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'}
        </p>
      </div>
    </main>
  )
}
