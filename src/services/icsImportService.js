import ical from 'node-ical';
import Scheduler from './scheduler.js';

class ICSImportService {
  constructor(scheduler) {
    this.scheduler = scheduler;
  }

  async importFromBuffer(buffer, recipient) {
    const events = await ical.async.parseICS(buffer.toString());
    for (const key of Object.keys(events)) {
      const ev = events[key];
      if (ev.type === 'VEVENT') {
        await this.scheduler.insertSchedule({
          recipient,
          message: ev.summary || 'Evento',
          status: 'approved',
          scheduledTime: new Date(ev.start),
          expiryTime: new Date(ev.end || ev.start),
          sentAt: null,
          attempts: 0,
          lastAttemptAt: null
        });
      }
    }
  }
}

export default ICSImportService;
