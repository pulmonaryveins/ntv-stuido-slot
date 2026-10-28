import { useStudio } from '../store/studio'
import { Button } from './controls'

/** Placeholder until the admin phase (invites, roles, rules, full log). */
export function AdminStub() {
  const snapshot = useStudio((s) => s.snapshot)
  const setPage = useStudio((s) => s.setPage)
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold">Admin</h2>
        <Button onClick={() => setPage('board')}>Back to board</Button>
      </div>
      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
        Coming in the admin phase: invite users, activate/deactivate, change roles, edit accounts, slots and
        rules, full activity log with filters. Force release and queue removal already work from the board.
      </p>
      <section aria-labelledby="admin-users" className="rounded-xl border border-line bg-surface p-4">
        <h3 id="admin-users" className="text-sm font-semibold">
          Users ({snapshot?.profiles.length ?? 0})
        </h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Name</th>
              <th className="py-1 font-medium">Role</th>
              <th className="py-1 font-medium">Work</th>
              <th className="py-1 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {snapshot?.profiles.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1.5">
                  <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full" style={{ background: p.avatar_color }} />
                  {p.name}
                </td>
                <td>{p.role}</td>
                <td>{p.work_role}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
