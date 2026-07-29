import { useState } from 'react'
import { Link } from 'react-router'
import { useGroups } from '@/queries/groups'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CreateGroupDialog } from '@/components/group/create-group-dialog'

export default function GroupList() {
  const { profile } = useUser()
  const { data: groups, isLoading, isError } = useGroups()
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Failed to load groups.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Groups</h1>
          {profile?.display_name && (
            <p className="text-sm text-muted-foreground">Signed in as {profile.display_name}</p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>New Group</Button>
      </div>

      {groups && groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No groups yet. Create one or accept an invite link.</p>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map(group => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">{group.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {group.leader_id === profile?.id ? 'Leader' : 'Member'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
