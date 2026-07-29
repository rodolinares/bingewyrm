import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { useCreateWatchlist } from '@/queries/watchlists'

const MEDIA_TYPES = [
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'anime_movie', label: 'Anime Movies' }
] as const

interface Props {
  groupId: string
  existingTypes: string[]
  onCreated: () => void
}

export function CreateWatchlistDialog({ groupId, existingTypes, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const createWatchlist = useCreateWatchlist()

  const available = MEDIA_TYPES.filter(m => !existingTypes.includes(m.value))

  const handleCreate = async () => {
    if (!selected) return
    await createWatchlist.mutateAsync({ groupId, mediaType: selected })
    setOpen(false)
    setSelected('')
    onCreated()
  }

  if (available.length === 0) return null

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Watchlist</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Watchlist</DialogTitle>
            <DialogDescription>Choose a media type for this watchlist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {available.map(m => (
              <button
                key={m.value}
                onClick={() => setSelected(m.value)}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected === m.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selected || createWatchlist.isPending} onClick={handleCreate}>
              {createWatchlist.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
