import { useOutletContext, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  useUpdateGroup,
  useDeleteGroup,
  useRegenerateInvite,
  useGroupMembers,
  useTransferLeader,
  useGroupGenres,
  useGroupGenreBlacklist,
  useAddGenreBlacklist,
  useRemoveGenreBlacklist
} from '@/queries/groups'
import type { Group } from '@/queries/groups'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'

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
  const transferLeader = useTransferLeader()
  const { data: members, isLoading: membersLoading } = useGroupMembers(group.id)
  const { user } = useUser()
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [newLeaderId, setNewLeaderId] = useState('')

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

  const handleTransfer = async () => {
    await transferLeader.mutateAsync({ groupId: group.id, newLeaderId })
    navigate('/groups', { replace: true })
  }

  const otherMembers = members?.filter(m => m.user_id !== user?.id) ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Group Settings</h1>
        <p className="text-sm text-muted-foreground">{group.name}</p>
      </div>

      {/* Members */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        {membersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : (
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
        )}
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
            <Button type="submit" disabled={updateGroup.isPending} className="h-10">
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={inviteUrl}
            className="flex h-10 flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} className="h-10 flex-1 sm:flex-none">
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {isLeader && (
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerateInvite.isPending}
                className="h-10 flex-1 sm:flex-none"
              >
                Regenerate
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Anyone with this link can join the group automatically.</p>
      </section>

      {/* Genre blacklist (leader only) */}
      {isLeader && <GenreBlacklistSection groupId={group.id} />}

      {/* Transfer leadership (leader only, requires other members) */}
      {isLeader && otherMembers.length > 0 && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground">Transfer Leadership</h2>
          <p className="text-sm text-muted-foreground">
            Transferring leadership will remove you from the group. This cannot be undone.
          </p>
          {!confirmTransfer ? (
            <div className="flex items-center gap-2">
              <select
                value={newLeaderId}
                onChange={e => setNewLeaderId(e.target.value)}
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a member...</option>
                {otherMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.users.display_name ?? 'Unnamed'}
                  </option>
                ))}
              </select>
              <Button
                variant="destructive"
                disabled={!newLeaderId}
                onClick={() => setConfirmTransfer(true)}
                className="h-10 shrink-0"
              >
                Transfer & Leave
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                You will be removed from the group and{' '}
                {otherMembers.find(m => m.user_id === newLeaderId)?.users.display_name ?? 'the selected member'} will
                become the new leader. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleTransfer} disabled={transferLeader.isPending}>
                  {transferLeader.isPending ? 'Transferring...' : 'Confirm'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmTransfer(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

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

function GenreBlacklistSection({ groupId }: { groupId: string }) {
  const { data: allGenres = [], isLoading: genresLoading } = useGroupGenres(groupId)
  const { data: blacklist = [] } = useGroupGenreBlacklist(groupId)
  const addBlacklist = useAddGenreBlacklist()
  const removeBlacklist = useRemoveGenreBlacklist()

  const blacklistSet = new Set(blacklist)

  const toggle = (genre: string) => {
    if (blacklistSet.has(genre)) {
      removeBlacklist.mutate({ groupId, genres: [genre] })
    } else {
      addBlacklist.mutate({ groupId, genres: [genre] })
    }
  }

  if (genresLoading) {
    return (
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-foreground">Genre Blacklist</h2>
        <p className="text-sm text-muted-foreground">Blacklisted genres are excluded from session-eligible items.</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </section>
    )
  }
  if (allGenres.length === 0) return null

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold text-foreground">Genre Blacklist</h2>
      <p className="text-sm text-muted-foreground">Blacklisted genres are excluded from session-eligible items.</p>
      <div className="flex flex-wrap gap-2">
        {allGenres.map(genre => {
          const isBlacklisted = blacklistSet.has(genre)
          return (
            <button
              key={genre}
              onClick={() => toggle(genre)}
              disabled={addBlacklist.isPending || removeBlacklist.isPending}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isBlacklisted
                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span className="mr-1">{isBlacklisted ? '⊘' : '+'}</span>
              {genre}
            </button>
          )
        })}
      </div>
    </section>
  )
}
