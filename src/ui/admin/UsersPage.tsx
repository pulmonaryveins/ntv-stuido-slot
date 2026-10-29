import { useState } from 'react'
import type { Profile, Snapshot } from '../../data'
import { useStudio } from '../../store/studio'
import { formatAgo, toMs } from '../../lib/format'
import { slotLabel } from '../../lib/activityText'
import { studioClient } from '../../data'
import { Button, GateButton, Select, type SelectOption } from '../controls'
import { Shell } from '../Dialogs'
import { AdminHeader, UserName } from './AdminPage'
import { Spinner } from '../Loader'

const ROLE_OPTIONS: SelectOption<Profile['role']>[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
]

type Filter = 'all' | 'active' | 'inactive' | 'admins'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Pending / inactive' },
  { id: 'admins', label: 'Admins' },
]

export function UsersPage({ snapshot }: { snapshot: Snapshot }) {
  const actorId = useStudio((s) => s.actorId)
  const act = useStudio((s) => s.act)
  const pushToast = useStudio((s) => s.pushToast)
  const busy = useStudio((s) => s.busy > 0)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'deactivate'; user: Profile } | null>(null)
  const now = studioClient.now()

  const q = query.trim().toLowerCase()
  const users = [...snapshot.profiles]
    .sort((a, b) => Number(a.active) - Number(b.active) || a.name.localeCompare(b.name))
    .filter((p) =>
      filter === 'active' ? p.active : filter === 'inactive' ? !p.active : filter === 'admins' ? p.role === 'admin' : true,
    )
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.device_name ?? '').toLowerCase().includes(q))

  const update = (p: Profile, changes: { role?: Profile['role']; active?: boolean }) =>
    act((c) => c.adminUpdateProfile(p.id, changes))

  const runConfirm = async () => {
    if (!confirm) return
    const { kind, user } = confirm
    const ok =
      kind === 'delete'
        ? await act((c) => c.adminDeleteUser(user.id))
        : await update(user, { active: false })
    if (ok) {
      pushToast({ kind: 'info', title: kind === 'delete' ? `${user.name} was deleted` : `${user.name} was deactivated` })
      setConfirm(null)
    }
  }

  return (
    <div>
      <AdminHeader title="Users" description="Approve new accounts, change roles, deactivate or delete users." />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter users" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = snapshot.profiles.filter((p) =>
              f.id === 'active' ? p.active : f.id === 'inactive' ? !p.active : f.id === 'admins' ? p.role === 'admin' : true,
            ).length
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`px-badge px-2.5 py-1 text-sm ${filter === f.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 hover:brightness-105'}`}
              >
                {f.label} <span className="opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or device"
          aria-label="Search users"
          className="ml-auto w-full border-2 border-line bg-surface-2 px-2.5 py-1.5 text-sm sm:w-56"
        />
      </div>

      <div className="px-panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b-2 border-line">
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Device</th>
              <th scope="col" className="px-3 py-2 font-medium">Seat now</th>
              <th scope="col" className="px-3 py-2 font-medium">Joined</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((p) => {
              const self = p.id === actorId
              const seat = snapshot.slots.find((s) => s.user_id === p.id)
              const queued = snapshot.queue.findIndex((x) => x.user_id === p.id)
              return (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <UserName id={p.id} name={p.name} color={p.avatar_color} you={self} />
                  </td>
                  <td className="px-3 py-2 font-mono">{p.device_name ?? <span className="text-muted">not set</span>}</td>
                  <td className="px-3 py-2">
                    {seat ? slotLabel(snapshot, seat.id) : queued >= 0 ? <span className="text-muted">Waiting #{queued + 1}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{formatAgo(toMs(p.created_at) ?? now, now)}</td>
                  <td className="px-3 py-2">
                    <Select<Profile['role']>
                      size="sm"
                      label={`Role for ${p.name}`}
                      value={p.role}
                      disabled={self}
                      title={self ? 'You cannot change your own role' : undefined}
                      onChange={(role) => void update(p, { role })}
                      options={ROLE_OPTIONS}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-badge px-1.5 py-0.5 text-xs font-semibold ${p.active ? 'bg-free/20 text-free' : 'bg-reserved/20 text-reserved'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      {p.active ? (
                        <GateButton
                          gate={self ? 'You cannot deactivate yourself' : null}
                          className="px-2 py-0.5 text-xs"
                          onClick={() => setConfirm({ kind: 'deactivate', user: p })}
                        >
                          Deactivate
                        </GateButton>
                      ) : (
                        <Button variant="primary" className="px-2 py-0.5 text-xs" onClick={() => void update(p, { active: true })}>
                          {!snapshot.activity.some((a) => a.action === 'profile_update' && (a.meta as { target_user_id?: string } | null)?.target_user_id === p.id) ? 'Approve' : 'Activate'}
                        </Button>
                      )}
                      <GateButton
                        gate={self ? 'You cannot delete yourself' : null}
                        variant="danger"
                        className="px-2 py-0.5 text-xs"
                        onClick={() => setConfirm({ kind: 'delete', user: p })}
                      >
                        Delete
                      </GateButton>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        New accounts can sign in but see nothing until approved. Deactivating or deleting someone ends their session and
        removes them from the waiting list.
      </p>

      <Shell
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'delete' ? `Delete ${confirm.user.name}?` : `Deactivate ${confirm?.user.name ?? ''}?`}
        description={
          confirm?.kind === 'delete'
            ? 'This permanently removes their account and sign-in. Their past activity stays in the log without a name. This cannot be undone.'
            : 'They will be signed out of the board until you activate them again. Their account is kept.'
        }
      >
        {confirm && snapshot.slots.some((s) => s.user_id === confirm.user.id) && (
          <p className="mb-3 border-2 border-reserved/60 bg-reserved/10 px-2.5 py-2 text-sm">
            They hold a seat right now. It will be freed; remember to sign their device out in Adobe.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} aria-busy={busy} onClick={() => void runConfirm()}>
            {busy && <Spinner size={14} />}
            {confirm?.kind === 'delete' ? 'Delete user' : 'Deactivate'}
          </Button>
        </div>
      </Shell>
    </div>
  )
}
