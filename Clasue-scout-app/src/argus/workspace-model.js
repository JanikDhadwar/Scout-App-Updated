export const destinations = [
  ["dashboard", "Dashboard"],
  ["match", "Match scouting"],
  ["assignments", "Assignments"],
  ["pit", "Pit scouting"],
  ["teams", "Teams"],
  ["matches", "Matches"],
  ["analytics", "Analytics"],
  ["analyst", "Scouting analyst"],
  ["practice", "Practice"],
  ["help", "Help"],
  ["history", "Event history"],
  ["reminders", "Reminders"],
  ["admin", "Admin control centre"],
  ["strategy", "Strategy"],
  ["display", "Pit display"],
  ["events", "Event data"],
  ["settings", "Settings"],
];
export const mainDestinations = [
  ["dashboard", "Home"],
  ["match", "Scouting"],
  ["assignments", "Assignments"],
  ["teams", "Teams"],
  ["settings", "Settings"],
];
export function navigationGroup(section) {
  if (["match", "pit", "assignments"].includes(section)) return "match";
  if (
    [
      "teams",
      "analytics",
      "reports",
      "compare",
      "present",
      "strategy",
    ].includes(section)
  )
    return "teams";
  if (["events", "matches", "display"].includes(section)) return "events";
  if (["settings", "news", "myteam", "manage", "sync", "admin", "help", "practice", "history", "reminders"].includes(section))
    return "settings";
  return "dashboard";
}
export const sectionLinks = {
  match: [
    ["match", "Match forms"],
    ["pit", "Pit forms"],
    ["assignments", "Assignments"],
  ],
  teams: [
    ["teams", "Team profiles"],
    ["analytics", "Analytics"],
    ["strategy", "Strategy"],
    ["reports", "Reports"],
  ],
  events: [
    ["events", "Event setup"],
    ["matches", "Match schedule"],
    ["display", "Pit display"],
  ],
  settings: [
    ["settings", "Settings"],
    ["events", "Events"],
    ["help", "Help"],
    ["myteam", "My team"],
    ["news", "Team news"],
    ["sync", "Device and sync"],
  ],
};
export const matchLabel = (match) =>
  match?.comp_level === "qm"
    ? `Qual ${match.match_number}`
    : match?.match_number
      ? `${match.comp_level || "Match"} ${match.match_number}`
      : match?.key || "Unlinked match";
export const isCompleted = (match) =>
  !!(match?.actual_time || match?.post_result_time) ||
  ["red", "blue"].some(
    (color) =>
      match?.alliances?.[color]?.score != null &&
      Number(match.alliances[color].score) >= 0,
  );
export function assignmentReports(assignment, reports = []) {
  return reports.filter(
    (report) =>
      report.team_id === assignment.team_id &&
      report.event_key === assignment.event_key &&
      report.user_id === assignment.scout_user_id &&
      String(report.scouted_team) === String(assignment.team_number) &&
      (assignment.report_kind === "pit"
        ? report.report_kind === "pit"
        : report.match_key === assignment.match_key &&
          report.report_kind !== "pit"),
  );
}
export function buildSearchIndex({
  data = {},
  event,
  workspaceId,
  userId,
  role,
} = {}) {
  const items = destinations.map(([route, label]) => ({
    group: "Pages",
    label,
    route: `/${route}`,
    text: label.toLowerCase(),
  }));
  const add = (group, label, route, detail = "") =>
    items.push({
      group,
      label,
      route,
      detail,
      text: `${label} ${detail}`.toLowerCase(),
    });
  (event?.event_teams || []).forEach((team) =>
    add(
      "Teams",
      `Team ${team.team_number}`,
      `/teams/${team.team_number}`,
      team.nickname || "",
    ),
  );
  (data.matches || []).forEach((match) =>
    add(
      "Matches",
      matchLabel(match),
      `/matches/${encodeURIComponent(match.key)}`,
      (match?.alliances?.red?.team_keys || [])
        .concat(match?.alliances?.blue?.team_keys || [])
        .join(" "),
    ),
  );
  (data.scout_events || [])
    .filter((row) => row.team_id === workspaceId)
    .forEach((row) =>
      add(
        "Events",
        row.event_name || row.event_key,
        `/events/${encodeURIComponent(row.id)}`,
        row.event_key,
      ),
    );
  (data.submissions || [])
    .filter(
      (row) =>
        row.team_id === workspaceId &&
        (role !== "member" || row.user_id === userId),
    )
    .forEach((row) =>
      add(
        "Reports",
        `${row.form_title || "Report"}${row.scouted_team ? ` / Team ${row.scouted_team}` : ""}`,
        `/reports/${encodeURIComponent(row.id)}`,
        `${row.match_key || ""} ${row.submitted_by || ""}`,
      ),
    );
  return items;
}
export function searchIndex(index, query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return index
    .filter((item) => terms.every((term) => item.text.includes(term)))
    .slice(0, 30);
}
