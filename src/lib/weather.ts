// Live weather via Open-Meteo (free, no API key). Weather is the single
// strongest real-world predictor of outdoor court usage: precipitation cuts
// outdoor activity ~40% per inch, sub-freezing temps cut park visits ~20%+,
// and extreme heat (>35C) suppresses midday play.

export type HourlyWeather = {
  time: number; // epoch ms, local hour
  tempC: number;
  precipMm: number;
  snowCm: number;
  snowDepthM: number;
  windKmh: number;
};

export type Weather = {
  hours: HourlyWeather[];
};

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&hourly=temperature_2m,precipitation,snowfall,snow_depth,wind_speed_10m` +
    `&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather " + res.status);
  const data = await res.json();
  const h = data.hourly;
  const hours: HourlyWeather[] = (h?.time ?? []).map((t: string, i: number) => ({
    // timezone=auto returns local ISO strings; Date parses them as local time,
    // which matches since courts are near the browser's location.
    time: new Date(t).getTime(),
    tempC: h.temperature_2m?.[i] ?? 15,
    precipMm: h.precipitation?.[i] ?? 0,
    snowCm: h.snowfall?.[i] ?? 0,
    snowDepthM: h.snow_depth?.[i] ?? 0,
    windKmh: h.wind_speed_10m?.[i] ?? 0,
  }));
  return { hours };
}

// Nearest hourly sample for a given date, or null if out of range / no data.
export function weatherAt(w: Weather | null | undefined, date: Date): HourlyWeather | null {
  if (!w || !w.hours.length) return null;
  const t = date.getTime();
  let best: HourlyWeather | null = null;
  let bestDist = Infinity;
  for (const h of w.hours) {
    const d = Math.abs(h.time - t);
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  // Only trust samples within 2h of the requested time.
  return bestDist <= 2 * 3600 * 1000 ? best : null;
}
