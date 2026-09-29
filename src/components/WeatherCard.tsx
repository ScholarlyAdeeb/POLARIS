import React, { useEffect, useState } from 'react';
import { api, type StationWeather } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge } from './ui';
import { Mini } from './SeriesChart';

const FIELDS: [string, string][] = [
  ['temperature_2m', 'Air temperature'],
  ['apparent_temperature', 'Feels like'],
  ['wind_speed_10m', 'Wind'],
  ['wind_direction_10m', 'Wind from'],
  ['surface_pressure', 'Pressure'],
  ['relative_humidity_2m', 'Humidity'],
  ['cloud_cover', 'Cloud cover'],
];

/** Live model conditions at the station's coordinates (Open-Meteo). Clearly not station instrument data. */
export function WeatherCard({ stationId }: { stationId: string }) {
  const { t } = useT();
  const [w, setW] = useState<StationWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setW(null);
    setError(null);
    api.weather(stationId).then(setW).catch((e) => setError(e.message));
  }, [stationId]);

  return (
    <section className="sci-card p-4 flex flex-col gap-3" data-testid="weather-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">{t('station.live')}</h3>
        <DataStatusBadge status="EXTERNAL" />
      </div>
      {error && <p className="text-sm sci-muted">Live data unavailable right now ({error}).</p>}
      {!w && !error && <p className="text-sm sci-muted">{t('common.loading')}</p>}
      {w && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FIELDS.filter(([k]) => w.current[k] !== undefined).map(([k, label]) => (
              <div key={k} className="sci-well p-2">
                <p className="text-[11px] sci-muted">{label}</p>
                <p className="sci-mono font-semibold text-sm">
                  {w.current[k]} {w.units[k]}
                </p>
              </div>
            ))}
          </div>
          {w.hourly.length > 1 && <Mini name="Air temperature, last 48 h + today (°C)" xs={w.hourly.map((h) => h.time)} ys={w.hourly.map((h) => h.temperature)} />}
          <p className="text-[11px] sci-muted">
            {t('station.liveNote')} Source: {w.source}. Updated {new Date(w.fetchedAt).toLocaleTimeString()}.
          </p>
        </>
      )}
    </section>
  );
}
