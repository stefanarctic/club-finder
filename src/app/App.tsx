import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './shell/AppShell'
import { HomeLayout } from './screens/home/HomeLayout'
import { CountryMap } from './screens/map/CountryMap'
import { EventEditor } from './screens/profile/EventEditor'
import { ProfileScreen } from './screens/profile/ProfileScreen'
import { VenueEditor } from './screens/profile/VenueEditor'
import { TicketsScreen } from './screens/tickets/TicketsScreen'

const Showcase = lazy(() => import('../showcase/Showcase').then((m) => ({ default: m.Showcase })))

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
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="profile/clubs/new" element={<VenueEditor />} />
        <Route path="profile/clubs/:id" element={<VenueEditor />} />
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
