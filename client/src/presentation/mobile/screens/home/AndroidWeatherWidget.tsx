import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
  MapPinOff,
  Navigation,
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

  // Intentional lifecycle: check permission on launch without endless loops
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
          // 'prompt' - Not yet determined: intentionally trigger permission prompt on launch
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
      // Fallback if reverse geocoder fails
    }
    return 'Local Area';
  };

  const fetchWeatherForPosition = async (lat: number, lon: number, cityName?: string) => {
    setLoading(true);
    try {
      const resolvedCity = cityName || (await reverseGeocodeCity(lat, lon));

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`,
        { signal: AbortSignal.timeout(6000) }
      );

      if (res.ok) {
        const data = await res.json();
        const current = data.current;
        const snapshot: WeatherSnapshot = {
          temperature: Math.round(current.temperature_2m),
          condition: getWeatherLabel(current.weather_code, Boolean(current.is_day)),
          cityName: resolvedCity,
          isDay: Boolean(current.is_day),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          weatherCode: current.weather_code,
          lat,
          lon,
        };
        setWeather(snapshot);
        setLocationStatus('granted');
        localStorage.setItem('lifeos_android_weather', JSON.stringify(snapshot));
        localStorage.setItem('lifeos_location_permitted', 'true');
      }
    } catch {
      // Preserve existing cache if network fails temporarily
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

  const getWeatherIcon = () => {
    if (!weather) return <Sun className="w-5 h-5 text-amber-500" />;
    const { weatherCode: code, isDay } = weather;
    if (code === 0) {
      return isDay ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />;
    }
    if (code <= 2) {
      return isDay ? <CloudSun className="w-5 h-5 text-amber-400" /> : <CloudMoon className="w-5 h-5 text-indigo-300" />;
    }
    if (code === 3) return <Cloud className="w-5 h-5 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-5 h-5 text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow className="w-5 h-5 text-sky-300" />;
    if (code >= 95) return <CloudLightning className="w-5 h-5 text-yellow-500" />;
    return <Sun className="w-5 h-5 text-amber-500" />;
  };

  // 1. STATE: Location Permission Denied (Compact, non-destructive fallback state, zero horizontal overflow)
  if (locationStatus === 'denied' && !weather) {
    return (
      <div className="w-full bg-gray-50/80 dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-2xl bg-gray-200/80 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
              <MapPinOff className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                Location Access Needed
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                Allow location to view actual local weather
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={loading}
            className="px-3 py-1 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Navigation className="w-3 h-3" />
            )}
            <span>Allow</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. STATE: Prompt for Location Permission (Initial state, clean and compact)
  if (locationStatus === 'prompt' && !weather) {
    return (
      <div className="w-full bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-2xs shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                Live Weather
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                Real-time forecast for your actual location
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={loading}
            className="px-3 py-1 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Navigation className="w-3 h-3" />
            )}
            <span>Allow</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. STATE: Weather Loaded (Strict hierarchy, responsive layout, ZERO horizontal overflow)
  // Preferred hierarchy:
  // 1. Temperature + condition
  // 2. Location/place name
  // 3. Secondary weather info
  return (
    <div className="w-full bg-gradient-to-br from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3 sm:p-3.5 shadow-2xs overflow-hidden">
      {/* Top Row: Weather Icon + Temperature & Condition (Left) + Refresh Button (Right) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center shadow-2xs shrink-0">
            {getWeatherIcon()}
          </div>

          <div className="min-w-0 flex-1">
            {/* 1. Primary: Temperature + Condition */}
            <div className="flex items-baseline gap-1.5 flex-wrap leading-tight">
              <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {weather ? `${weather.temperature}°C` : '--°C'}
              </span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                {weather?.condition || (loading ? 'Updating...' : 'Weather Ready')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Compact, touch-friendly, never overflowing */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={loading}
            aria-label="Update Location"
            title="Update Location"
            className="h-7 px-2.5 rounded-full bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-[10px] font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1 hover:bg-violet-50 active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin text-violet-600" />
            ) : (
              <Navigation className="w-3 h-3 text-violet-600 dark:text-violet-400" />
            )}
            <span>Location</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('click');
              if (weather?.lat && weather?.lon) {
                void fetchWeatherForPosition(weather.lat, weather.lon, weather.cityName);
              } else {
                void handleRequestLocation();
              }
            }}
            disabled={loading}
            aria-label="Refresh weather"
            className="w-7 h-7 rounded-full bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center text-gray-500 hover:text-violet-600 dark:text-gray-300 active:scale-90 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Middle Row: Clearly Visible Resolved City / Place Name */}
      <div className="flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300 mt-2 truncate">
        <MapPin className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="truncate">{weather?.cityName || 'Detected Location'}</span>
      </div>

      {/* 3. Bottom Row: Secondary Weather Information (Humidity & Wind) */}
      {weather && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 mt-1 pt-1 border-t border-violet-100/60 dark:border-violet-950/40">
          <span className="flex items-center gap-1 font-medium">
            <Droplets className="w-3 h-3 text-blue-400" />
            <span>Humidity {weather.humidity}%</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-medium">
            <Wind className="w-3 h-3 text-teal-400" />
            <span>Wind {weather.windSpeed} km/h</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default AndroidWeatherWidget;
