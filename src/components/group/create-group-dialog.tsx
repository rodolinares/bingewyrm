import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateGroup } from '@/queries/groups'

const schema = z.object({
  name: z.string().min(1, 'Group name is required').max(50, 'At most 50 characters')
})

type FormData = z.infer<typeof schema>

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const CreateGroupDialog = ({ open, onOpenChange }: CreateGroupDialogProps) => {
  const navigate = useNavigate()
  const createGroup = useCreateGroup()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' }
  })

  const onSubmit = async (values: FormData) => {
    const group = await createGroup.mutateAsync(values.name)
    form.reset()
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input
            {...form.register('name')}
            placeholder="Group name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={createGroup.isPending}>
            {createGroup.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
