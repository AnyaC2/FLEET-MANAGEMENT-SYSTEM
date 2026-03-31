export type PeriodPreset = '7d' | '30d' | '60d' | '90d' | '365d' | 'custom' | 'all';

export function resolveDateRange(options: {
  preset: PeriodPreset;
  customStartDate?: string;
  customEndDate?: string;
}) {
  if (options.preset === 'all') {
    return null;
  }

  if (options.preset === 'custom') {
    if (!options.customStartDate || !options.customEndDate) {
      return null;
    }

    return {
      start: new Date(`${options.customStartDate}T00:00:00`),
      end: new Date(`${options.customEndDate}T23:59:59`),
    };
  }

  const end = new Date();
  const start = new Date();
  const days = Number.parseInt(options.preset.replace('d', ''), 10);
  start.setDate(end.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function dateFallsInRange(dateValue: string, range: { start: Date; end: Date } | null) {
  if (!range) {
    return true;
  }

  const date = new Date(dateValue);
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}
