import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '../styles.css'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Stately Sketch',
      },
      {
        name: 'description',
        content:
          'A responsive visualizer and simulator for XState state machines.',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    scripts: [
      {
        defer: true,
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': JSON.stringify({
          token: '35d1455cdec84fda9fe47d5f6535fd4d',
        }),
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
