import { ModuleAdapter, AIServiceContext, AIServiceResponse, SessionMemory } from '../types';
import { Storage } from '../../../utils/storage';
import { DayOfWeek, ScheduleActivity } from '../../../types';

export class ScheduleAdapter implements ModuleAdapter {
  name = 'schedule';

  canHandle(input: string, _context?: AIServiceContext): boolean {
    const text = input.trim().toLowerCase();
    return (
      text.includes('schedule') ||
      text.includes('routine') ||
      text.includes('calendar') ||
      text.includes('timetable') ||
      text === "today's schedule" ||
      text === 'my schedule'
    );
  }

  async handle(_input: string, context?: AIServiceContext): Promise<AIServiceResponse | null> {
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};
    const weeklySchedule = Storage.getSchedule();

    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[new Date().getDay()];
    const isWeekend = currentDay === 'saturday' || currentDay === 'sunday';

    let dayActivities: ScheduleActivity[] = [];
    const dayConfig = weeklySchedule.days?.[currentDay];
    if (dayConfig?.isCustomized && Array.isArray(dayConfig.activities) && dayConfig.activities.length > 0) {
      dayActivities = dayConfig.activities;
    } else if (isWeekend && Array.isArray(weeklySchedule.weekendTemplate) && weeklySchedule.weekendTemplate.length > 0) {
      dayActivities = weeklySchedule.weekendTemplate;
    } else if (Array.isArray(weeklySchedule.weekdayTemplate) && weeklySchedule.weekdayTemplate.length > 0) {
      dayActivities = weeklySchedule.weekdayTemplate;
    }

    if (dayActivities.length === 0) {
      return {
        reply: `You don't have any scheduled routine activities for today (**${currentDay.toUpperCase()}**). You can configure your daily time blocks in the Schedule module.`,
        module: 'schedule',
        actionChips: ['No schedule blocks', currentDay.toUpperCase()],
        updatedSessionMemory: memory,
      };
    }

    const listStr = dayActivities
      .slice(0, 6)
      .map((item) => `• **${item.time}** - ${item.title}`)
      .join('\n');

    return {
      reply: `Here is your scheduled routine for today (**${currentDay.toUpperCase()}**):\n${listStr}`,
      module: 'schedule',
      actionChips: [`${dayActivities.length} blocks today`, currentDay.toUpperCase()],
      updatedSessionMemory: memory,
    };
  }
}
