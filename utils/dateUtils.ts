// Date utilities for calendar generation

export interface CalendarDate {
  year: number;
  month: string;
  day: number;
  dayOfWeek: string;
  isNewYear: boolean;
  isWeekend: boolean;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export function generateCalendarDates(): CalendarDate[] {
  const dates: CalendarDate[] = [];
  
  // Start from December 30, 2025
  const startDate = new Date(2025, 11, 30);
  
  // Generate 367 days (full year plus a couple extra)
  // Dec 30, 2025 -> Dec 31, 2026
  for (let i = 0; i < 367; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dayOfWeek = date.getDay();
    
    dates.push({
      year: date.getFullYear(),
      month: monthNames[date.getMonth()],
      day: date.getDate(),
      dayOfWeek: dayNames[dayOfWeek],
      isNewYear: date.getMonth() === 0 && date.getDate() === 1,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  
  return dates;
}

export function formatDateJapanese(date: CalendarDate): string {
  return `${date.month} ${date.day}, ${date.year}`;
}

export function getCountdownToNewYear(): { days: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const newYear = new Date(2026, 0, 1, 0, 0, 0);
  const diff = newYear.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds };
}
