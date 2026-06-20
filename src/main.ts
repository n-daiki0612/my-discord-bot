import { CONFIG } from "./config.js";
import { CalendarService } from "./calendar.js";

type ModalComponent = {
  custom_id?: string;
  value?: string;
};

type ModalRow = {
  components?: ModalComponent[];
};

type GasProxyPayload = {
  proxyToken?: string;
  interaction?: {
    type?: number;
    data?: {
      name?: string;
      custom_id?: string;
      options?: unknown[];
      components?: ModalRow[];
    };
    member?: { user?: { username?: string } };
    user?: { username?: string };
  };
};

type FollowupMessage = {
  content: string;
  flags?: number;
};

function doGet(): GoogleAppsScript.Content.TextOutput {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "web app is alive" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(data: FollowupMessage): GoogleAppsScript.Content.TextOutput {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getInvokerName(payload: GasProxyPayload): string {
  return (
    payload.interaction?.member?.user?.username ??
    payload.interaction?.user?.username ??
    "unknown-user"
  );
}

function getModalValue(payload: GasProxyPayload, customId: string): string {
  const rows = payload.interaction?.data?.components ?? [];

  for (const row of rows) {
    const component = row.components?.find((item) => item.custom_id === customId);
    if (component?.value) return component.value;
  }

  throw new Error(`Missing modal value: ${customId}`);
}

function handleSlashCommand(payload: GasProxyPayload): FollowupMessage {
  const interaction = payload.interaction;
  const command = interaction?.data?.name;

  if (interaction?.type === 5 && interaction.data?.custom_id === "schedule_add_modal") {
    const calendarService = new CalendarService();
    const message = calendarService.createEventFromModal({
      title: getModalValue(payload, "title"),
      date: getModalValue(payload, "date"),
      startTime: getModalValue(payload, "startTime"),
      durationMinutes: Number(getModalValue(payload, "durationMinutes")),
    });

    return { content: message };
  }

  if (!command) {
    return { content: "No slash command name found.", flags: 64 };
  }

  if (command === "ping") {
    return { content: "pong from GAS" };
  }

  if (command === "whoami") {
    return { content: `You are ${getInvokerName(payload)}` };
  }

  if (command === "schedule") {
    const calendarService = new CalendarService();
    const message = calendarService.listUpcomingText();

    return { content: message };
  }

  return {
    content: `Unknown command: /${command}`,
    flags: 64,
  };
}

function doPost(
  e: GoogleAppsScript.Events.DoPost
): GoogleAppsScript.Content.TextOutput {
  try {
    const raw = e.postData?.contents ?? "{}";
    const payload = JSON.parse(raw) as GasProxyPayload;

    if (payload.proxyToken !== CONFIG.PROXY_TOKEN) {
      return jsonResponse({
        content: "Unauthorized proxy request.",
        flags: 64,
      });
    }

    const interactionType = payload.interaction?.type;

    if (!payload.interaction || interactionType === undefined || ![2, 5].includes(interactionType)) {
      return jsonResponse({
        content: "Unsupported interaction type.",
        flags: 64,
      });
    }

    if (payload.interaction.type === 5 && payload.interaction.data?.custom_id === "notify_setup_modal") {
      return jsonResponse(handleNotifySetupModal(payload));
    }

    return jsonResponse(handleSlashCommand(payload));
  } catch (error) {
    return jsonResponse({
      content: `GAS error: ${String(error)}`,
      flags: 64,
    });
  }
}

function message(): GoogleAppsScript.URL_Fetch.HTTPResponse {
  if (!CONFIG.DISCORD_WEBHOOK_URL) {
    throw new Error("Missing Script Property: DISCORD_WEBHOOK_URL");
  }

  return postDiscordWebhook(CONFIG.DISCORD_WEBHOOK_URL, "test");
}

function handleNotifySetupModal(payload: GasProxyPayload): FollowupMessage {
  const discordWebhookUrl = getModalValue(payload, "discordWebhookUrl").trim();
  const notifyTime = getModalValue(payload, "notifyTime").trim();

  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(discordWebhookUrl)) {
    return {
      content: "Invalid Discord Webhook URL.",
      flags: 64,
    };
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(notifyTime)) {
    return {
      content: "Notify time must be HH:mm, for example 08:00.",
      flags: 64,
    };
  }

  PropertiesService.getScriptProperties().setProperties({
    DISCORD_WEBHOOK_URL: discordWebhookUrl,
    NOTIFY_TIME: notifyTime,
  });

  setupDailyNotificationTrigger();

  return {
    content: "Notification settings saved.",
    flags: 64,
  };
}

function setupDailyNotificationTrigger(): void {
  const notifyTime = PropertiesService.getScriptProperties().getProperty("NOTIFY_TIME") || "08:00";
  const hour = Number(notifyTime.split(":")[0]);

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "sendDailyScheduleNotification")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("sendDailyScheduleNotification")
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
}

function sendDailyScheduleNotification(): void {
  const todaysdata = new CalendarService
  const todaysyotei = todaysdata.todayslist
  return {content:'本日の予定は\n${dodaysyotei}\nです'};
  


}

function postDiscordWebhook(
  url: string,
  content: string
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ content }),
  });
}

export function authorizeCalendar(): void {
  CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)?.getEventsForDay(new Date());
}

const gasGlobal = globalThis as typeof globalThis & {
  message: typeof message;
  doPost: typeof doPost;
  authorizeCalendar: typeof authorizeCalendar;
  sendDailyScheduleNotification: typeof sendDailyScheduleNotification;
};

gasGlobal.message = message;
gasGlobal.doPost = doPost;
gasGlobal.authorizeCalendar = authorizeCalendar;
gasGlobal.sendDailyScheduleNotification = sendDailyScheduleNotification;
