import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, MapPin, SlidersHorizontal, X } from 'lucide-react'
import { IconButton } from '../../../design-system'
import type { SortKey } from '../../../data/discovery'
import type { TimeRange } from '../../../data/schedule'
import type { Budget, Genre } from '../../../data/types'
import { ListControls } from './ListControls'
import './CityMenu.css'

const GAP = 8
const MARGIN = 12

type MenuBox = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function placeMenu(anchor: HTMLElement): MenuBox {
  const rect = anchor.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const width = Math.min(420, viewportWidth - MARGIN * 2)
  const left = Math.min(Math.max(MARGIN, rect.left), viewportWidth - MARGIN - width)
  const top = rect.bottom + GAP
  const maxHeight = Math.max(80, viewportHeight - top - MARGIN)
  return { top, left, width, maxHeight }
}

type CityMenuProps = {
  cityName: string
  dateLabel: string
  eventCount: number
  venueCount: number
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  genres: Genre[]
  onGenresChange: (update: (current: Genre[]) => Genre[]) => void
  budget: Budget | null
  onBudgetChange: (budget: Budget | null) => void
  filterMapToo: boolean
  onFilterMapTooChange: (on: boolean) => void
}

export function CityMenu({
  cityName,
  dateLabel,
  eventCount,
  venueCount,
  timeRange,
  onTimeRangeChange,
  sort,
  onSortChange,
  genres,
  onGenresChange,
  budget,
  onBudgetChange,
  filterMapToo,
  onFilterMapTooChange,
}: CityMenuProps) {
  const titleId = useId()
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const focusedOnOpen = useRef(false)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<MenuBox | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const tuneCount =
    (timeRange !== 'all' ? 1 : 0) +
    (sort !== 'forYou' ? 1 : 0) +
    genres.length +
    (budget ? 1 : 0) +
    (filterMapToo ? 1 : 0)

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    setBox(null)
    focusedOnOpen.current = false
    if (restoreFocus) buttonRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const anchor = buttonRef.current
      if (anchor) setBox(placeMenu(anchor))
    }
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open])

  useEffect(() => {
    if (!open || !box || focusedOnOpen.current) return
    panelRef.current?.focus()
    focusedOnOpen.current = true
  }, [open, box])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu(true)
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      closeMenu(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open, closeMenu])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={open ? 'home__city is-open' : 'home__city'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={tuneCount > 0 ? `${cityName}, filters, ${tuneCount} active` : `${cityName}, filters`}
        onClick={() => (open ? closeMenu(false) : setOpen(true))}
      >
        <MapPin className="home__city-pin" aria-hidden />
        <span className="home__city-name">{cityName}</span>
        <span className="home__city-filters">
          <SlidersHorizontal aria-hidden />
        </span>
        {tuneCount > 0 && <span className="home__city-badge cf-mono">{tuneCount}</span>}
        <ChevronDown className="home__city-chevron" aria-hidden />
      </button>

      {open &&
        box &&
        createPortal(
          <div className="home-menu-layer">
            <div className="home-menu__backdrop" onClick={() => closeMenu(false)} />
            <div
              ref={panelRef}
              id={menuId}
              className="home-menu"
              role="dialog"
              aria-labelledby={titleId}
              tabIndex={-1}
              style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            >
              <div className="home-menu__head">
                <div className="home-menu__titles">
                  <p id={titleId} className="cf-label">
                    {cityName} · {dateLabel}
                  </p>
                  <p className="home-menu__summary">
                    <span className="cf-mono">{eventCount}</span> upcoming at{' '}
                    <span className="cf-mono">{venueCount}</span> venues
                  </p>
                </div>
                <IconButton
                  label="Close"
                  variant="ghost"
                  className="home-menu__close"
                  onClick={() => closeMenu(true)}
                >
                  <X />
                </IconButton>
              </div>

              <ListControls
                timeRange={timeRange}
                onTimeRangeChange={onTimeRangeChange}
                sort={sort}
                onSortChange={onSortChange}
                genres={genres}
                onGenresChange={onGenresChange}
                budget={budget}
                onBudgetChange={onBudgetChange}
                filterMapToo={filterMapToo}
                onFilterMapTooChange={onFilterMapTooChange}
                expanded={filtersOpen}
                onExpandedChange={setFiltersOpen}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
