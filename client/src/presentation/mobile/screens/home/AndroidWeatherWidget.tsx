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
}

export const AndroidWeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(() => {
    try {
      const cached = localStorage.getItem('lifeos_android_weather');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      let lat = 28.6139;
      let lon = 77.209;
      let city = 'New Delhi';

      // Attempt browser geolocation if available
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
          city = 'Current Location';
        } catch {
          // Default to New Delhi / IST timezone fallback
        }
      }

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=auto`
      );
      if (res.ok) {
        const data = await res.json();
        const current = data.current;
        const snapshot: WeatherSnapshot = {
          temperature: Math.round(current.temperature_2m),
          condition: getWeatherLabel(current.weather_code, Boolean(current.is_day)),
          cityName: city,
          isDay: Boolean(current.is_day),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          weatherCode: current.weather_code,
        };
        setWeather(snapshot);
        localStorage.setItem('lifeos_android_weather', JSON.stringify(snapshot));
      }
    } catch {
      // Keep cached weather or fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!weather) {
      void fetchWeather();
    }
  }, []);

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
    if (!weather) return <Sun className="w-6 h-6 text-amber-500" />;
    const { weatherCode: code, isDay } = weather;
    if (code === 0) {
      return isDay ? <Sun className="w-6 h-6 text-amber-500" /> : <Moon className="w-6 h-6 text-indigo-400" />;
    }
    if (code <= 2) {
      return isDay ? <CloudSun className="w-6 h-6 text-amber-400" /> : <CloudMoon className="w-6 h-6 text-indigo-300" />;
    }
    if (code === 3) return <Cloud className="w-6 h-6 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-6 h-6 text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow className="w-6 h-6 text-sky-300" />;
    if (code >= 95) return <CloudLightning className="w-6 h-6 text-yellow-500" />;
    return <Sun className="w-6 h-6 text-amber-500" />;
  };

  if (!weather && !loading) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center shadow-2xs shrink-0">
          {getWeatherIcon()}
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {weather ? `${weather.temperature}°C` : '--°C'}
            </span>
            <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
              {weather?.condition || 'Loading weather...'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span>{weather?.cityName || 'India'}</span>
            </span>
            {weather && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  <span>{weather.humidity}%</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-teal-400" />
                  <span>{weather.windSpeed} km/h</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void nativeService.triggerHaptic('click');
          void fetchWeather();
        }}
        disabled={loading}
        aria-label="Refresh weather"
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition-all cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-600' : ''}`} />
      </button>
    </div>
  );
};
