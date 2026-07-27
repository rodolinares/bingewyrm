import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })
}

interface WrapperOptions {
  queryClient?: QueryClient
}

function Wrapper({ children, queryClient }: { children: React.ReactNode } & WrapperOptions) {
  const qc = queryClient ?? createTestQueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & WrapperOptions
) {
  const { queryClient, ...renderOptions } = options ?? {}
  const qc = queryClient ?? createTestQueryClient()

  function TestWrapper({ children }: { children: React.ReactNode }) {
    return <Wrapper queryClient={qc}>{children}</Wrapper>
  }

  return {
    ...render(ui, { wrapper: TestWrapper, ...renderOptions }),
    queryClient: qc
  }
}

export function createQueryClientWrapper() {
  const qc = createTestQueryClient()
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
    queryClient: qc
  }
}
