import type { Profile } from '../data'
import { useStudio } from '../store/studio'
import { Button, GateButton } from './controls'

const WORK_LABEL: Record<Profile['work_role'], string> = {
  designer: 'Designer',
  editor: 'Editor',
  motion: 'Motion',
}

/** Admin: approve new accounts, activate/deactivate, change roles. Rules/accounts/log come later. */
export function AdminStub() {
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const setPage = useStudio((s) => s.setPage)
  const act = useStudio((s) => s.act)
  const profiles = [...(snapshot?.profiles ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const pending = profiles.filter((p) => !p.active)

  const update = (p: Profile, changes: { role?: Profile['role']; active?: boolean }) =>
    void act((c) => c.adminUpdateProfile(p.id, changes))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold">Admin</h2>
        <Button onClick={() => setPage('board')}>Back to board</Button>
      </div>

      <section aria-labelledby="admin-pending" className="rounded-xl border border-line bg-surface p-4">
        <h3 id="admin-pending" className="text-sm font-semibold">
          Waiting for approval or inactive ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nobody is waiting.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-sm">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.avatar_color }} />
                <span className="min-w-0 flex-1 truncate">
                  {p.name} <span className="text-xs text-muted">· {WORK_LABEL[p.work_role]}</span>
                </span>
                <Button variant="primary" onClick={() => update(p, { active: true })} aria-label={`Approve ${p.name}`}>
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          New accounts can sign in but see nothing until approved. Deactivating someone frees their seat and removes
          them from the waiting list.
        </p>
      </section>

      <section aria-labelledby="admin-users" className="rounded-xl border border-line bg-surface p-4">
        <h3 id="admin-users" className="text-sm font-semibold">
          All users ({profiles.length})
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-1 font-medium">Name</th>
                <th scope="col" className="py-1 font-medium">Work</th>
                <th scope="col" className="py-1 font-medium">Role</th>
                <th scope="col" className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const self = p.id === actorId
                return (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-1.5">
                      <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full" style={{ background: p.avatar_color }} />
                      {p.name}
                      {self && <span className="ml-1 text-accent">(you)</span>}
                    </td>
                    <td>{WORK_LABEL[p.work_role]}</td>
                    <td>
                      <select
                        aria-label={`Role for ${p.name}`}
                        value={p.role}
                        disabled={self}
                        title={self ? 'You cannot change your own role' : undefined}
                        onChange={(e) => update(p, { role: e.target.value as Profile['role'] })}
                        className="rounded-md border border-line bg-surface-2 px-1.5 py-1 text-sm disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <GateButton
                        gate={self ? 'You cannot deactivate yourself' : null}
                        variant={p.active ? 'danger' : 'primary'}
                        className="px-2 py-0.5 text-xs"
                        onClick={() => update(p, { active: !p.active })}
                      >
                        {p.active ? 'Deactivate' : 'Activate'}
                      </GateButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
        Still to come: edit accounts, slots and rules, and the full activity log with filters. Force release and
        queue removal work from the board.
      </p>
    </div>
  )
}
