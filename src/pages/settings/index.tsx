import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import { useUpdateProfile } from '@/queries/profile'
import { useTheme } from '@/hooks/use-theme'
import { Switch } from '@/components/ui/switch'

const NAME_REGEX = /^[\p{L}\p{M}' -]+$/u

const validate = (value: string): string | null => {
  if (value.length < 2) return 'At least 2 characters'
  if (value.length > 30) return 'At most 30 characters'
  if (!NAME_REGEX.test(value)) return 'Letters, spaces, apostrophes, and hyphens only'
  return null
}

const Settings = () => {
  const { profile } = useUser()
  const { theme, toggleTheme } = useTheme()
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    setSaved(false)
    const message = validate(name)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    try {
      await updateProfile.mutateAsync(name)
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
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={updateProfile.isPending} className="h-10">
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{error ?? (saved ? 'Saved' : '\u00A0')}</span>
            <span>{name.length}/30</span>
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
        <label className="flex cursor-pointer items-center gap-3">
          <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          <span className="text-sm text-foreground">Dark mode</span>
        </label>
      </section>
    </div>
  )
}
export default Settings
