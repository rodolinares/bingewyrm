import { Link, Outlet, useLocation } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/use-user'
import { SettingsIcon } from '@/components/icons'

const AppLayout = () => {
  const { user } = useUser()
  const location = useLocation()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex h-dvh flex-col">
      {user && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <Link
            to="/groups"
            className="flex h-10 items-center font-display text-lg font-black leading-none tracking-tight text-primary"
          >
            BingeWyrm
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>

            <button
              onClick={handleSignOut}
              className="flex h-10 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </header>
      )}
      <main className="flex flex-1 flex-col overflow-auto">
        <div key={location.pathname} className="animate-[fade-in_150ms_ease-out] flex flex-1 flex-col">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground">
        This product uses the TMDb API but is not endorsed or certified by TMDb.
      </footer>
    </div>
  )
}

export default AppLayout
