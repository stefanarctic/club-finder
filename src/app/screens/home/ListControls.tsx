import { SlidersHorizontal, Wallet } from 'lucide-react'
import { Button, Chip, SegmentedControl, Switch } from '../../../design-system'
import type { SortKey } from '../../../data/discovery'
import type { TimeRange } from '../../../data/schedule'
import { BUDGETS, GENRES, MAX_GENRE_PICKS, type Budget, type City, type Genre } from '../../../data/types'
import { budgetLabels } from '../../format'

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'all', label: 'All upcoming' },
]

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'forYou', label: 'For you' },
  { value: 'soonest', label: 'Soonest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'price', label: 'Price' },
]

type ListControlsProps = {
  cities: City[]
  cityId: string
  onCityChange: (cityId: string) => void
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
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

export function ListControls({
  cities,
  cityId,
  onCityChange,
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
  expanded,
  onExpandedChange,
}: ListControlsProps) {
  const activeCount = genres.length + (budget ? 1 : 0) + (filterMapToo ? 1 : 0)

  const toggleGenre = (genre: Genre, on: boolean) =>
    onGenresChange((current) =>
      on ? [...new Set([...current, genre])].slice(0, MAX_GENRE_PICKS) : current.filter((g) => g !== genre),
    )

  return (
    <div className="home-controls">
      <SegmentedControl
        label="Time range"
        size="sm"
        options={timeRangeOptions}
        value={timeRange}
        onChange={onTimeRangeChange}
        className="home-controls__range"
      />
      <div className="home-controls__row">
        <SegmentedControl label="Sort" size="sm" options={sortOptions} value={sort} onChange={onSortChange} />
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<SlidersHorizontal />}
          aria-expanded={expanded}
          aria-controls="home-filters"
          onClick={() => onExpandedChange(!expanded)}
          className="home-controls__toggle"
        >
          Filters{activeCount > 0 && <span className="home-controls__badge cf-mono">{activeCount}</span>}
        </Button>
      </div>

      {expanded && (
        <div id="home-filters" className="home-controls__panel">
          <div className="home-controls__group">
            <p className="home-controls__label">
              City <span className="home-controls__hint">zooms the map</span>
            </p>
            <div className="home-controls__chips" role="group" aria-label="City">
              {cities.map((city) => (
                <Chip key={city.id} selected={city.id === cityId} onSelectedChange={() => onCityChange(city.id)}>
                  {city.name}
                </Chip>
              ))}
            </div>
          </div>
          <div className="home-controls__group">
            <p className="home-controls__label">
              Genres
              <span className="cf-mono home-controls__count">
                {genres.length}/{MAX_GENRE_PICKS}
              </span>
            </p>
            <div className="home-controls__chips">
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
          </div>
          <div className="home-controls__group">
            <p className="home-controls__label">
              Budget <span className="home-controls__hint">average ticket, EUR · ranks closer matches higher</span>
            </p>
            <div className="home-controls__chips">
              {BUDGETS.map((band) => (
                <Chip
                  key={band}
                  selected={budget === band}
                  icon={<Wallet />}
                  onSelectedChange={(on) => onBudgetChange(on ? band : null)}
                >
                  {budgetLabels[band]}
                </Chip>
              ))}
            </div>
          </div>
          <Switch
            checked={filterMapToo}
            onChange={onFilterMapTooChange}
            label="Filter the map too"
            description="Hide venues that don’t match instead of dimming them"
          />
        </div>
      )}
    </div>
  )
}
