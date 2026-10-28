import React, { useState, useEffect } from 'react';
import {
  MapPin,
  RefreshCw,
  MapPinOff,
  Navigation,
  Droplets,
  CloudRain,
} from 'lucide-react';
import { nativeService } from '../../../../services/nativeService';

interface WeatherSnapshot {
  temperature: number;
  condition: string;
  cityName: string;
  isDay: boolean;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  rainChance: number;
  lat: number;
  lon: number;
}

type LocationStatus = 'prompt' | 'requesting' | 'granted' | 'denied' | 'permanently_denied';

export const AndroidWeatherWidget: React.FC = () => {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(() => {
    try {
      const permitted = localStorage.getItem('lifeos_location_permitted');
      if (permitted === 'true') return 'granted';
      if (permitted === 'false') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  });

  const [weather, setWeather] = useState<WeatherSnapshot | null>(() => {
    try {
      const cached = localStorage.getItem('lifeos_android_weather');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initLocationFlow = async () => {
      try {
        const savedPerm = localStorage.getItem('lifeos_location_permitted');
        if (savedPerm === 'false') {
          if (isMounted) setLocationStatus('denied');
          return;
        }

        const platformPerm = await nativeService.checkLocationPermission();
        if (!isMounted) return;

        if (platformPerm === 'granted') {
          void fetchWeatherWithActualLocation();
        } else if (platformPerm === 'denied') {
          setLocationStatus('denied');
        } else {
          void fetchWeatherWithActualLocation();
        }
      } catch {
        if (isMounted) setLocationStatus('denied');
      }
    };

    void initLocationFlow();

    return () => {
      isMounted = false;
    };
  }, []);

  const reverseGeocodeCity = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
        { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city =
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.suburb ||
          address.county;
        const state = address.state || address.region;
        if (city && state) {
          return `${city}, ${state}`;
        }
        if (city) return city;
        if (state) return state;
        if (address.country) return address.country;
        return 'Local Area';
      }
    } catch {
      // Fallback
    }
    return 'Local Area';
  };

  const fetchWeatherForPosition = async (lat: number, lon: number, cityName?: string) => {
    setLoading(true);
    try {
      const resolvedCity = cityName || (await reverseGeocodeCity(lat, lon));

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m,precipitation&hourly=precipitation_probability&timezone=auto`,
        { signal: AbortSignal.timeout(6000) }
      );

      if (res.ok) {
        const data = await res.json();
        const current = data.current;
        const currentHour = new Date().getHours();
        const hourlyProb = Array.isArray(data.hourly?.precipitation_probability)
          ? data.hourly.precipitation_probability[currentHour]
          : null;
        const fallbackProb = current.precipitation > 0 ? 85 : (current.weather_code >= 51 && current.weather_code <= 67 ? 75 : current.weather_code >= 80 ? 60 : 10);
        const resolvedRainChance = typeof hourlyProb === 'number' ? Math.round(hourlyProb) : fallbackProb;

        const snapshot: WeatherSnapshot = {
          temperature: Math.round(current.temperature_2m),
          condition: getWeatherLabel(current.weather_code, Boolean(current.is_day)),
          cityName: resolvedCity,
          isDay: Boolean(current.is_day),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          weatherCode: current.weather_code,
          rainChance: resolvedRainChance,
          lat,
          lon,
        };
        setWeather(snapshot);
        setLocationStatus('granted');
        localStorage.setItem('lifeos_android_weather', JSON.stringify(snapshot));
        localStorage.setItem('lifeos_location_permitted', 'true');
      }
    } catch {
      // Preserve existing cache
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherWithActualLocation = async () => {
    setLoading(true);
    setLocationStatus('requesting');
    try {
      const coords = await nativeService.requestLocationAndGetPosition();
      await fetchWeatherForPosition(coords.latitude, coords.longitude);
    } catch (err: any) {
      setLoading(false);
      if (err?.code === 1 || err?.message === 'PERMISSION_DENIED') {
        setLocationStatus('denied');
        localStorage.setItem('lifeos_location_permitted', 'false');
      } else {
        if (weather?.lat && weather?.lon) {
          void fetchWeatherForPosition(weather.lat, weather.lon, weather.cityName);
        } else {
          setLocationStatus('denied');
        }
      }
    }
  };

  const handleRequestLocation = () => {
    void nativeService.triggerHaptic('selection');
    void fetchWeatherWithActualLocation();
  };

  const getWeatherLabel = (code: number, isDay: boolean): string => {
    if (code === 0) return isDay ? 'Sunny & Clear' : 'Clear Night';
    if (code === 1 || code === 2) return isDay ? 'Partly Cloudy' : 'Scattered Clouds';
    if (code === 3) return 'Overcast';
    if (code >= 51 && code <= 67) return 'Rain Showers';
    if (code >= 71 && code <= 77) return 'Snow Flurries';
    if (code >= 95) return 'Thunderstorm';
    return isDay ? 'Clear Day' : 'Clear Night';
  };

  // Compact fallback if location is denied
  if (locationStatus === 'denied' && !weather) {
    return (
      <div className="w-full bg-gray-50/80 dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] rounded-2xl px-3 py-2 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPinOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
              Location access needed for weather
            </span>
          </div>

          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
            <span>Enable</span>
          </button>
        </div>
      </div>
    );
  }

  // Compact prompt state
  if (locationStatus === 'prompt' && !weather) {
    return (
      <div className="w-full bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-2xl px-3 py-2 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MapPin className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
              Live Local Weather
            </span>
          </div>

          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
            <span>Enable</span>
          </button>
        </div>
      </div>
    );
  }

  // Compact, streamlined weather bar (No Sun/Moon icon, no wind speed, small height)
  return (
    <div className="w-full bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-2xl px-3 py-2 shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between gap-2.5">
        {/* Left: Temperature + Condition */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none shrink-0">
            {weather ? `${weather.temperature}°C` : '--°C'}
          </span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate leading-none">
            {weather?.condition || (loading ? 'Updating...' : 'Weather Ready')}
          </span>
        </div>

        {/* Right: Location + Humidity + Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300 truncate max-w-[130px] sm:max-w-[180px]">
            <MapPin className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="truncate">{weather?.cityName || 'Local Area'}</span>
          </div>

          {/* Rain Prediction Icon & Percentage */}
          {weather && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/50 shrink-0"
              title={`Rain Prediction: ${weather.rainChance ?? 0}% chance of rain`}
            >
              <CloudRain className="w-3 h-3 text-sky-500 fill-sky-400/20 shrink-0" />
              <span>{weather.rainChance ?? 0}%</span>
            </span>
          )}

          {weather && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              <Droplets className="w-2.5 h-2.5 text-blue-400" />
              <span>{weather.humidity}%</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('click');
              void fetchWeatherWithActualLocation();
            }}
            disabled={loading}
            aria-label="Refresh weather"
            title="Refresh weather"
            className="w-6 h-6 rounded-full bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-violet-700 dark:text-violet-300 flex items-center justify-center hover:bg-violet-50 active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-violet-600' : 'text-violet-600 dark:text-violet-400'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AndroidWeatherWidget;
