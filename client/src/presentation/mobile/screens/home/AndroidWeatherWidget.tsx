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

type LocationStatus = 'prompt' | 'requesting' | 'granted' | 'denied';

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

  // Check browser permission status if supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        ?.query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (status.state === 'granted') {
            setLocationStatus('granted');
            localStorage.setItem('lifeos_location_permitted', 'true');
            if (!weather) {
              void fetchWeatherWithCoords();
            }
          } else if (status.state === 'denied') {
            setLocationStatus('denied');
            localStorage.setItem('lifeos_location_permitted', 'false');
          }
        })
        .catch(() => {
          // Permissions API query not supported for geolocation on all runtimes
        });
    }
  }, []);

  const reverseGeocodeCity = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
        { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city =
          address.city ||
          address.town ||
          address.village ||
          address.suburb ||
          address.county ||
          address.state ||
          'Current Location';
        return city;
      }
    } catch {
      // Fallback
    }
    return 'Current Location';
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
      // Keep existing snapshot if network fails
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherWithCoords = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLoading(true);
    setLocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetchWeatherForPosition(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) {
          // Permission denied
          setLocationStatus('denied');
          localStorage.setItem('lifeos_location_permitted', 'false');
        } else {
          // Timeout or position unavailable
          if (weather?.lat && weather?.lon) {
            void fetchWeatherForPosition(weather.lat, weather.lon, weather.cityName);
          } else {
            setLocationStatus('denied');
          }
        }
      },
      { timeout: 7000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  };

  const handleRequestLocation = () => {
    void nativeService.triggerHaptic('selection');
    void fetchWeatherWithCoords();
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

  // 1. STATE: Location Permission Denied
  if (locationStatus === 'denied' && !weather) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-[#121826] dark:to-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-200/80 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
            <MapPinOff className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
              Location Access Needed
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
              Allow location to view your actual local weather
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={loading}
          className="px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Allow Location</span>
        </button>
      </div>
    );
  }

  // 2. STATE: Prompt for Location Permission (No incorrect New Delhi default)
  if (locationStatus === 'prompt' && !weather) {
    return (
      <div className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-2xs shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900 dark:text-white block">
              Live Weather
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
              Get real-time forecast for your device location
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={loading}
          className="px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5" />
          )}
          <span>Allow Location</span>
        </button>
      </div>
    );
  }

  // 3. STATE: Weather Loaded (With actual permitted location and small Allow/Update Location control)
  return (
    <div className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl p-3.5 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center shadow-2xs shrink-0">
          {getWeatherIcon()}
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              {weather ? `${weather.temperature}°C` : '--°C'}
            </span>
            <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
              {weather?.condition || (loading ? 'Detecting weather...' : 'Weather ready')}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 truncate max-w-[130px]">
              <MapPin className="w-3 h-3 text-violet-500 shrink-0" />
              <span className="truncate">{weather?.cityName || 'Current Location'}</span>
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

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={loading}
          aria-label="Allow / Update Location"
          title="Allow / Update Location"
          className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 hover:text-violet-600 active:scale-95 transition-all cursor-pointer shadow-2xs"
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin text-violet-600" />
          ) : (
            <Navigation className="w-3 h-3 text-violet-600 dark:text-violet-400" />
          )}
          <span>Allow Location</span>
        </button>

        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('click');
            if (weather?.lat && weather?.lon) {
              void fetchWeatherForPosition(weather.lat, weather.lon, weather.cityName);
            } else {
              void fetchWeatherWithCoords();
            }
          }}
          disabled={loading}
          aria-label="Refresh weather"
          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-600' : ''}`} />
        </button>
      </div>
    </div>
  );
};
