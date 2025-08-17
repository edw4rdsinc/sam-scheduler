// Vercel Serverless Function
// File: /api/schedule.js

const { google } = require('googleapis');

export default async function handler(request, response) {
    // --- SECURITY & CORS ---
    response.setHeader('Access-Control-Allow-Origin', '*'); // For production, restrict this to your domain
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(204).end();
    }

    // --- MAIN BOOKING LOGIC ---
    if (request.method === 'POST') {
        try {
            const { dateTime, name, email, duration, title } = request.body;

            // --- GOOGLE CALENDAR AUTHENTICATION ---
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            const calendarId = process.env.CALENDAR_ID;

            // Set up the JWT client for authentication with delegation
            const auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/calendar'],
                calendarId // **THIS IS THE NEW, CRUCIAL LINE** - Impersonate the calendar owner
            );

            const calendar = google.calendar({ version: 'v3', auth });

            // --- CREATE THE CALENDAR EVENT ---
            const eventStartTime = new Date(dateTime);
            const eventEndTime = new Date(eventStartTime.getTime() + duration * 60000);

            const event = {
                summary: `${title} with ${name}`,
                description: `Scheduled via your custom scheduling tool.\n\nAttendee Name: ${name}\nAttendee Email: ${email}`,
                start: {
                    dateTime: eventStartTime.toISOString(),
                    timeZone: 'America/Los_Angeles',
                },
                end: {
                    dateTime: eventEndTime.toISOString(),
                    timeZone: 'America/Los_Angeles',
                },
                attendees: [{ email: email }],
                conferenceData: {
                    createRequest: {
                        requestId: `booking-${Date.now()}`,
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet'
                        }
                    }
                }
            };

            const result = await calendar.events.insert({
                calendarId: calendarId,
                resource: event,
                conferenceDataVersion: 1,
            });

            // --- SEND SUCCESS RESPONSE ---
            return response.status(200).json({ message: 'Booking successful!', event: result.data });

        } catch (error) {
            console.error('Error creating calendar event:', error);
            return response.status(500).json({ message: 'Error creating event.', error: error.message });
        }
    } else {
        response.setHeader('Allow', ['POST', 'OPTIONS']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }
}

