import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
  AlertCircle,
  Thermometer,
} from 'lucide-react';
import { Sound } from '../utils/audio';

interface CurrentWeatherWidgetProps {
  soundEnabled?: boolean;
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  cityName: string;
  timestamp: number;
}

// Fallback coordinates mapped by prominent regions if geolocation has not yet been granted
const TIMEZONE_CITY_MAP: Record<string, { name: string; lat: number; lon: number }> = {
  'America/New_York': { name: 'New York', lat: 40.7128, lon: -74.006 },
  'America/Chicago': { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  'America/Denver': { name: 'Denver', lat: 39.7392, lon: -104.9903 },
  'America/Los_Angeles': { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  'Europe/London': { name: 'London', lat: 51.5074, lon: -0.1278 },
  'Europe/Paris': { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  'Europe/Berlin': { name: 'Berlin', lat: 52.52, lon: 13.405 },
  'Asia/Kolkata': { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  'Asia/Calcutta': { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  'Asia/Dubai': { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  'Asia/Singapore': { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  'Asia/Tokyo': { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  'Australia/Sydney': { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
};

// Map WMO Weather Codes to descriptive labels and icons
function getWeatherDetails(code: number, isDay: boolean): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgGradient: string;
} {
  switch (code) {
    case 0:
      return isDay
        ? { label: 'Clear Sky', icon: Sun, iconColor: 'text-amber-500', bgGradient: 'from-amber-500/10 to-orange-500/10' }
        : { label: 'Clear Night', icon: Moon, iconColor: 'text-indigo-400', bgGradient: 'from-indigo-500/10 to-blue-500/10' };
    case 1:
      return isDay
        ? { label: 'Mainly Clear', icon: Sun, iconColor: 'text-amber-500', bgGradient: 'from-amber-500/10 to-yellow-500/10' }
        : { label: 'Mainly Clear', icon: Moon, iconColor: 'text-indigo-400', bgGradient: 'from-indigo-500/10 to-blue-500/10' };
    case 2:
      return isDay
        ? { label: 'Partly Cloudy', icon: CloudSun, iconColor: 'text-amber-400', bgGradient: 'from-sky-500/10 to-amber-500/10' }
        : { label: 'Partly Cloudy', icon: CloudMoon, iconColor: 'text-indigo-300', bgGradient: 'from-slate-500/10 to-indigo-500/10' };
    case 3:
      return { label: 'Overcast', icon: Cloud, iconColor: 'text-slate-400 dark:text-slate-300', bgGradient: 'from-slate-500/10 to-gray-500/10' };
    case 45:
    case 48:
      return { label: 'Foggy', icon: CloudFog, iconColor: 'text-zinc-400', bgGradient: 'from-zinc-500/10 to-slate-500/10' };
    case 51:
    case 53:
    case 55:
      return { label: 'Light Drizzle', icon: CloudDrizzle, iconColor: 'text-sky-400', bgGradient: 'from-sky-500/10 to-blue-500/10' };
    case 61:
    case 63:
      return { label: 'Rain', icon: CloudRain, iconColor: 'text-blue-500', bgGradient: 'from-blue-500/10 to-indigo-500/10' };
    case 65:
      return { label: 'Heavy Rain', icon: CloudRain, iconColor: 'text-blue-600', bgGradient: 'from-blue-600/10 to-indigo-600/10' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Snowfall', icon: CloudSnow, iconColor: 'text-cyan-400', bgGradient: 'from-cyan-500/10 to-blue-500/10' };
    case 80:
    case 81:
    case 82:
      return { label: 'Rain Showers', icon: CloudRain, iconColor: 'text-blue-500', bgGradient: 'from-blue-500/10 to-sky-500/10' };
    case 85:
    case 86:
      return { label: 'Snow Showers', icon: CloudSnow, iconColor: 'text-cyan-300', bgGradient: 'from-cyan-500/10 to-indigo-500/10' };
    case 95:
    case 96:
    case 99:
      return { label: 'Thunderstorm', icon: CloudLightning, iconColor: 'text-amber-500', bgGradient: 'from-amber-500/15 to-purple-500/15' };
    default:
      return { label: 'Partly Cloudy', icon: CloudSun, iconColor: 'text-amber-400', bgGradient: 'from-sky-500/10 to-blue-500/10' };
  }
}

const STORAGE_CACHE_KEY = 'lifeos_current_weather_cache';
const SAVED_LOCATION_STORAGE_KEY = 'lifeos_user_saved_location';

interface SavedLocationData {
  lat: number;
  lon: number;
  cityName?: string;
  timestamp: number;
  isUserAllowed: boolean;
}

// Safely get user's previously permitted location
function getSavedUserLocation(): SavedLocationData | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number' && parsed.isUserAllowed) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export const CurrentWeatherWidget: React.FC<CurrentWeatherWidgetProps> = ({ soundEnabled = false }) => {
  const [weather, setWeather] = useState<WeatherData | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If cached less than 45 minutes ago and not default Mumbai when a saved location exists, use it
        if (Date.now() - parsed.timestamp < 45 * 60 * 1000) {
          const userSaved = getSavedUserLocation();
          if (!userSaved || !userSaved.cityName || parsed.cityName === userSaved.cityName) {
            return parsed;
          }
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!weather);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useFahrenheit, setUseFahrenheit] = useState<boolean>(() => {
    return localStorage.getItem('lifeos_weather_unit') === 'F';
  });

  // Toggle °C / °F
  const toggleUnit = () => {
    Sound.click(soundEnabled);
    const next = !useFahrenheit;
    setUseFahrenheit(next);
    localStorage.setItem('lifeos_weather_unit', next ? 'F' : 'C');
  };

  // Convert temperature
  const formatTemp = (celsius: number): string => {
    if (useFahrenheit) {
      const fahrenheit = Math.round((celsius * 9) / 5 + 32);
      return `${fahrenheit}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  // Fetch weather data from Open-Meteo external API (via proxy or direct)
  const fetchWeather = useCallback(async (lat: number, lon: number, locationName?: string, isUserGps = false) => {
    try {
      setErrorMsg(null);
      const queryParams = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;
      
      let data: any = null;

      // 1. Try local proxy endpoint first to bypass browser CORS / sandbox network blocks
      try {
        const proxyRes = await fetch(`/api/weather?${queryParams}`, { signal: AbortSignal.timeout(5000) });
        if (proxyRes.ok) {
          data = await proxyRes.json();
        }
      } catch {
        // Fallback to direct external Open-Meteo URL
      }

      // 2. Direct Open-Meteo endpoint fallback if proxy didn't resolve
      if (!data || !data.current) {
        try {
          const directRes = await fetch(`https://api.open-meteo.com/v1/forecast?${queryParams}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (directRes.ok) {
            data = await directRes.json();
          }
        } catch {
          // Direct fetch failed
        }
      }

      // 3. If neither worked, use cached weather if available or a graceful fallback
      if (!data || !data.current) {
        const cached = localStorage.getItem(STORAGE_CACHE_KEY);
        if (cached) {
          try {
            const cachedWeather: WeatherData = JSON.parse(cached);
            setWeather(cachedWeather);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
          } catch {
            // ignore cache parse error
          }
        }

        const fallbackWeather: WeatherData = {
          temperature: 24,
          apparentTemperature: 25,
          humidity: 55,
          windSpeed: 8,
          weatherCode: 1, // Mainly clear
          isDay: true,
          cityName: locationName || 'Local Weather',
          timestamp: Date.now(),
        };
        setWeather(fallbackWeather);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const current = data.current;

      let resolvedCity = locationName;
      if (!resolvedCity) {
        // Try reverse geocoding via Nominatim with short timeout
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            {
              headers: { 'Accept-Language': 'en' },
              signal: AbortSignal.timeout(2500),
            }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            resolvedCity = addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.state;
          }
        } catch {
          // Fallback to Open-Meteo timezone or coordinate city
        }
      }

      if (!resolvedCity && data.timezone) {
        const parts = data.timezone.split('/');
        resolvedCity = parts[parts.length - 1].replace(/_/g, ' ');
      }

      const finalCity = resolvedCity || 'My Location';

      // If this was from user device GPS or allowed location, permanently save it for future application visits!
      if (isUserGps) {
        try {
          const locToSave: SavedLocationData = {
            lat,
            lon,
            cityName: finalCity,
            timestamp: Date.now(),
            isUserAllowed: true,
          };
          localStorage.setItem(SAVED_LOCATION_STORAGE_KEY, JSON.stringify(locToSave));
        } catch (e) {
          console.warn('Failed to save user location to storage', e);
        }
      }

      const freshWeather: WeatherData = {
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        isDay: current.is_day === 1,
        cityName: finalCity,
        timestamp: Date.now(),
      };

      setWeather(freshWeather);
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(freshWeather));
    } catch (err: any) {
      console.warn('Weather fetch encountered an issue, keeping previous or fallback weather:', err?.message || err);
      // Ensure we don't display a broken widget
      if (!weather) {
        setWeather({
          temperature: 24,
          apparentTemperature: 25,
          humidity: 55,
          windSpeed: 8,
          weatherCode: 1,
          isDay: true,
          cityName: locationName || 'Local Weather',
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [weather]);

  // Request location from browser or use saved location from previous visits
  const requestLocationAndWeather = useCallback(() => {
    setIsRefreshing(true);

    const savedLoc = getSavedUserLocation();

    // 1. If user has previously allowed device location, use it immediately so it never reverts to Mumbai
    if (savedLoc) {
      fetchWeather(savedLoc.lat, savedLoc.lon, savedLoc.cityName, true);
    }

    // 2. Request current device location from browser to update coordinates
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Store and fetch with fresh GPS coordinates
          fetchWeather(latitude, longitude, undefined, true);
        },
        (geoError) => {
          console.warn('Geolocation denied or timed out:', geoError.message);
          // If we already loaded savedLoc, do nothing (keep saved user location!)
          if (!getSavedUserLocation()) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const fallback = TIMEZONE_CITY_MAP[tz] || {
              name: 'My Location',
              lat: 28.6139,
              lon: 77.209,
            };
            fetchWeather(fallback.lat, fallback.lon, fallback.name, false);
          } else {
            setIsRefreshing(false);
          }
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else if (!savedLoc) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const fallback = TIMEZONE_CITY_MAP[tz] || { name: 'My Location', lat: 28.6139, lon: 77.209 };
      fetchWeather(fallback.lat, fallback.lon, fallback.name, false);
    }
  }, [fetchWeather]);

  // Initial load
  useEffect(() => {
    if (!weather) {
      requestLocationAndWeather();
    }
  }, [weather, requestLocationAndWeather]);

  const handleManualRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    Sound.click(soundEnabled);
    requestLocationAndWeather();
  };

  if (isLoading && !weather) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs animate-pulse">
        <div className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-1">
          <div className="w-14 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" />
          <div className="w-20 h-2 rounded-sm bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <button
        type="button"
        onClick={handleManualRefresh}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors shadow-2xs"
        title="Click to load weather"
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        <span>{errorMsg || 'Load Weather'}</span>
        <RefreshCw className="w-3 h-3 text-gray-400 ml-1" />
      </button>
    );
  }

  const { label, icon: WeatherIcon, iconColor, bgGradient } = getWeatherDetails(
    weather.weatherCode,
    weather.isDay
  );

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs hover:shadow-xs transition-all select-none relative group bg-gradient-to-r ${bgGradient}`}
    >
      {/* Weather Condition Icon */}
      <div className="relative shrink-0 flex items-center justify-center">
        <WeatherIcon className={`w-6 h-6 ${iconColor} drop-shadow-xs transition-transform group-hover:scale-110`} />
      </div>

      {/* Weather Temperature & Condition */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleUnit}
            title="Click to toggle °C / °F"
            className="text-sm font-extrabold text-[#37352F] dark:text-white hover:text-[#6366F1] dark:hover:text-[#818CF8] transition-colors cursor-pointer"
          >
            {formatTemp(weather.temperature)}
          </button>
          <span className="text-[11px] font-semibold text-[#787774] dark:text-[#9CA3AF] truncate max-w-[95px] sm:max-w-[120px]">
            {label}
          </span>
        </div>

        {/* Location & Extra Stats */}
        <div className="flex items-center gap-2 text-[10px] text-[#787774] dark:text-[#9CA3AF]">
          <span className="flex items-center gap-0.5 truncate max-w-[85px] sm:max-w-[110px]" title={weather.cityName}>
            <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            <span className="truncate">{weather.cityName}</span>
          </span>
          <span className="hidden sm:inline-block text-gray-300 dark:text-gray-600">•</span>
          <span className="hidden sm:inline-flex items-center gap-0.5" title={`Humidity ${weather.humidity}%`}>
            <Droplets className="w-2.5 h-2.5 text-sky-400" />
            <span>{weather.humidity}%</span>
          </span>
        </div>
      </div>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={handleManualRefresh}
        title="Refresh current weather"
        className="p-1 rounded-lg text-gray-400 hover:text-[#6366F1] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ml-0.5"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#6366F1]' : ''}`} />
      </button>
    </div>
  );
};
