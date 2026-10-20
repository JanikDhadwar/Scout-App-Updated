import { useCallback, useEffect, useRef, useState } from "react";
import { isCompleted, matchLabel } from "./workspace-model.js";

export function PitDisplaySettings({ workspace, role, api, onSaved }) {
  const [number, setNumber] = useState(
      workspace.frc_team_number || workspace.number || "",
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api(
        "PATCH",
        `/teams/${encodeURIComponent(workspace.id)}`,
        { frc_team_number: number.trim() },
      );
      onSaved(saved);
      setMessage("Pit display team saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="a-panel a-stack">
      <h2>Pit display</h2>
      <form onSubmit={save} className="a-row">
        <label>
          Display team number
          <input
            className="a-input"
            inputMode="numeric"
            pattern="[0-9]+"
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            disabled={role !== "owner" || busy}
          />
        </label>
        {role === "owner" && (
          <button className="a-button" disabled={busy}>
            Save display team
          </button>
        )}
        <a className="a-button" href="#/display">
          Open pit display
        </a>
      </form>
      <p className="a-muted">
        Enter the team you want to follow, then choose Save display team. This
        can be any team at the selected event. Open Pit display when you are
        ready.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function PitDisplay({ workspace, event, api }) {
  const [live, setLive] = useState(null),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState(null),
    [stream, setStream] = useState("0"),
    [full, setFull] = useState(false);
  const eventKey = event?.event_key;
  const root = useRef(null),
    refreshRef = useRef(null),
    number = String(workspace.frc_team_number || workspace.number || "");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [info, matches] = await Promise.all([
          api("GET", `/tba/event/${encodeURIComponent(eventKey)}`),
          api("GET", `/tba/event/${encodeURIComponent(eventKey)}/matches`),
        ]);
        if (!Array.isArray(matches))
          throw new Error("The official schedule is unavailable.");
        if (active) {
          setLive({ info, matches });
          setError("");
          setUpdated(new Date());
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    refreshRef.current = refresh;
    if (eventKey) refresh();
    const timer = eventKey ? setInterval(refresh, 30000) : null;
    return () => {
      active = false;
      clearInterval(timer);
      refreshRef.current = null;
    };
  }, [api, eventKey]);
  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const current = live?.info?.key === event?.event_key ? live : null;
  const schedule = current?.matches || event?.matches || [];
  const teamScheduled = schedule.some((match) =>
    ["red", "blue"].some((color) =>
      (match.alliances?.[color]?.team_keys || []).includes(`frc${number}`),
    ),
  );
  const matches = (current?.matches || event?.matches || [])
    .filter(
      (match) =>
        !isCompleted(match) &&
        ["red", "blue"].some((color) =>
          (match.alliances?.[color]?.team_keys || []).includes(`frc${number}`),
        ),
    )
    .sort(
      (a, b) =>
        (a.predicted_time || a.time || Infinity) -
          (b.predicted_time || b.time || Infinity) ||
        a.match_number - b.match_number,
    );
  const streams = (current?.info?.webcasts || event?.webcasts || []).filter(
    (row) => ["youtube", "twitch"].includes(row.type),
  );
  const selected = streams[Number(stream)] || streams[0];
  let src = "",
    link = "";
  if (selected?.type === "youtube" && /^[\w-]+$/.test(selected.channel || "")) {
    const id = selected.channel;
    src =
      id.length === 11
        ? `https://www.youtube.com/embed/${id}?rel=0`
        : `https://www.youtube.com/embed/live_stream?channel=${id}`;
    link =
      id.length === 11
        ? `https://www.youtube.com/watch?v=${id}`
        : `https://www.youtube.com/channel/${id}/live`;
  }
  if (selected?.type === "twitch" && /^\w+$/.test(selected.channel || "")) {
    src = `https://player.twitch.tv/?channel=${selected.channel}&parent=${location.hostname}&autoplay=false`;
    link = `https://www.twitch.tv/${selected.channel}`;
  }
  if (!event)
    return (
      <section className="a-panel a-stack">
        <h1>Pit display</h1>
        <h2>Choose an event first</h2>
        <p>
          Open Event setup, choose a season and select any competition. Then
          return here for the livestream and upcoming matches.
        </p>
        <a className="a-button a-primary" href="#/events">
          Choose an event
        </a>
        <p className="a-muted">
          You can watch an event even when your team is not competing.
        </p>
      </section>
    );
  return (
    <div ref={root} className="a-stack a-pit-display">
      <header className="a-row">
        <div className="a-grow">
          <h1>Pit display: Team {number}</h1>
          <p className="a-muted">{event?.event_name || "Select an event"}</p>
        </div>
        <button
          className="a-button"
          onClick={() => refreshRef.current?.()}
          disabled={!event}
        >
          Refresh display
        </button>
        <button
          className="a-button"
          onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else await root.current.requestFullscreen();
            } catch {
              setError("Full screen is unavailable in this browser.");
            }
          }}
        >
          {full ? "Exit full screen" : "Full screen"}
        </button>
        <a className="a-button" href="#/settings">
          Display settings
        </a>
      </header>
      {error && (
        <p className="a-notice" role="status">
          {error} Showing the last downloaded schedule.
        </p>
      )}
      <div className="a-pit-display-grid">
        <section className="a-panel a-stack">
          <h2>Event livestream</h2>
          {streams.length > 1 && (
            <label>
              Stream
              <select
                aria-label="Stream"
                className="a-input"
                value={stream}
                onChange={(e) => setStream(e.target.value)}
              >
                {streams.map((row, i) => (
                  <option value={i} key={`${row.type}:${row.channel}`}>
                    {row.type}: {row.channel}
                  </option>
                ))}
              </select>
            </label>
          )}
          {src ? (
            <>
              <iframe
                className="a-stream-frame"
                title="Event livestream"
                src={src}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
              <a href={link} target="_blank" rel="noreferrer">
                Open stream in a new tab
              </a>
            </>
          ) : (
            <p className="a-empty">
              This event has no listed YouTube or Twitch stream. Try Refresh
              display or check again closer to the event. You can also choose
              another event in Event setup.
            </p>
          )}
        </section>
        <section className="a-panel a-stack">
          <h2>Upcoming matches</h2>
          <div
            className="a-table-wrap"
            role="region"
            aria-label="Team upcoming matches"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Time</th>
                  <th>Alliances</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 10).map((match) => (
                  <tr key={match.key}>
                    <th>{matchLabel(match)}</th>
                    <td>
                      {match.predicted_time || match.time
                        ? new Date(
                            (match.predicted_time || match.time) * 1000,
                          ).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Time unknown"}
                    </td>
                    <td>
                      {["red", "blue"].map((color) => (
                        <div key={color} className={`a-alliance-${color}`}>
                          {color === "red" ? "Red" : "Blue"}:{" "}
                          {(match.alliances?.[color]?.team_keys || [])
                            .map((key) => key.replace(/^frc/, ""))
                            .join(", ")}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!matches.length && (
            <p className="a-empty">
              {!schedule.length
                ? "The match schedule has not been downloaded or published yet. Open Event setup and refresh official event data."
                : !teamScheduled
                  ? `Team ${number} is not in this event’s schedule. You can still watch its livestream. Change the display team in Settings to follow a team that is competing.`
                  : "This team has no remaining matches in the downloaded schedule."}
            </p>
          )}
          <p className="a-muted a-small">
            Refreshes every 30 seconds.{" "}
            {updated
              ? `Last received ${updated.toLocaleTimeString()}.`
              : event?.official_fetched_at
                ? `Downloaded ${new Date(event.official_fetched_at).toLocaleString()}.`
                : "No live update received yet."}
          </p>
        </section>
      </div>
    </div>
  );
}

export function OfficialEventPicker({ workspace, api, onRefresh, navigate }) {
  const [year, setYear] = useState(String(new Date().getFullYear())),
    [events, setEvents] = useState([]),
    [chosen, setChosen] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [teamOnly, setTeamOnly] = useState(false),
    [failed, setFailed] = useState(false);
  const request = useRef(0),
    teamNumber = workspace.frc_team_number || workspace.number;
  const load = useCallback(async () => {
    const version = ++request.current;
    if (!/^\d{4}$/.test(year)) {
      setEvents([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    setMessage("");
    setFailed(false);
    setChosen("");
    try {
      const endpoint = teamOnly
        ? `/tba/team/frc${teamNumber}/events/${year}/simple`
        : `/tba/events/${year}/simple`;
      const rows = await api("GET", endpoint);
      if (!Array.isArray(rows))
        throw new Error(
          "The event list could not be read. Try loading it again.",
        );
      if (version === request.current) {
        setEvents(
          [...rows].sort(
            (a, b) =>
              String(a.start_date || "").localeCompare(
                String(b.start_date || ""),
              ) || String(a.name).localeCompare(String(b.name)),
          ),
        );
        if (!rows.length)
          setMessage(
            "No events found for these filters. Try another season or turn off the team filter.",
          );
      }
    } catch (error) {
      if (version === request.current) {
        setFailed(true);
        setEvents([]);
        setMessage(
          `${error.message} Open Settings to check the Blue Alliance connection, then choose Load events to retry.`,
        );
      }
    } finally {
      if (version === request.current) setBusy(false);
    }
  }, [api, year, teamOnly, teamNumber]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = events.filter((row) =>
    terms.every((term) =>
      [
        row.name,
        row.key,
        row.event_code,
        row.city,
        row.state_prov,
        row.country,
        row.district?.display_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    ),
  );
  async function select() {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const existing = await api(
        "GET",
        `/scout_events?team_id=${encodeURIComponent(workspace.id)}`,
      );
      const found = existing.find((row) => row.event_key === chosen);
      if (found) {
        navigate(`/events/${encodeURIComponent(found.id)}`);
        setMessage("Review the event change before continuing.");
        return;
      }
      const [teams, matches, info] = await Promise.all([
        api("GET", `/tba/event/${chosen}/teams/simple`),
        api("GET", `/tba/event/${chosen}/matches`),
        api("GET", `/tba/event/${chosen}`),
      ]);
      if (!Array.isArray(teams) || !Array.isArray(matches))
        throw new Error("Official data is incomplete. No event was added.");
      const saved = await api("POST", "/scout_events", {
        id: crypto.randomUUID(),
        team_id: workspace.id,
        event_key: chosen,
        event_name:
          info.name || events.find((row) => row.key === chosen)?.name || chosen,
        event_teams: teams,
        matches,
        webcasts: info.webcasts || [],
        official_fetched_at: new Date().toISOString(),
      });
      await onRefresh();
      navigate(`/events/${encodeURIComponent(saved.id)}`);
      setMessage("Event added. Review the event change before continuing.");
    } catch (error) {
      setFailed(true);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="a-panel a-stack a-event-browser" aria-busy={busy}>
      <h2>Choose any event</h2>
      <p className="a-muted">
        Choose a season, search by event name or location, then select an event.
        Your team does not have to be attending. Changing the active event
        preserves all outgoing event data and forms.
      </p>
      <div className="a-row">
        <label>
          Season year
          <input
            className="a-input"
            type="number"
            min="1992"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="a-button"
          disabled={busy || !/^\d{4}$/.test(year)}
          onClick={load}
        >
          {busy ? "Loading events…" : "Load events"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={teamOnly}
            onChange={(e) => setTeamOnly(e.target.checked)}
          />{" "}
          Only events with Team {teamNumber}
        </label>
      </div>
      <label>
        Find event
        <input
          className="a-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, city, region or event key"
        />
      </label>
      {events.length > 0 && (
        <>
          <p className="a-muted a-small" role="status">
            {visible.length} of {events.length} events match.
          </p>
          <label>
            Official event
            <select
              aria-label="Official event"
              className="a-input"
              value={visible.some((row) => row.key === chosen) ? chosen : ""}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="">Choose an event</option>
              {visible.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.name}
                  {row.city ? ` — ${row.city}` : ""}
                  {row.start_date ? ` (${row.start_date})` : ""} [{row.key}]
                </option>
              ))}
            </select>
          </label>
          <button
            className="a-button a-primary"
            disabled={busy || !visible.some((row) => row.key === chosen)}
            onClick={select}
          >
            Select official event
          </button>
          {!visible.length && (
            <p className="a-help">
              No events match that search. Clear the search or try a different
              season.
            </p>
          )}
        </>
      )}
      {message && (
        <div className="a-help" role="status">
          <p>{message}</p>
          {failed && (
            <a className="a-button" href="#/settings">
              Connection settings
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function RandomAssignments({ data, workspace, event, api, onRefresh }) {
  const members = data.memberships || [],
    forms = (data.forms || []).filter(
      (row) => !row.archived && !row.archived_at,
    );
  const [kind, setKind] = useState("pit"),
    [formId, setFormId] = useState(""),
    [scouts, setScouts] = useState(() =>
      members
        .filter(
          (row) =>
            row.team_id === workspace.id &&
            !(event?.excluded || []).includes(row.user_id),
        )
        .map((row) => row.user_id),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const available = forms.filter((row) => (row.kind || "match") === kind);
  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("POST", "/assignments/generate", {
        event_id: event.id,
        report_kind: kind,
        form_id: formId,
        scout_ids: scouts,
        assignment_revision: event.assignment_revision || 0,
      });
      setMessage(
        `${result.added} new ${kind} assignments saved. Existing assignments were retained.`,
      );
      await onRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={generate} className="a-stack">
      <h3>Randomly assign event teams</h3>
      <p className="a-muted">
        Pit scouting splits event teams evenly. Match scouting covers each robot
        in upcoming matches and needs enough selected scouts for simultaneous
        robots (normally six). Generation fills gaps and preserves saved
        assignments. Scout exclusions are saved when you generate; the
        whole-team button includes everyone again.
      </p>
      <div className="a-row">
        <label>
          Assignment type
          <select
            aria-label="Assignment type"
            className="a-input"
            value={kind}
            disabled={busy}
            onChange={(e) => {
              setKind(e.target.value);
              setFormId("");
            }}
          >
            <option value="pit">Pit scouting</option>
            <option value="match">Match scouting</option>
          </select>
        </label>
        <label>
          Assignment form
          <select
            aria-label="Assignment form"
            className="a-input"
            required
            value={formId}
            disabled={busy}
            onChange={(e) => setFormId(e.target.value)}
          >
            <option value="">Choose form</option>
            {available.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset disabled={busy}>
        <legend>Scouts to include</legend>
        <div className="a-row">
          {members
            .filter((row) => row.team_id === workspace.id)
            .map((row) => (
              <label key={row.id}>
                <input
                  type="checkbox"
                  checked={scouts.includes(row.user_id)}
                  onChange={(e) =>
                    setScouts((current) =>
                      e.target.checked
                        ? [...current, row.user_id]
                        : current.filter((id) => id !== row.user_id),
                    )
                  }
                />{" "}
                {row.username ||
                  (data.users || []).find((user) => user.id === row.user_id)
                    ?.username ||
                  row.user_id}
              </label>
            ))}
        </div>
      </fieldset>
      <button
        className="a-button"
        disabled={busy || !event || !scouts.length || !formId}
      >
        {busy ? "Generating…" : "Generate random assignments"}
      </button>
      {!available.length && (
        <p className="a-help">
          Create a {kind} form before making assignments.{" "}
          <a href={`#/${kind}`}>Open {kind} forms</a>, choose New form, add your
          questions and save.
        </p>
      )}
      {!scouts.length && (
        <p className="a-muted">
          Select at least one scout above. For match scouting, select one person
          for each robot in a match.
        </p>
      )}
      {kind === "match" && !event?.matches?.length && (
        <p className="a-help">
          Download the match schedule in <a href="#/events">Event setup</a>{" "}
          before generating match assignments.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
