import { cn } from '@/lib/utils'

export const OutcomeBadge = ({ outcome, className }: { outcome: string | null; className?: string }) => {
  const style =
    outcome === 'saved'
      ? 'bg-green-500/20 text-green-400'
      : outcome === 'discarded'
        ? 'bg-destructive/20 text-destructive'
        : 'bg-muted text-muted-foreground'
  const label = outcome ? outcome[0]!.toUpperCase() + outcome.slice(1) : 'Pending'

  return <span className={cn('inline-block rounded px-1.5 py-0.5 text-xs font-medium', style, className)}>{label}</span>
}
