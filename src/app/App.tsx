import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { HomeLayout } from './screens/home/HomeLayout'
import { InterestsScreen } from './screens/InterestsScreen'
import { LocationScreen } from './screens/LocationScreen'
import { useSession } from './session'

const Showcase = lazy(() => import('../showcase/Showcase').then((m) => ({ default: m.Showcase })))

/** Location, then interests, once per browser session. Deep links come back after onboarding. */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const { location, interestsDone } = useSession()
  const here = useLocation()
  const state = here.pathname === '/' ? null : { from: here.pathname }
  if (!location) return <Navigate to="/welcome" replace state={state} />
  if (!interestsDone) return <Navigate to="/interests" replace state={state} />
  return children
}

function RequireLocation({ children }: { children: ReactNode }) {
  const { location } = useSession()
  const here = useLocation()
  if (!location) return <Navigate to="/welcome" replace state={here.state} />
  return children
}

export function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<LocationScreen />} />
      <Route
        path="/interests"
        element={
          <RequireLocation>
            <InterestsScreen />
          </RequireLocation>
        }
      />
      <Route
        element={
          <RequireOnboarding>
            <HomeLayout />
          </RequireOnboarding>
        }
      >
        <Route index element={null} />
        <Route path="events/:id" element={null} />
      </Route>
      <Route
        path="/design-system"
        element={
          <Suspense fallback={null}>
            <Showcase />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
