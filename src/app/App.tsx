import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './shell/AppShell'
import { HomeLayout } from './screens/home/HomeLayout'
import { CountryMap } from './screens/map/CountryMap'
import { EventEditor } from './screens/profile/EventEditor'
import { ProfileScreen } from './screens/profile/ProfileScreen'
import { TicketsScreen } from './screens/tickets/TicketsScreen'
import { PassScreen } from './screens/tickets/PassScreen'

const Showcase = lazy(() => import('../showcase/Showcase').then((m) => ({ default: m.Showcase })))
const ScanScreen = lazy(() => import('./screens/scan/ScanScreen').then((m) => ({ default: m.ScanScreen })))

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<HomeLayout />}>
          <Route index element={null} />
          <Route path="events/:id" element={null} />
        </Route>
        <Route path="map" element={<CountryMap />} />
        <Route path="tickets" element={<TicketsScreen />} />
        <Route path="tickets/:id" element={<PassScreen />} />
        <Route
          path="scan/:eventId"
          element={
            <Suspense fallback={null}>
              <ScanScreen />
            </Suspense>
          }
        />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="profile/clubs/*" element={<Navigate to="/profile" replace />} />
        <Route path="profile/events/new" element={<EventEditor />} />
        <Route path="profile/events/:id" element={<EventEditor />} />
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
