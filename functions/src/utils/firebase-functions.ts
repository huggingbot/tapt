import { ScheduleFunction, ScheduledEvent, onSchedule } from 'firebase-functions/v2/scheduler';

export type TScheduleHandler = (event: ScheduledEvent) => Promise<void>;

// reference: https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules
// each asterik represents one time unit, i.e. minute hour
const SCHEDULE = 'every 1 mins'; // runs every minute

export function createScheduleFunction(handler: TScheduleHandler): ScheduleFunction {
  return onSchedule(SCHEDULE, handler);
}
