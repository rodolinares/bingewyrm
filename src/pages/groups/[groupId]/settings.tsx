import { useOutletContext, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { useUpdateGroup, useDeleteGroup, useRegenerateInvite, useGroupMembers } from '@/queries/groups'
import type { Group } from '@/queries/groups'
import { useState } from 'react'

interface Context {
  group: Group
  isLeader: boolean
}

const renameSchema = z.object({
  name: z.string().min(1, 'Required').max(50, 'At most 50 characters')
})

type RenameForm = z.infer<typeof renameSchema>

export default function GroupSettings() {
  const { group, isLeader } = useOutletContext<Context>()
  const navigate = useNavigate()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const regenerateInvite = useRegenerateInvite()
  const { data: members } = useGroupMembers(group.id)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useForm<RenameForm>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: group.name }
  })

  const inviteUrl = `${window.location.origin}/invite/${group.invite_code}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    await regenerateInvite.mutateAsync(group.id)
  }

  const handleRename = async (values: RenameForm) => {
    await updateGroup.mutateAsync({ id: group.id, name: values.name })
  }

  const handleDelete = async () => {
    await deleteGroup.mutateAsync(group.id)
    navigate('/groups', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Group Settings</h1>
        <p className="text-sm text-muted-foreground">{group.name}</p>
      </div>

      {/* Members */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <div className="space-y-2">
          {members?.map(m => (
            <div
              key={m.user_id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{m.users.display_name ?? 'Unnamed'}</span>
              {m.user_id === group.leader_id && <span className="text-xs font-medium text-primary">Leader</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Rename (leader only) */}
      {isLeader && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Rename</h2>
          <form onSubmit={form.handleSubmit(handleRename)} className="flex gap-2">
            <input
              {...form.register('name')}
              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={updateGroup.isPending}>
              Save
            </Button>
          </form>
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </section>
      )}

      {/* Invite link */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Invite Link</h2>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="flex h-10 flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
          <Button variant="outline" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {isLeader && (
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerateInvite.isPending}>
              Regenerate
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Anyone with this link can join the group automatically.</p>
      </section>

      {/* Delete group (leader only) */}
      {isLeader && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          {!confirmDelete ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete Group
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                This cannot be undone. All watchlists, sessions, and votes will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDelete} disabled={deleteGroup.isPending}>
                  {deleteGroup.isPending ? 'Deleting...' : 'Yes, delete'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
