import { Component } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh items-center justify-center bg-background p-6">
          <div className="max-w-sm space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Something went wrong. Reload the page to try again.</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
