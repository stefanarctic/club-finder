import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { HomeLayout } from './screens/home/HomeLayout'

const Showcase = lazy(() => import('../showcase/Showcase').then((m) => ({ default: m.Showcase })))

export function App() {
  return (
    <Routes>
      <Route element={<HomeLayout />}>
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
