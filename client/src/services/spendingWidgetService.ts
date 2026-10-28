import { registerPlugin, Capacitor } from '@capacitor/core';
import { ExpenseItem } from '../types';
import {
  computeSpendingWidgetSnapshot,
  SpendingWidgetSnapshot,
} from '../utils/spendingWidgetCalculator';

export interface SpendingWidgetPluginInterface {
  syncSpendingData(options: {
    todayTotal: number;
    formattedTodayTotal: string;
    todayTrendText: string;
    todayTrendColor: string;
    todayTrendVisible: boolean;

    weekTotal: number;
    formattedWeekTotal: string;
    weekTrendText: string;
    weekTrendColor: string;
    weekTrendVisible: boolean;
  }): Promise<{ success: boolean }>;

  checkLaunchIntent(): Promise<{ openSpending: boolean }>;

  addListener(
    eventName: 'widgetOpenSpending',
    listenerFunc: (data: { openSpending: boolean }) => void
  ): Promise<any>;
}

const SpendingWidget = registerPlugin<SpendingWidgetPluginInterface>('SpendingWidget');

export const spendingWidgetService = {
  /**
   * Calculates latest spending metrics and pushes them to the native Android widget.
   */
  syncToNativeWidget: async (
    expenses: ExpenseItem[],
    currencySymbol: string = '₹'
  ): Promise<SpendingWidgetSnapshot | null> => {
    const snapshot = computeSpendingWidgetSnapshot(expenses, new Date(), currencySymbol);

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return snapshot;
    }

    try {
      await SpendingWidget.syncSpendingData({
        todayTotal: snapshot.todayTotal,
        formattedTodayTotal: snapshot.formattedTodayTotal,
        todayTrendText: snapshot.todayTrendText,
        todayTrendColor: snapshot.todayTrendColor,
        todayTrendVisible: snapshot.todayTrendVisible,

        weekTotal: snapshot.weekTotal,
        formattedWeekTotal: snapshot.formattedWeekTotal,
        weekTrendText: snapshot.weekTrendText,
        weekTrendColor: snapshot.weekTrendColor,
        weekTrendVisible: snapshot.weekTrendVisible,
      });
    } catch (e) {
      console.warn('[SpendingWidget] Native sync failed/unavailable:', e);
    }

    return snapshot;
  },

  /**
   * Checks if app was launched directly by tapping the Spending widget.
   */
  checkLaunchIntent: async (): Promise<{ openSpending: boolean }> => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return { openSpending: false };
    }
    try {
      return await SpendingWidget.checkLaunchIntent();
    } catch {
      return { openSpending: false };
    }
  },

  /**
   * Listens for runtime taps on the Spending widget while app is alive in background.
   */
  setupWidgetListener: (onOpen: () => void): (() => void) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return () => {};
    }
    try {
      const handle = SpendingWidget.addListener('widgetOpenSpending', (data) => {
        if (data?.openSpending) {
          onOpen();
        }
      });
      return () => {
        handle.then((h) => h?.remove?.()).catch(() => {});
      };
    } catch {
      return () => {};
    }
  },
};
