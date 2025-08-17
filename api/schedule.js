 // Vercel Serverless Function
// File: /api/schedule.js

// Import the Google APIs library. You'll need to add this to your project.
// In your project's package.json, add: { "dependencies": { "googleapis": "^126.0.1" } }
const { google } = require('googleapis');

// This is the main function that Vercel will run.
export default async function handler(request, response) {
    // --- SECURITY & CORS ---
    // This allows your frontend (running on Vercel) to talk to this API function.
    response.setHeader('Access-Control-Allow-Origin', '*'); // For production, restrict this to your domain: 'https://www.edw4rds.com'
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // The browser sends a "preflight" OPTIONS request to ask for permission.
    // We need to respond with a success code (204 No Content).
    if (request.method === 'OPTIONS') {
        return response.status(204).end();
    }

    // --- MAIN BOOKING LOGIC ---
    // We only process POST requests, which contain the booking data.
    if (request.method === 'POST') {
        try {
            // 1. Get the booking details from the frontend.
            const { dateTime, name, email, duration, title } = request.body;

            // --- GOOGLE CALENDAR AUTHENTICATION ---
            // 2. Securely load credentials from Vercel Environment Variables.
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            const calendarId = process.env.CALENDAR_ID;

            // 3. Set up the JWT client for server-to-server authentication.
            const auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/calendar']
            );

            const calendar = google.calendar({ version: 'v3', auth });

            // --- CREATE THE CALENDAR EVENT ---
            // 4. Calculate the event start and end times.
            const eventStartTime = new Date(dateTime);
            const eventEndTime = new Date(eventStartTime.getTime() + duration * 60000); // duration is in minutes

            // 5. Define the event details.
            const event = {
                summary: `${title} with ${name}`,
                description: `Scheduled via your custom scheduling tool.\n\nAttendee Name: ${name}\nAttendee Email: ${email}`,
                start: {
                    dateTime: eventStartTime.toISOString(),
                    timeZone: 'America/Los_Angeles', // This can be made dynamic later if needed
                },
                end: {
                    dateTime: eventEndTime.toISOString(),
                    timeZone: 'America/Los_Angeles',
                },
                // 6. Add the person who booked as an attendee to send them an official invite.
                attendees: [{ email: email }],
                // 7. Automatically generate a Google Meet link for the event.
                conferenceData: {
                    createRequest: {
                        requestId: `booking-${Date.now()}`,
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet'
                        }
                    }
                }
            };

            // 8. Insert the event into your Google Calendar.
            const result = await calendar.events.insert({
                calendarId: calendarId,
                resource: event,
                conferenceDataVersion: 1, // Required to generate the Google Meet link
            });

            // --- SEND SUCCESS RESPONSE ---
            // 9. If everything worked, send a success message back to the frontend.
            return response.status(200).json({ message: 'Booking successful!', event: result.data });

        } catch (error) {
            // If anything goes wrong, log the error for debugging and send a server error response.
            console.error('Error creating calendar event:', error);
            return response.status(500).json({ message: 'Error creating event.', error: error.message });
        }
    } else {
        // If the request is not a POST, respond with a "Method Not Allowed" error.
        response.setHeader('Allow', ['POST', 'OPTIONS']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }
}
