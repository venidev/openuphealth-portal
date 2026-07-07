// iCalendar export (PRODUCT_SCOPE "Calendar sync — busy/free only by default").
//
// PHI rule: events are BUSY blocks only. Patient names, reasons, or any
// clinical context must never appear in SUMMARY/DESCRIPTION — calendar
// providers (Google, Apple, Outlook) are not BAA-covered destinations.

export interface CalendarEvent {
  id: string;
  startsAt: Date;
  endsAt: Date;
  modality?: string | null;
  isFollowUp?: boolean;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildIcs(events: CalendarEvent[], calendarName = "OpenUp Health"): string {
  const now = icsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenUpHealth//Schedule//EN",
    `X-WR-CALNAME:${calendarName}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const ev of events) {
    const label = ev.isFollowUp ? "OpenUp session (follow-up)" : "OpenUp session";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@openuphealth.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(ev.startsAt)}`,
      `DTEND:${icsDate(ev.endsAt)}`,
      // Busy-only: generic title, no patient-identifying content.
      `SUMMARY:${label}`,
      `DESCRIPTION:${ev.modality === "in_person" ? "In person" : "Video"} session. Details in the OpenUp provider portal.`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
