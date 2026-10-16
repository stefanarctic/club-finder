import { bucharest, events, venues } from './bucharest'
import { scheduleEvents } from './schedule'

/** Tonight, tomorrow and this weekend are resolved once, against the clock at load. */
export const loadedAt = new Date()

export const catalog = {
  city: bucharest,
  venues,
  events: scheduleEvents(events, loadedAt),
}
