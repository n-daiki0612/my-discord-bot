import { CONFIG } from "./config.js";
export class CalendarService {
    private readonly calender: GoogleAppsScript.Calendar.Calendar;
    private readonly calendarID: string;



    constructor() {
        this.calendarID = CONFIG.CALENDAR_ID;
        const calendar = CalendarApp.getCalendarById(this.calendarID);
        if (!calendar) {
            throw new Error(`Calendar with ID ${this.calendarID} not found.`);
        }
        this.calender = calendar;
    }

    private eventsget(opts: { days?: number; maxResults?: number; now?: Date } = {})
        : GoogleAppsScript.Calendar.CalendarEvent[] {
        const {
            days = 7,
            maxResults = 10,
            now = new Date(),
        } = opts
        const start = now;
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        const max = maxResults;


        const events = this.calender.getEvents(start, end, { max: max });
        events.sort((a, b) => {
            return a.getStartTime().getTime() - b.getStartTime().getTime();
        });
        return events;


    }

    public todayslist(): string{
        const events = this.eventsget({ days: 1, maxResults:10})

        if(events.length === 0){
            return "今日の予定はありません";
        }

        return events
            .map((event) => {
                const start = Utilities.formatDate(
                    event.getStartTime(),
                    "Asia/Tokyo",
                    "yyyy/MM/dd HH:mm"
                );
                const title = event.getTitle();
                return `${start} ${title}`;
            })
            .join("\n");
         
    }


    public listUpcomingText(): string {
        const events = this.eventsget({ days: 7, maxResults: 10 });

        if (events.length === 0) {
            return "予定はありません";
        }
        return events
            .map((event) => {
                const start = Utilities.formatDate(
                    event.getStartTime(),
                    "Asia/Tokyo",
                    "yyyy/MM/dd HH:mm"
                );
                const title = event.getTitle();
                return `${start} ${title}`;
            })
            .join("\n");



    }

    public createEventFromModal(input: {
        title: string;
        date: string;
        startTime: string;
        durationMinutes: number;
    }): string {
        const start = new Date(`${input.date}T${input.startTime}:00+09:00`);
        const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

        const event = this.calender.createEvent(input.title, start, end);

        return `予定を追加しました: ${event.getTitle()}`;
    }




}