import { google } from 'googleapis';
import { CONFIG } from '../config/index.js';

class GoogleCalendarService {
  constructor() {
    const { clientId, clientSecret, redirect } = CONFIG.google;
    this.oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirect
    );
    this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2Client });
  }

  generateAuthUrl() {
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly']
    });
  }

  async setCredentials(code) {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.oAuth2Client.setCredentials(tokens);
  }

  async listEvents() {
    const res = await this.calendar.events.list({
      calendarId: 'primary',
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });
    return res.data.items || [];
  }
}

export default GoogleCalendarService;
