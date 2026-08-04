import { useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'

const NAME_REGEX = /^[\p{L}\p{M}' -]+$/u

const validate = (value: string): string | null => {
  if (value.length < 2) return 'At least 2 characters'
  if (value.length > 30) return 'At most 30 characters'
  if (!NAME_REGEX.test(value)) return 'Letters, spaces, apostrophes, and hyphens only'
  return null
}

const Onboarding = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useUser()
  const [displayName, setDisplayName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    if (!user) return
    const message = validate(displayName)
    if (message) {
      setValidationError(message)
      return
    }
    setValidationError(null)
    setServerError(null)
    setSaving(true)

    const { error: updateError } = await supabase.rpc('update_user_profile', {
      p_display_name: displayName
    })

    if (updateError) {
      setServerError(updateError.message)
      setSaving(false)
      return
    }

    navigate(searchParams.get('next') || '/groups', { replace: true })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome to BingeWyrm</h1>
          <p className="text-muted-foreground">Pick a display name for your group members to see.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={30}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{validationError ?? '\u00A0'}</span>
              <span>{displayName.length}/30</span>
            </div>
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{serverError}</p>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
export default Onboarding
