import type { ReactNode } from 'react'
import './ScreenFrame.css'

/** Page chrome for the prototype screens that are not a map. */
export function ScreenFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="screen__column">
        <h1 className="screen__title cf-display">{title}</h1>
        {children}
      </div>
    </main>
  )
}
