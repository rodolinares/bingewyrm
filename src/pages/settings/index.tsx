import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { useUpdateProfile } from '@/queries/profile'
import { useTheme } from '@/hooks/use-theme'
import { Switch } from '@/components/ui/switch'

const schema = z.object({
  display_name: z
    .string()
    .min(2, 'At least 2 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[\p{L}\p{M}' -]+$/u, 'Letters, spaces, apostrophes, and hyphens only')
})

type FormData = z.infer<typeof schema>

export default function Settings() {
  const { profile } = useUser()
  const { theme, toggleTheme } = useTheme()
  const updateProfile = useUpdateProfile()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: profile?.display_name ?? '' }
  })

  const onSubmit = async (values: FormData) => {
    setError(null)
    setSaved(false)
    try {
      await updateProfile.mutateAsync(values.display_name)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Display name */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Display Name</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex gap-2">
            <input
              {...form.register('display_name')}
              maxLength={30}
              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={updateProfile.isPending} className="h-10">
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{form.formState.errors.display_name?.message ?? saved ? 'Saved' : error ?? '\u00A0'}</span>
            <span>{form.watch('display_name').length}/30</span>
          </div>
        </form>
      </section>

      {/* Email */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Email</h2>
        <p className="text-sm text-muted-foreground">{profile?.email ?? 'No email on file'}</p>
      </section>

      {/* Theme */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Theme</h2>
        <label className="flex cursor-pointer items-center gap-3" onClick={() => toggleTheme()}>
          <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          <span className="text-sm text-foreground">Dark mode</span>
        </label>
      </section>
    </div>
  )
}
