import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'

const schema = z.object({
  display_name: z
    .string()
    .min(2, 'At least 2 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[\p{L}\p{M}' -]+$/u, 'Letters, spaces, apostrophes, and hyphens only')
})

type FormData = z.infer<typeof schema>

export default function Onboarding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useUser()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: '' }
  })

  const onSubmit = async (values: FormData) => {
    if (!user) return
    setError(null)

    const { error: updateError } = await supabase.rpc('update_user_profile', {
      p_display_name: values.display_name
    })

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate(searchParams.get('next') || '/groups', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome to BingeWyrm</h1>
          <p className="text-muted-foreground">Pick a display name for your group members to see.</p>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <input
              {...form.register('display_name')}
              placeholder="Display name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={30}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{form.formState.errors.display_name?.message ?? '\u00A0'}</span>
              <span>{form.watch('display_name').length}/30</span>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
