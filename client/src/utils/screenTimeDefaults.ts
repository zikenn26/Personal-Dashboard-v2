import { ScreenTimeData, AppUsageItem, HourlyUsageBucket, DailyUsageSummary } from '../types';
import { getLocalDateString, shiftLocalDateString } from './screenTimeCalculator';

/**
 * Generates realistic baseline screen time data for non-native platforms
 * (Web browser and Android Chrome) so that stats and interactive charts
 * are immediately visible and testable prior to / alongside native APK sync.
 */
export function getBaselineScreenTimeData(targetDate?: string): ScreenTimeData {
  const dateStr = targetDate || getLocalDateString();
  const dateObj = new Date(dateStr + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const apps: AppUsageItem[] = [
    {
      packageName: 'com.instagram.android',
      appName: 'Instagram',
      rank: 1,
      durationMinutes: 74,
      durationMillis: 74 * 60 * 1000,
      sessionCount: 15,
      percentageOfTotal: 34,
      category: 'Social',
      isSystemApp: false,
    },
    {
      packageName: 'com.google.android.youtube',
      appName: 'YouTube',
      rank: 2,
      durationMinutes: 52,
      durationMillis: 52 * 60 * 1000,
      sessionCount: 9,
      percentageOfTotal: 24,
      category: 'Entertainment',
      isSystemApp: false,
    },
    {
      packageName: 'com.whatsapp',
      appName: 'WhatsApp',
      rank: 3,
      durationMinutes: 41,
      durationMillis: 41 * 60 * 1000,
      sessionCount: 24,
      percentageOfTotal: 19,
      category: 'Communication',
      isSystemApp: false,
    },
    {
      packageName: 'com.android.chrome',
      appName: 'Chrome',
      rank: 4,
      durationMinutes: 28,
      durationMillis: 28 * 60 * 1000,
      sessionCount: 11,
      percentageOfTotal: 13,
      category: 'Productivity',
      isSystemApp: false,
    },
    {
      packageName: 'com.spotify.music',
      appName: 'Spotify',
      rank: 5,
      durationMinutes: 15,
      durationMillis: 15 * 60 * 1000,
      sessionCount: 6,
      percentageOfTotal: 7,
      category: 'Music & Audio',
      isSystemApp: false,
    },
    {
      packageName: 'com.android.settings',
      appName: 'Settings',
      rank: 6,
      durationMinutes: 8,
      durationMillis: 8 * 60 * 1000,
      sessionCount: 4,
      percentageOfTotal: 3,
      category: 'System',
      isSystemApp: true,
    },
  ];

  const totalMinutes = apps.reduce((sum, a) => sum + a.durationMinutes, 0);

  // Hourly distribution over 24 hours
  const hourlyMinutesPattern = [
    0, 0, 0, 0, 0, 0,     // 12 AM - 5 AM: sleep
    4, 18, 26, 14, 16, 20, // 6 AM - 11 AM: morning routine & work
    28, 12, 10, 14, 16, 22, // 12 PM - 5 PM: lunch & afternoon
    26, 32, 28, 14, 0, 0,   // 6 PM - 11 PM: evening leisure
  ];

  const hourlyUsage: HourlyUsageBucket[] = hourlyMinutesPattern.map((mins, h) => ({
    hour: h,
    label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
    durationMinutes: mins,
    durationMillis: mins * 60 * 1000,
  }));

  // Past 7 days baseline
  const past7DaysTotals = [195, 220, 210, 245, 230, 260, totalMinutes];
  const instagram7Days = [65, 72, 80, 58, 85, 70, 74];
  const youtube7Days = [48, 55, 45, 62, 50, 68, 52];
  const whatsapp7Days = [38, 42, 35, 46, 40, 48, 41];
  const chrome7Days = [25, 30, 28, 35, 32, 40, 28];
  const spotify7Days = [12, 14, 15, 20, 15, 18, 15];
  const settings7Days = [7, 7, 7, 14, 8, 16, 8];

  const past7Days: DailyUsageSummary[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const dStr = shiftLocalDateString(dateStr, -i);
    const dObj = new Date(dStr + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    const index = 6 - i;
    const dayTotal = past7DaysTotals[index] ?? totalMinutes;

    past7Days.push({
      date: dStr,
      dayOfWeek,
      totalMinutes: dayTotal,
      totalMillis: dayTotal * 60 * 1000,
      isToday: i === 0,
      appMinutes: {
        'com.instagram.android': instagram7Days[index] ?? 74,
        'com.google.android.youtube': youtube7Days[index] ?? 52,
        'com.whatsapp': whatsapp7Days[index] ?? 41,
        'com.android.chrome': chrome7Days[index] ?? 28,
        'com.spotify.music': spotify7Days[index] ?? 15,
        'com.android.settings': settings7Days[index] ?? 8,
      },
    });
  }

  const weeklySum = past7Days.reduce((acc, d) => acc + d.totalMinutes, 0);
  const dailyAverageMinutes = Math.round(weeklySum / past7Days.length);

  return {
    granted: true,
    isNativeAndroid: false,
    hasData: true,
    date: dateStr,
    formattedDate,
    totalMinutes,
    totalMillis: totalMinutes * 60 * 1000,
    apps,
    topApps: apps.slice(0, 3),
    hourlyUsage,
    past7Days,
    dailyAverageMinutes,
    lastSyncedTimestamp: Date.now(),
    dataSource: 'synced',
  };
}
