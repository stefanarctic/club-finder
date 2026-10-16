import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowRight, Wallet } from 'lucide-react'
import { Button, Chip } from '../../design-system'
import { BUDGETS, GENRES, MAX_GENRE_PICKS, type Budget, type Genre } from '../../data/types'
import { budgetLabels } from '../format'
import { useSession } from '../session'
import type { RedirectState } from './LocationScreen'
import './Onboarding.css'

export function InterestsScreen() {
  const session = useSession()
  const navigate = useNavigate()
  const from = (useLocation().state as RedirectState)?.from
  const [genres, setGenres] = useState<Genre[]>(session.genres)
  const [budget, setBudget] = useState<Budget | null>(session.budget)

  const finish = (picks: Genre[], band: Budget | null) => {
    session.setInterests(picks, band)
    navigate(from ?? '/', { replace: true })
  }

  const toggleGenre = (genre: Genre, on: boolean) =>
    setGenres((prev) => (on ? [...prev, genre].slice(0, MAX_GENRE_PICKS) : prev.filter((g) => g !== genre)))

  return (
    <main className="onb onb--interests cf-atmosphere">
      <div className="onb__copy">
        <p className="cf-label onb__eyebrow">Optional · you can change this later</p>
        <h1 className="cf-display onb__title">What do you feel like?</h1>
      </div>

      <section className="onb__group" aria-labelledby="genres-heading">
        <h2 id="genres-heading" className="onb__group-title">
          Genres
          <span className="cf-mono onb__count">
            {genres.length}/{MAX_GENRE_PICKS}
          </span>
        </h2>
        <div className="onb__chips">
          {GENRES.map((genre) => (
            <Chip
              key={genre}
              selected={genres.includes(genre)}
              disabled={!genres.includes(genre) && genres.length >= MAX_GENRE_PICKS}
              onSelectedChange={(on) => toggleGenre(genre, on)}
            >
              {genre}
            </Chip>
          ))}
        </div>
      </section>

      <section className="onb__group" aria-labelledby="budget-heading">
        <h2 id="budget-heading" className="onb__group-title">
          Budget <span className="onb__hint">average ticket, EUR</span>
        </h2>
        <div className="onb__chips">
          {BUDGETS.map((band) => (
            <Chip
              key={band}
              selected={budget === band}
              icon={<Wallet />}
              onSelectedChange={(on) => setBudget(on ? band : null)}
            >
              {budgetLabels[band]}
            </Chip>
          ))}
        </div>
      </section>

      <div className="onb__actions">
        <Button block size="lg" trailingIcon={<ArrowRight />} onClick={() => finish(genres, budget)}>
          Show me what’s on
        </Button>
        <Button block size="lg" variant="ghost" onClick={() => finish([], null)}>
          Skip
        </Button>
      </div>
    </main>
  )
}
