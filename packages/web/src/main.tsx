import "@fontsource-variable/rubik/wght.css"
import Toaster from "@razzia/web/components/Toaster"
import { socketClient } from "@razzia/web/features/game/contexts/socket-context"
import "@razzia/web/i18n"
import "@razzia/web/index.css"
import { routeTree } from "@razzia/web/route.gen"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@razzia/web/lib/query-client"
import { createRoot } from "react-dom/client"

const router = createRouter({ routeTree, context: { socket: socketClient } })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById("root")

if (!root) {
  throw new Error("Root element not found")
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
