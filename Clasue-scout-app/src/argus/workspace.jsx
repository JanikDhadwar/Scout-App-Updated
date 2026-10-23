import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { analyticsForData, formatValue } from "./analytics.js";
import { assignmentRoster } from './assignment-roster.js';
import {
  buildSearchIndex,
  destinations,
  mainDestinations,
  sidebarDestinations,
  navigationGroup,
  sectionLinks,
  searchIndex,
} from "./workspace-model.js";
import {
  Dashboard,
  MatchSchedule,
  TeamDirectory,
  ReportDetails,
  PitVisits,
} from "./workspace-pages.jsx";
import { EventData, MetricConfiguration } from "./operations.jsx";
import { ReportLibrary } from "./report-library.jsx";
import { SetupGuidance } from "./setup-guidance.jsx";
import { MobileMore, SectionTools } from './workspace-navigation.jsx';
import { PitDisplay, PitDisplaySettings } from "./restored-features.jsx";
import { offline } from "../offline.js";
import "./workspace.css";
import './upgrade.css';
import './mobile-workspace.css';
import { IntegrationSettings } from "./integration-settings.jsx";
import {Match13Settings} from './match13.jsx';
import { APP_VERSION } from "../app-version.js";
import { EventTransition } from "./event-transition.jsx";
import { HandoffInbox } from "./match-handoffs.jsx";
import { Walkthrough } from './walkthrough.jsx';
import ReminderSettings, { ReminderInbox } from './reminders.jsx';
import { OwnershipInbox } from './ownership-inbox.jsx';
const Strategy = lazy(() => import("./strategy.jsx"));
const Analyst = lazy(() => import("./analyst.jsx"));
const AssignmentHub = lazy(() => import('./assignment-hub.jsx'));
const AdminCentre = lazy(() => import('./admin-centre.jsx'));
const Practice = lazy(() => import('./practice.jsx'));
const Help = lazy(() => import('./help.jsx'));
const Evidence = lazy(() => import('./evidence.jsx'));
const EventHistory = lazy(()=>import('./history.jsx'));
const TeamProfile = lazy(() =>
  import("./analytics-views.jsx").then((m) => ({ default: m.TeamProfile })),
);
const TeamComparison = lazy(() =>
  import("./analytics-views.jsx").then((m) => ({ default: m.TeamComparison })),
);
const TeamPresentation = lazy(() =>
  import("./analytics-views.jsx").then((m) => ({
    default: m.TeamPresentation,
  })),
);
const stores = [
  "teams",
  "forms",
  "submissions",
  "scout_events",
  "memberships",
  "users",
  "announcements",
  "pit_scouts",
  "assignments",
  "picklists",
  "team_allocations",
];
const readRoute = () => {
  const raw = location.hash.slice(1) || "/dashboard";
  const [path, query = ""] = raw.split("?");
  return { path: path.startsWith("/") ? path : `/${path}`, query };
};
export function RouteIcon({ name }) {
  const paths = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    match: "M7 3h10v4H7zM5 5H3v16h18V5h-2M7 12h10M7 16h6",
    assignments: "M9 5h10v16H5V5h2M9 3h6v4H9zM8 12l2 2 4-4M8 18h8",
    pit: "m4 20 5-5m5-5 6-6M4 5l3-2 4 4-2 3 5 5 3-2 4 4-2 3-4-1-5-5-5-5z",
    teams:
      "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m9 1a4 4 0 0 1 0 7m1 4a4 4 0 0 1 3 4v2",
    matches: "M5 5h14v16H5zM8 3v4m8-4v4M5 10h14M9 14h2m2 3h2",
    analytics: "M4 3v18h17M8 17v-5m5 5V7m5 10V4",
    strategy: "M4 4h6v6H4zM14 14h6v6h-6zM7 10v7h7m0-10h6m-3-3 3 3-3 3",
    events: "M4 6h16v14H4zM8 3v6m8-6v6M4 11h16",
    settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
    search: "m16 16 5 5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
    more: "M4 12h1m6 0h1m6 0h1",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.more} />
    </svg>
  );
}
function SearchDialog({ index, onNavigate, dialogRef }) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () => searchIndex(index, deferred),
    [index, deferred],
  );
  return (
    <dialog
      ref={dialogRef}
      className="a-search-dialog"
      onClose={() => {
        setQuery("");
        setActive(0);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="a-search-content">
        <div className="a-row">
          <h2>Find in Argus</h2>
          <button
            className="a-button"
            onClick={() => dialogRef.current.close()}
          >
            Close
          </button>
        </div>
        <label className="a-search-field">
          Pages, teams, matches and reports
          <input
            className="a-input"
            autoFocus
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded="true"
            aria-activedescendant={
              results[active] ? `search-result-${active}` : undefined
            }
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                onNavigate(results[active].route);
                dialogRef.current.close();
              }
            }}
            placeholder="Search your team…"
          />
        </label>
        <p className="a-muted a-small">
          Use ↑ ↓ to choose, Enter to open, Escape to close.
        </p>
        <ul
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="a-search-results"
        >
          {results.map((result, i) => (
            <li
              key={`${result.route}:${i}`}
              id={`search-result-${i}`}
              role="option"
              aria-selected={i === active}
            >
              <a
                href={`#${result.route}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => dialogRef.current.close()}
              >
                <span>
                  <small>{result.group}</small>
                  <strong>{result.label}</strong>
                  <span className="a-muted">{result.detail}</span>
                </span>
                <span aria-hidden="true">↵</span>
              </a>
            </li>
          ))}
        </ul>
        {!results.length && (
          <p className="a-empty">No results. Try a team number or page name.</p>
        )}
      </div>
    </dialog>
  );
}
export default function ArgusWorkspace({
  workspace,
  user,
  role,
  api,
  syncState,
  shellReady,
  renderLegacy,
  onLogout,
  onSwitchWorkspace,
  onArchive,
  onDeactivate,
  needRefresh,
  onUpdate,
  onWorkspaceUpdate,
  onLeaveWorkspace,
}) {
  const [route, setRoute] = useState(readRoute),
    [data, setData] = useState({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [more, setMore] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem("argus:sidebar-hidden") === "true";
    } catch {
      return false;
    }
  });
  const [displayWorkspace, setDisplayWorkspace] = useState(null);
  const currentTeam =
    (data.teams || []).find((row) => row.id === workspace.id) || workspace;
  const effectiveWorkspace =
    displayWorkspace?.id === workspace.id
      ? {
          ...currentTeam,
          ...displayWorkspace,
          active_event_id: currentTeam.active_event_id,
        }
      : currentTeam;
  const toggleSidebar = () =>
    setSidebarHidden((current) => {
      try {
        localStorage.setItem("argus:sidebar-hidden", String(!current));
      } catch {
        /* Session preference only. */
      }
      return !current;
    });
  const [transitionId, setTransitionId] = useState("");
  const main = useRef(null),
    search = useRef(null);
  const request = useRef(0);
  const navigate = useCallback((path) => {
    location.hash = path;
    setMore(false);
  }, []);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    const results = await Promise.allSettled(
      stores.map((store) => api("GET", `/${store}`)),
    );
    if (version !== request.current) return;
    const next = {
      pendingReportIds: (await offline.pending()).map((entry) => entry.row.id),
    };
    const failed = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled")
        next[stores[i]] = Array.isArray(result.value) ? result.value : [];
      else if (![403].includes(result.reason?.status))
        failed.push(`${stores[i]}: ${result.reason?.message || "Unavailable"}`);
    });
    setData((previous) => ({ ...previous, ...next }));
    setError(failed.join(" "));
    setLoading(false);
  }, [api]);
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) refresh();
    });
    const listener = () => refresh();
    window.addEventListener("scout-report-saved", listener);
    window.addEventListener("argus-workspace-updated", listener);
    return () => {
      mounted = false;
      window.removeEventListener("scout-report-saved", listener);
      window.removeEventListener("argus-workspace-updated", listener);
    };
  }, [refresh]);
  useEffect(() => {
    const listener = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
      setMore(false);
      main.current?.focus();
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const listener = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (search.current.open) search.current.close();
        else search.current.showModal();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const events = useMemo(
    () =>
      (data.scout_events || []).filter(
        (row) => row.team_id === workspace.id && !row.data_cleared_at,
      ),
    [data, workspace.id],
  );
  const event = useMemo(
    () =>
      events.find((row) => row.id === effectiveWorkspace.active_event_id) ||
      null,
    [events, effectiveWorkspace.active_event_id],
  );
  const selectEvent = useCallback(
    (id) => {
      if (id === "__browse__") {
        navigate("/events");
        return;
      }
      if (id === event?.id) return;
      if (!["owner", "admin"].includes(role)) {
        setNotice("A team administrator can change the active event.");
        navigate("/events");
        return;
      }
      setTransitionId(id);
    },
    [event?.id, navigate, role],
  );
  useEffect(() => {
    if (!loading && route.path.startsWith("/events/")) {
      const target = decodeURIComponent(route.path.slice(8));
      if (target !== event?.id)
        Promise.resolve().then(() => selectEvent(target));
    }
  }, [route.path, event?.id, loading, selectEvent]);
  async function completeTransition(result) {
    onWorkspaceUpdate?.(result.team);
    setTransitionId("");
    navigate("/events");
    setNotice("Active event changed. All historical data was retained.");
    try {
      await offline.invalidateReadCache();
      await refresh();
    } catch {
      setNotice(
        "Event changed on the server. Reconnect to refresh this device. Local drafts and pending reports are kept.",
      );
    }
  }
  function cancelTransition() {
    setTransitionId("");
    if (route.path.startsWith("/events/")) navigate("/events");
  }

  const scoped = useMemo(
    () => ({
      ...data,
      ...Object.fromEntries(
        stores
          .filter((store) => store !== "users")
          .map((store) => [
            store,
            (data[store] || []).filter((row) => row.team_id === workspace.id),
          ]),
      ),
      matches: event?.matches || [],
    }),
    [data, event, workspace.id],
  );
  const localAnalytics = useMemo(
    () => analyticsForData({...scoped,submissions:(scoped.submissions||[]).filter(r=>!(scoped.pendingReportIds||[]).includes(r.id))}, workspace, event),
    [scoped, workspace, event],
  );
  const [sharedSummary,setSharedSummary]=useState(null);
  const summaryKey=`${user.id}:${workspace.id}:${event?.id||''}:${role}:${event?.sharing_revision||0}`;
  useEffect(()=>{let active=true;if(event)api('GET',`/events/${encodeURIComponent(event.id)}/analytics`).then(value=>{if(active)setSharedSummary({key:summaryKey,value});}).catch(()=>{/* Own downloaded evidence remains available offline. */});return()=>{active=false;};},[api,event,summaryKey,syncState.lastSync,scoped.submissions]);
  const analytics=sharedSummary?.key===summaryKey?sharedSummary.value:localAnalytics;
  useEffect(() => {
    if (syncState.lastSync || syncState.pending) refresh();
  }, [syncState.lastSync, syncState.pending, refresh]);
  const index = useMemo(
    () =>
      buildSearchIndex({
        data: scoped,
        event,
        workspaceId: workspace.id,
        userId: user.id,
        role,
      }),
    [scoped, event, workspace.id, user.id, role],
  );
  const [section, id] = route.path.slice(1).split("/");
  const params = new URLSearchParams(route.query);
  const selectedTeams = (params.get("teams") || "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .slice(0, 4);
  const openTeam = (number) => navigate(`/teams/${number}`),
    compare = (numbers) => navigate(`/compare?teams=${numbers.join(",")}`),
    present = (number) => navigate(`/present/${number}`),
    openReport = (reportId) =>
      navigate(`/${role==='member'?'evidence':'reports'}/${encodeURIComponent(reportId)}`);
  const common = {
    data: scoped,
    workspace: effectiveWorkspace,
    event,
    user,
    role,
    analytics,
    api,
    onRefresh: refresh,
    navigate,
  };
  async function addPicklist(number) {
    if (!event) {
      setNotice("Select an event before adding a team.");
      return;
    }
    if (role === "member") {
      navigate("/strategy");
      return;
    }
    try {
      const list = (data.picklists || []).find(
        (row) =>
          row.team_id === workspace.id && row.event_key === event.event_key,
      );
      if (
        list?.entries?.some((row) => Number(row.team_number) === Number(number))
      ) {
        setNotice(`Team ${number} is already on ${list.name}.`);
        return;
      }
      const row = list
        ? {
            ...list,
            entries: [
              ...(list.entries || []),
              { team_number: Number(number), note: "", review: false },
            ],
          }
        : {
            id: crypto.randomUUID(),
            team_id: workspace.id,
            event_key: event.event_key,
            name: "Alliance selection",
            entries: [{ team_number: Number(number), note: "", review: false }],
            revision: 0,
            created_by: user.id,
          };
      await api(
        list ? "PATCH" : "POST",
        list ? `/picklists/${encodeURIComponent(list.id)}` : "/picklists",
        row,
      );
      await refresh();
      setNotice(`Team ${number} added to ${row.name}.`);
    } catch (e) {
      setNotice(e.message || "Could not update the picklist.");
    }
  }
  async function exportTeam(format, number) {
    const team = analytics.teams.find(
      (row) => String(row.teamNumber) === String(number),
    );
    if (!team) throw new Error("Team not found.");
    const { exportTeamPresentation } = await import("./exports.js");
    await exportTeamPresentation(format, analytics, team);
  }
  const activeGroup = navigationGroup(section);
  const pageTitle =
    destinations.find(([key]) => key === section)?.[1] ||
    {
      compare: "Team comparison",
      present: "Team presentation",
      assignments: "Assignments",
      reports: "Report",
      news: "Team news",
      myteam: "My team",
      manage: "Team management",
      sync: "Device and sync",
    }[section] ||
    "Argus";
  let body;
  if (section === "teams" && id)
    body = (
      <TeamProfile
        api={api} workspaceId={workspace.id}
        assignedScout={['owner','admin'].includes(role)?assignmentRoster(scoped,event).teams.find(t=>t.number===Number(id))?.ownerName:undefined}
        analytics={analytics}
        teamNumber={id}
        onCompare={compare}
        onPresent={present}
        onPicklist={addPicklist}
        onOpenReport={openReport}
      />
    );
  else if (section === "teams")
    body = (
      <TeamDirectory
        api={api} workspaceId={workspace.id} season={event?.event_key?.slice(0,4)}
        analytics={analytics}
        onOpenTeam={openTeam}
        onCompare={compare}
      />
    );
  else if (section === "matches")
    body = (
      <MatchSchedule
        {...common}
        matchKey={id ? decodeURIComponent(id) : null}
        onOpenTeam={openTeam}
      />
    );
  else if (section === "match" || section === "pit")
    body = (
      <div className="a-stack">
        <header className="a-page-heading">
          <h1>{section === "match" ? "Match scouting" : "Pit scouting"}</h1>
          <p className="a-muted">
            {event
              ? `${event.event_name || event.event_key}. `
              : "Select an event to link new reports. "}
            Drafts save on this device as you work.
          </p>
        </header>
        {section === "pit" && <PitVisits {...common} />}{" "}
        {renderLegacy(section, {
          event_key: event?.event_key || "",
          ...Object.fromEntries(params),
        })}
      </div>
    );
  else if (section === "compare")
    body = (
      <TeamComparison
        analytics={analytics}
        teamNumbers={selectedTeams}
        onChange={compare}
        onOpenTeam={openTeam}
        onPresent={present}
      />
    );
  else if (section === "present")
    body = (
      <>
        <TeamDirectory
          api={api} workspaceId={workspace.id} season={event?.event_key?.slice(0,4)}
          analytics={analytics}
          onOpenTeam={openTeam}
          onCompare={compare}
        />
        <TeamPresentation
          analytics={analytics}
          teamNumber={id}
          onClose={() => openTeam(id)}
          onExport={exportTeam}
        />
      </>
    );
  else if (section === "strategy")
    body = (
      <Strategy
        key={`${workspace.id}:${event?.event_key}`}
        {...common}
        onOpenTeam={openTeam}
        onCompare={compare}
        onPresent={present}
      />
    );
  else if (section === "display")
    body = (
      <PitDisplay workspace={effectiveWorkspace} event={event} api={api} />
    );
  else if (section === "assignments") body = <AssignmentHub {...common} />;
  else if (section === 'admin') body = <AdminCentre key={`${workspace.id}:${event?.id}:${role}`} {...common} />;
  else if (section === 'practice') body = <Practice {...common} />;
  else if (section === 'help') body = <Help {...common} />;
  else if (section === 'evidence') body = <Evidence key={`${event?.id}:${id}`} {...common} reportId={decodeURIComponent(id||'')} />;
  else if (section === 'reminders') body = <ReminderSettings {...common} />;
  else if (section === 'history') body = <EventHistory {...common} />;
  else if (section === 'analyst') body = <div className="a-stack"><header><h1>Scouting analyst</h1><p className="a-muted">{analytics.evidenceScope||'Your authorized event evidence'}</p></header><Analyst api={api} workspaceId={workspace.id} eventKey={event?.event_key} analytics={analytics} onOpenTeam={openTeam} onCompare={compare} onOpenReport={openReport}/></div>;
  else if (section === "events")
    body = (
      <EventData {...common} />
    );
  else if (section === "analytics")
    body = (
      <div className="a-stack">
        <header className="a-page-heading">
          <h1>Analytics</h1>
          <p className="a-muted">
            Scouting evidence for {event?.event_name || "the selected event"}.
            Every calculation links back to reports.
          </p>
        </header>
        <div className="a-row">
          <button className="a-button a-primary" onClick={() => compare([])}>
            Compare teams
          </button>
          <a className="a-button" href="#/teams">
            Browse team profiles
          </a>
          <a className="a-button" href="#/reports">
            All reports and CSV export
          </a>
        </div>
        <section className="a-panel">
          <h2>Data coverage</h2>
          <div className="a-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Reports</th>
                  <th>Linked matches</th>
                  <th>Coverage</th>
                  <th>Disagreements</th>
                </tr>
              </thead>
              <tbody>
                {analytics.teams.map((team) => (
                  <tr key={team.teamNumber}>
                    <th>
                      <a href={`#/teams/${team.teamNumber}`}>
                        {team.teamNumber} {team.nickname}
                      </a>
                    </th>
                    <td>{team.reportCount}</td>
                    <td>{team.matchCount}</td>
                    <td>
                      {team.confidence.coveragePercent == null
                        ? "Unknown"
                        : `${formatValue(team.confidence.coveragePercent)}%`}
                    </td>
                    <td>{team.confidence.disagreements.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!analytics.teams.length && (
            <p className="a-empty">
              Import event teams or collect reports to see coverage.
            </p>
          )}
          <p className="a-muted a-small">
            Coverage counts completed official matches containing the team, with
            at least one linked report. Duplicate observations count once. An
            unavailable schedule means unknown coverage.
          </p>
        </section>
        <MetricConfiguration
          analytics={analytics}
          event={event}
          api={api}
          onRefresh={refresh}
          role={role}
        />
        <Analyst
          api={api}
          workspaceId={workspace.id}
          eventKey={event?.event_key}
          analytics={analytics}
          onOpenTeam={openTeam}
          onCompare={compare}
          onOpenReport={openReport}
        />
      </div>
    );
  else if (section === "reports" && !id)
    body = (
      <ReportLibrary
        key={`${workspace.id}:${event?.id}`}
        data={scoped}
        event={event}
        onOpenReport={openReport}
      />
    );
  else if (section === "reports")
    body = (
      <ReportDetails
        data={scoped}
        reportId={decodeURIComponent(id || "")}
        onOpenTeam={openTeam}
      />
    );
  else if (section === "settings")
    body = (
      <div className="a-stack">
        <header className="a-page-heading">
          <h1>Settings</h1>
          <p className="a-muted">Your team, account and this device.</p>
          <a className="a-button" href="#/welcome">About Argus</a>
        </header>
        <IntegrationSettings api={api} workspaceId={workspace.id} role={role} />
        <Match13Settings api={api} workspaceId={workspace.id} role={role}/>
        <section className="a-panel a-stack">
          <h2>{workspace.name || `Team ${workspace.number}`}</h2>
          <p>
            Signed in as <strong>{user.username}</strong> · {role}
          </p>
          {workspace.archived_at && (
            <p className="a-danger">
              This team is archived. Historical records are retained.
            </p>
          )}
          <div className="a-row">
            <a className="a-button" href="#/myteam">
              My team
            </a>
            <a className="a-button" href="#/news">
              Team news
            </a>
            <a className="a-button" href="#/assignments">
              Assignments
            </a>
            <a className="a-button" href="#/events">Events and history</a>
            <a className="a-button" href="#/history">Browse event history</a>
            <a className="a-button" href="#/help">Help and guide</a>
            <a className="a-button" href="#/reminders">Reminders and availability</a>
            {['owner','admin'].includes(role)&&<a className="a-button" href="#/admin">Admin control centre</a>}
            {role === "owner" && (
              <a className="a-button" href="#/manage">
                Manage members and forms
              </a>
            )}
            <button className="a-button" onClick={onSwitchWorkspace}>
              Switch team
            </button>
            <button className="a-button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </section>
        <section className="a-panel">
          <h2>Offline readiness</h2>
          <p>
            {shellReady && syncState.readyAt
              ? "App shell and downloaded team data are saved on this device."
              : "Open the app online and download your team data before going offline."}
          </p>
          <p className="a-muted">
            {syncState.pending} pending reports.{" "}
            {syncState.lastSync
              ? `Last confirmed sync: ${new Date(syncState.lastSync).toLocaleString()}.`
              : "No confirmed sync yet."}
          </p>
          <div className="a-row">
            <a className="a-button" href="#/sync">
              View reports and sync
            </a>
            <button className="a-button" onClick={refresh}>
              Refresh team data
            </button>
            {needRefresh && (
              <button className="a-button a-primary" onClick={onUpdate}>
                Install app update
              </button>
            )}
          </div>
        </section>
        <PitDisplaySettings
          key={effectiveWorkspace.id}
          workspace={effectiveWorkspace}
          role={role}
          api={api}
          onSaved={(saved) => {
            setDisplayWorkspace(saved);
            onWorkspaceUpdate?.(saved);
          }}
        />
        <details className="a-panel a-disclosure">
          <summary>Account controls</summary>
          <section>
            <h2>Account controls</h2>
            <div className="a-row">
              {role !== "owner" && (
                <button className="a-button" onClick={onLeaveWorkspace}>
                  Leave team
                </button>
              )}
              {role === "owner" && (
                <button className="a-button a-danger" onClick={onArchive}>
                  {workspace.archived_at ? "Restore team" : "Archive team"}
                </button>
              )}
              <button className="a-button a-danger" onClick={onDeactivate}>
                Deactivate my account
              </button>
            </div>
            <p className="a-muted a-small">
              Archiving retains historical records. Transfer ownership before
              deactivating an account that owns an active team.
            </p>
          </section>
        </details>
      </div>
    );
  else if (["news", "myteam", "manage", "sync"].includes(section))
    body =
      section === "manage" && role !== "owner" ? (
        <p className="a-empty">Team management is available to the owner.</p>
      ) : (
        renderLegacy(section, { event_key: event?.event_key || "" })
      );
  else
    body = (
      <Dashboard
        {...common}
        analytics={analytics}
        syncState={syncState}
        onOpenTeam={openTeam}
        onOpenReport={openReport}
      />
    );
  const syncText = syncState.syncing
    ? "Uploading reports…"
    : syncState.pending
      ? `${syncState.pending} pending upload`
      : syncState.connection === "online" && !syncState.error
        ? "Up to date"
        : syncState.connection === "offline"
          ? "Offline / saved on device"
          : "Checking connection";
  return (
    <div className={`argus-app${sidebarHidden ? " a-sidebar-hidden" : ""}`}>
      <a
        className="a-skip"
        href="#workspace-main"
        onClick={(e) => {
          e.preventDefault();
          main.current.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        className={`a-sidebar${more ? " is-open" : ""}`}
        id="workspace-navigation"
        aria-label="Team navigation"
      >
        <a href="#/dashboard" className="a-wordmark">
          Argus<span>Match and pit scouting</span>
        </a>
        <div className="a-workspace-name">
          <strong>{workspace.name || `Team ${workspace.number}`}</strong>
          <small>
            {user.username} · {role}
          </small>
        </div>
        <nav aria-label="Main navigation">
          {sidebarDestinations
            .map(([key, label]) => (
              <a
                key={key}
                title={label}
                href={`#/${key}`}
                aria-current={activeGroup === key ? "page" : undefined}
              >
                <RouteIcon name={key} />
                {label}
              </a>
            ))}
        </nav>
        <div className="a-sidebar-bottom">
          <button onClick={() => search.current.showModal()}>
            <RouteIcon name="search" />
            Find anything <kbd>⌘ K</kbd>
          </button>
          <small>Argus {APP_VERSION}</small>
        </div>
      </aside>
      <div className="a-workspace">
        <header className="a-topbar">
          <button
            className="a-button a-nav-toggle"
            aria-expanded={!sidebarHidden}
            aria-controls="workspace-navigation"
            onClick={toggleSidebar}
          >
            {sidebarHidden ? "Show menu" : "Hide menu"}
          </button>
          <div className="a-breadcrumb">
            <span>
              {workspace.number ? `Team ${workspace.number}` : "Team"}
            </span>
            <span aria-hidden="true">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="a-topbar-tools">
            <div className="a-event-select">
              <span className="a-muted a-small">
                {event?.event_name || "No active event"}
              </span>
            </div>
            <a
              href="#/sync"
              className={`a-sync ${syncState.connection === "offline" || syncState.error ? "is-offline" : ""}`}
            >
              <span aria-hidden="true" />
              {syncText}
            </a>
            <button
              className="a-search-trigger"
              aria-label="Search your team"
              onClick={() => search.current.showModal()}
            >
              <RouteIcon name="search" />
              <span>Search teams, matches…</span>
              <kbd>Ctrl K</kbd>
            </button>
          </div>
        </header>
        <main ref={main} id="workspace-main" tabIndex={-1} className="a-main">
          <HandoffInbox
            api={api}
            teamId={workspace.id}
            userId={user.id}
            navigate={navigate}
            showHistory={['dashboard','assignments','matches'].includes(section)}
          />
          <Walkthrough key={`${user.id}:${workspace.id}`} user={user} workspace={workspace} role={role} api={api} section={section}/>
          {['dashboard','settings'].includes(section)&&<OwnershipInbox api={api} workspace={workspace} user={user}/>}
          {['dashboard','assignments','reminders'].includes(section)&&<ReminderInbox api={api} workspace={workspace} navigate={navigate}/>}
          {needRefresh && (
            <div className="a-notice a-row" role="status">
              <span>
                A new Argus version is ready. Finish your current edit, then
                reload. Saved drafts and pending reports are kept.
              </span>
              <button className="a-button" onClick={onUpdate}>
                Load new version
              </button>
            </div>
          )}
          {notice && (
            <div className="a-notice a-row" role="status">
              <span>{notice}</span>
              <button className="a-button" onClick={() => setNotice("")}>
                Dismiss
              </button>
            </div>
          )}
          {error && (
            <div className="a-notice a-danger" role="alert">
              Some data could not be refreshed. {error}
              <button className="a-button" onClick={refresh}>
                Try again
              </button>
            </div>
          )}
          {syncState.error && (
            <div className="a-notice a-danger" role="alert">
              {syncState.error} <a href="#/sync">Review pending reports</a>
            </div>
          )}
          {!loading && (
            <>
              <SectionTools section={section} links={(sectionLinks[activeGroup] || []).filter(([key])=>key!=='admin'||['owner','admin'].includes(role))}/>
                {['dashboard','events','settings'].includes(section)&&<SetupGuidance
                key={`${user.id}:${workspace.id}`}
                userId={user.id}
                workspace={effectiveWorkspace}
                event={event}
                data={scoped}
                role={role}
                api={api}
                section={section}
                />}
            </>
          )}
          {loading ? (
            <div className="a-loading" role="status">
              Loading workspace…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="a-loading" role="status">
                  Opening {pageTitle.toLowerCase()}…
                </div>
              }
            >
              {body}
            </Suspense>
          )}
          <footer className="a-data-credit">
            Argus {APP_VERSION} · Powered by{" "}
            <a
              href="https://www.thebluealliance.com/"
              target="_blank"
              rel="noreferrer"
            >
              The Blue Alliance
            </a>
          </footer>
        </main>
      </div>
      <nav className="a-mobile-nav" aria-label="Mobile navigation">
        {["dashboard", "assignments", "match", "teams"].map((key) => (
          <a
            href={`#/${key}`}
            key={key}
            aria-current={(key==='assignments'?section==='assignments':key==='match'?['match','pit'].includes(section):activeGroup===key)?'page':undefined}
          >
            <RouteIcon name={key} />
            <span>{mainDestinations.find((row) => row[0] === key)[1]}</span>
          </a>
        ))}
        <button
          aria-expanded={more}
          aria-controls="mobile-more"
          aria-haspopup="dialog"
          onClick={() => setMore((value) => !value)}
        >
          <RouteIcon name="more" />
          More
        </button>
      </nav>
      <MobileMore open={more} onClose={()=>setMore(false)} role={role}/>
      <>
        {transitionId && (
          <EventTransition
            teamId={workspace.id}
            nextEventId={transitionId}
            api={api}
            pending={syncState.pending}
            onCancel={cancelTransition}
            onComplete={completeTransition}
          />
        )}
      </>
      <SearchDialog index={index} onNavigate={navigate} dialogRef={search} />
    </div>
  );
}
