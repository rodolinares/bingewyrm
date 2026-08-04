import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateGroup } from '@/queries/groups'

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const CreateGroupDialog = ({ open, onOpenChange }: CreateGroupDialogProps) => {
  const navigate = useNavigate()
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    if (name.trim().length === 0) {
      setError('Group name is required')
      return
    }
    if (name.length > 50) {
      setError('At most 50 characters')
      return
    }
    setError(null)
    const group = await createGroup.mutateAsync(name)
    setName('')
    onOpenChange(false)
    navigate(`/groups/${group.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>Pick a name your members will recognize.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={createGroup.isPending}>
            {createGroup.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
