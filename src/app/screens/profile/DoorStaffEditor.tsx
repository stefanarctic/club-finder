import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../design-system'
import { setDoorStaff, watchDoorStaff, type DoorStaff } from '../../../data/doorStaff'
import { callableError } from '../../tickets'

/** Accounts that may scan passes for this night, besides the organizer and admins. */
export function DoorStaffEditor({ eventId }: { eventId: string }) {
  const [staff, setStaff] = useState<DoorStaff[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => watchDoorStaff(eventId, setStaff, setError), [eventId])

  const change = async (target: string, add: boolean) => {
    setBusy(target)
    setError(null)
    try {
      await setDoorStaff(eventId, target, add)
      if (add) setEmail('')
    } catch (err) {
      setError(callableError(err))
    } finally {
      setBusy(null)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const target = email.trim()
    if (target) void change(target, true)
  }

  return (
    <section className="editor__form" aria-labelledby="door-staff">
      <div className="editor__field">
        <span id="door-staff" className="cf-label">
          Door staff
        </span>
        <span className="editor__hint">
          These accounts can scan passes for this night. They need a Club Finder account with this email.
        </span>
        {staff.length === 0 ? (
          <p className="editor__hint">Only you can scan for now.</p>
        ) : (
          <ul className="editor__staff">
            {staff.map((person) => (
              <li key={person.uid}>
                <span>
                  {person.displayName}
                  {person.displayName !== person.email && <span className="editor__hint"> {person.email}</span>}
                </span>
                <button
                  type="button"
                  className="editor__text-btn"
                  disabled={busy != null}
                  onClick={() => void change(person.email, false)}
                >
                  {busy === person.email ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="editor__staff-add" onSubmit={submit}>
        <label className="editor__field">
          <span className="cf-label">Add by email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" autoComplete="off" />
        </label>
        <Button type="submit" variant="secondary" disabled={busy != null || !email.trim()}>
          {busy === email.trim() ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {error && <p className="editor__error">{error}</p>}
      <Link className="cf-btn cf-btn--primary cf-btn--md cf-btn--block" to={`/scan/${eventId}`}>
        Open the scanner
      </Link>
    </section>
  )
}
