import type { Schedule } from '../types.ts';

const DAY_MAP: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getCurrentDay(): string {
  return DAY_MAP[new Date().getDay()];
}

export function findActiveSchedule(schedules: Schedule[]): Schedule | null {
  const currentMinutes = getCurrentMinutes();
  const currentDay = getCurrentDay();

  for (const schedule of schedules) {
    // Check day match
    if (!schedule.days.includes(currentDay)) continue;

    const start = timeToMinutes(schedule.start);
    const end = timeToMinutes(schedule.end);

    // 24-hour schedule (e.g., 08:00 - 08:00): always active
    if (start === end) {
      return schedule;
    }

    // Handle overnight schedules (e.g., 22:00 - 06:00)
    if (start < end) {
      // Normal schedule: start <= current < end
      if (currentMinutes >= start && currentMinutes < end) {
        return schedule;
      }
    } else {
      // Overnight schedule: current >= start OR current < end
      if (currentMinutes >= start || currentMinutes < end) {
        return schedule;
      }
    }
  }

  return null;
}
