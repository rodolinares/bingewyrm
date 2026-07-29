import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { Spinner } from '@/components/ui/spinner'
import { useJoinGroup } from '@/queries/groups'

export default function InviteJoin() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const joinGroup = useJoinGroup()
  const [error, setError] = useState<string | null>(null)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current || !code) return
    didRun.current = true

    joinGroup
      .mutateAsync(code)
      .then(group => {
        navigate(`/groups/${group.id}`, { replace: true })
      })
      .catch(err => {
        setError(err.message ?? 'Failed to join group')
      })
  }, [code, joinGroup, navigate])

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <p className="text-destructive">{error}</p>
          <Link to="/groups" className="text-sm text-primary hover:underline">
            Go to groups
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner />
    </div>
  )
}
