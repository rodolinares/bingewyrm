import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'
import { SunIcon, MoonIcon } from '@/components/icons'

function Switch({
  className,
  checked,
  onCheckedChange,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'group/switch relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors outline-none select-none',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'data-checked:bg-primary data-unchecked:bg-input',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'flex size-6 items-center justify-center rounded-full bg-background shadow-xs transition-transform',
          'data-checked:translate-x-5 data-unchecked:translate-x-0'
        )}
      >
        <SunIcon className="hidden size-3.5 text-foreground group-data-checked/switch:hidden" />
        <MoonIcon className="hidden size-3.5 text-foreground group-data-checked/switch:block" />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
