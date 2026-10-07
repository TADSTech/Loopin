type WhenParts = { date: string; time: string | null };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{2}):(\d{2})/;

const labelDate = (year: number, month: number, day: number): string =>
  new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const labelTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string =>
  new Date(Date.UTC(year, month - 1, day, hour, minute)).toLocaleTimeString(
    "en-US",
    { timeZone: "UTC", hour: "numeric", minute: "2-digit" },
  );

const partsFromWallClock = (value: string): WhenParts | null => {
  const dateOnly = DATE_ONLY.exec(value);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { date: labelDate(+year, +month, +day), time: null };
  }

  const dateTime = DATE_TIME.exec(value);

  if (dateTime) {
    const [, year, month, day, hour, minute] = dateTime;
    return {
      date: labelDate(+year, +month, +day),
      time: labelTime(+year, +month, +day, +hour, +minute),
    };
  }

  return null;
};

const partsInTimeZone = (value: string, timeZone: string): WhenParts | null => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  try {
    return {
      date: date.toLocaleDateString("en-US", {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  } catch {
    return partsFromWallClock(value);
  }
};

const toParts = (value: string, timeZone?: string): WhenParts | null => {
  if (!value) return null;

  if (DATE_ONLY.test(value)) return partsFromWallClock(value);

  if (timeZone) {
    const converted = partsInTimeZone(value, timeZone);
    if (converted) return converted;
  }

  return partsFromWallClock(value);
};

export const formatEventWhen = (
  start: string | null | undefined,
  end?: string | null,
  timeZone?: string,
): string => {
  if (!start) return "";

  const head = toParts(start, timeZone);
  if (!head) return start;

  const headLabel = head.time ? `${head.date} · ${head.time}` : head.date;
  if (!end) return headLabel;

  const tail = toParts(end, timeZone);
  if (!tail) return headLabel;

  if (head.date === tail.date && head.time && tail.time) {
    return `${head.date} · ${head.time} – ${tail.time}`;
  }

  const tailLabel = tail.time ? `${tail.date} · ${tail.time}` : tail.date;
  return `${headLabel} – ${tailLabel}`;
};
