import { LegacyTeamAssignments } from "./legacy-workflows.jsx";
import { OfficialEventPicker } from './restored-features.jsx';
import { useState } from "react";
import {
  assignmentReports,
  matchLabel,
  isCompleted,
} from "./workspace-model.js";

const editable = (role) => ["admin", "owner"].includes(role);
const reportsFor = (data) => data.scout_reports || data.submissions || [];
const messageFor = (error) =>
  error.status === 409
    ? "This record changed on another device. Your edits are preserved here. Reload the current version before saving again."
    : error.message ||
      "Could not save. Your changes are preserved on this screen.";
function Feedback({ error, message }) {
  return (
    <>
      {error && (
        <p className="a-danger" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}

export function Assignments(props) {
  return (
    <AssignmentEditor
      key={`${props.workspace?.id}:${props.event?.id}`}
      {...props}
    />
  );
}
function AssignmentEditor({
  data = {},
  workspace,
  event,
  user,
  role,
  api,
  onRefresh,
  navigate,
}) {
  const [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [filter, setFilter] = useState("mine"),
    [scoutFilter, setScoutFilter] = useState(""),
    [matchFilter, setMatchFilter] = useState("");
  const canEdit = editable(role),
    matches = data.matches || event?.matches || [];
  const members = (data.memberships || []).filter(
    (row) => row.team_id === workspace?.id,
  );
  const forms = (data.forms || []).filter(
    (row) => row.team_id === workspace?.id && !row.archived_at && !row.archived,
  );
  const assignments = (data.assignments || []).filter(
    (row) =>
      row.team_id === workspace?.id && row.event_key === event?.event_key,
  );
  const reports = reportsFor(data),
    pendingIds = new Set(data.pendingReportIds || []);
  const names = new Map(
    (data.users || []).map((row) => [row.id, row.username]),
  );
  const scoutName = (id) =>
    names.get(id) || members.find((row) => row.user_id === id)?.username || id;
  const selectedMatch = matches.find((match) => match.key === draft?.match_key);
  const scheduledTeams = ["red", "blue"].flatMap((color) =>
    (selectedMatch?.alliances?.[color]?.team_keys || []).map((key) => ({
      number: key.replace(/^frc/, ""),
      alliance: color,
    })),
  );
  const teams =
    draft?.report_kind !== "pit" && scheduledTeams.length
      ? scheduledTeams
      : (event?.event_teams || []).map((team) => ({
          number: String(team.team_number),
          alliance: "",
        }));
  const update = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
    setMessage("Unsaved assignment");
  };
  const open = (row) => {
    setDraft({ ...row });
    setError("");
    setMessage("");
  };
  function create() {
    open({
      id: crypto.randomUUID(),
      team_id: workspace.id,
      event_key: event.event_key,
      report_kind: "match",
      match_key: "",
      team_number: "",
      scout_user_id: "",
      form_id: "",
      revision: 0,
    });
  }
  async function save(e) {
    e.preventDefault();
    if (
      (draft.report_kind !== "pit" && !draft.match_key) ||
      !draft.team_number ||
      !draft.scout_user_id ||
      !draft.form_id
    ) {
      setError("Choose a match, team, scout, and form.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const match = matches.find((row) => row.key === draft.match_key);
      const alliance =
        ["red", "blue"].find((color) =>
          (match?.alliances?.[color]?.team_keys || []).includes(
            `frc${draft.team_number}`,
          ),
        ) || "";
      const body = {
        ...draft,
        team_number: Number(draft.team_number),
        report_kind: draft.report_kind || "match",
        match_key: draft.report_kind === "pit" ? null : draft.match_key,
        match_number: match?.match_number || null,
        alliance,
        updated_at: new Date().toISOString(),
        admin_reason: draft.admin_reason || 'Coordinator assignment adjustment',
      };
      const saved = await api(
        draft.revision ? "PATCH" : "POST",
        draft.revision
          ? `/assignments/${encodeURIComponent(draft.id)}`
          : "/assignments",
        body,
      );
      setDraft(saved);
      setMessage("Assignment saved on the server.");
      await onRefresh?.();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }
  const visible = assignments.filter(
    (row) =>
      !row.archived_at &&
      (filter !== "mine" || row.scout_user_id === user?.id) &&
      (!scoutFilter || row.scout_user_id === scoutFilter) &&
      (!matchFilter || row.match_key === matchFilter),
  );
  return (
    <section className="a-panel a-stack">
      <div className="a-row">
        <h2>Scouting assignments</h2>
        {canEdit && event && (
          <button className="a-button" onClick={create}>
            New assignment
          </button>
        )}
      </div>
      <p className="a-muted">
        Completion requires a submitted report for the assigned event, match,
        team, scout, and form. Opening a form does not complete an assignment.
      </p>
      <LegacyTeamAssignments
        event={event}
        user={user}
        role={role}
        navigate={navigate}
      />
      {!event ? (
        <p className="a-empty">
          Choose an event in Event setup before managing assignments. Use the
          current event menu above to browse all events.
        </p>
      ) : (
        <>
          <div className="a-row">
            <label>
              Assignment view
              <select
                className="a-input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="mine">My assignments</option>
                <option value="all">All assignments</option>
              </select>
            </label>
            <label>
              Scout
              <select
                className="a-input"
                value={scoutFilter}
                onChange={(e) => setScoutFilter(e.target.value)}
              >
                <option value="">All scouts</option>
                {members.map((row) => (
                  <option key={row.id} value={row.user_id}>
                    {scoutName(row.user_id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Match
              <select
                className="a-input"
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value)}
              >
                <option value="">All matches</option>
                {matches.map((match) => (
                  <option key={match.key} value={match.key}>
                    {matchLabel(match)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!canEdit && (
            <p className="a-muted">
              Coordinators manage assignments. Report completion is limited to
              reports your account can access.
            </p>
          )}
          <div className="a-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Team</th>
                  <th>Scout</th>
                  <th>Report status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const matching = assignmentReports(row, reports).filter(
                    (report) => !row.form_id || report.form_id === row.form_id,
                  );
                  const found = matching.filter(
                      (report) => !pendingIds.has(report.id),
                    ),
                    pending = matching.filter((report) =>
                      pendingIds.has(report.id),
                    );
                  const match = matches.find(
                    (match) => match.key === row.match_key,
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.report_kind === "pit"
                          ? "Pit scouting"
                          : matchLabel(match || { key: row.match_key })}
                      </td>
                      <td>{row.team_number}</td>
                      <td>{scoutName(row.scout_user_id)}</td>
                      <td>
                        {found.length
                          ? `Submitted (${found.length})`
                          : pending.length
                            ? `Pending upload (${pending.length})`
                            : isCompleted(match)
                              ? "Missing report"
                              : "Pending report"}
                      </td>
                      <td>
                        <div className="a-row">
                          {row.scout_user_id === user?.id && (
                            <button
                              className="a-button"
                              onClick={() =>
                                navigate(
                                  `/${row.report_kind === "pit" ? "pit" : "match"}?${new URLSearchParams({ event_key: row.event_key, match_key: row.match_key || "", match_number: String(row.match_number || ""), alliance: row.alliance || "", scouted_team: String(row.team_number), form_id: row.form_id || "", assignment_id: row.id })}`,
                                )
                              }
                            >
                              Scout
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className="a-button"
                              onClick={() => open(row)}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className="a-empty">No assignments match these filters.</p>
          )}
          {canEdit && (
            <p className="a-muted">
              {
                matches.filter(
                  (match) =>
                    !assignments.some((row) => row.match_key === match.key),
                ).length
              }{" "}
              scheduled matches have no assignments. Team coverage should be
              reviewed individually.
            </p>
          )}
          {canEdit && draft && (
            <form className="a-stack" onSubmit={save}>
              <label>Reason for assignment adjustment<input className="a-input" maxLength={500} value={draft.admin_reason||''} onChange={e=>update({admin_reason:e.target.value})}/></label>
              <h3>
                {draft.revision ? "Edit assignment" : "Create assignment"}
              </h3>
              <div className="a-row">
                <label>
                  Report type
                  <select
                    className="a-input"
                    value={draft.report_kind || "match"}
                    onChange={(e) =>
                      update({
                        report_kind: e.target.value,
                        match_key: "",
                        form_id: "",
                      })
                    }
                  >
                    <option value="match">Match scouting</option>
                    <option value="pit">Pit scouting</option>
                  </select>
                </label>
                <label>
                  Match
                  <select
                    className="a-input"
                    required={draft.report_kind !== "pit"}
                    value={draft.match_key || ""}
                    disabled={saving || draft.report_kind === "pit"}
                    onChange={(e) =>
                      update({ match_key: e.target.value, team_number: "" })
                    }
                  >
                    <option value="">Choose match</option>
                    {matches.map((match) => (
                      <option key={match.key} value={match.key}>
                        {matchLabel(match)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Team
                  <select
                    className="a-input"
                    required
                    value={draft.team_number}
                    disabled={saving}
                    onChange={(e) => update({ team_number: e.target.value })}
                  >
                    <option value="">Choose team</option>
                    {teams.map((team) => (
                      <option key={team.number} value={team.number}>
                        Team {team.number}
                        {team.alliance ? ` · ${team.alliance} alliance` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scout
                  <select
                    className="a-input"
                    required
                    value={draft.scout_user_id}
                    disabled={saving}
                    onChange={(e) => update({ scout_user_id: e.target.value })}
                  >
                    <option value="">Choose scout</option>
                    {members.map((row) => (
                      <option key={row.id} value={row.user_id}>
                        {scoutName(row.user_id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Form
                  <select
                    className="a-input"
                    required
                    value={draft.form_id}
                    disabled={saving}
                    onChange={(e) => update({ form_id: e.target.value })}
                  >
                    <option value="">Choose form</option>
                    {forms
                      .filter(
                        (form) =>
                          (form.kind || "match") ===
                          (draft.report_kind || "match"),
                      )
                      .map((form) => (
                        <option key={form.id} value={form.id}>
                          {form.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="a-row">
                <button className="a-button" disabled={saving}>
                  {saving ? "Saving…" : "Save assignment"}
                </button>
                <button
                  className="a-button"
                  type="button"
                  onClick={() => setDraft(null)}
                >
                  Close editor
                </button>
                {draft.revision > 0 && (
                  <button
                    className="a-button"
                    type="button"
                    onClick={() => {
                      const current = assignments.find(
                        (row) => row.id === draft.id,
                      );
                      if (current) open(current);
                    }}
                  >
                    Reload saved assignment
                  </button>
                )}
              </div>
            </form>
          )}
          <Feedback error={error} message={message} />
        </>
      )}
    </section>
  );
}

export function EventData({
  data = {},
  workspace,
  event,
  role,
  api,
  onRefresh,
  navigate,
}) {
  const [key, setKey] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const canEdit = editable(role),
    events = (data.scout_events || []).filter(
      (row) =>
        row.team_id === workspace?.id &&
        !row.data_cleared_at &&
        !row.archived_at,
    );
  async function create(e) {
    e.preventDefault();
    if (!/^\w+$/.test(key.trim()) || !name.trim()) {
      setError("Enter a valid event key and event name.");
      return;
    }
    const existing=events.find((row) => row.event_key === key.trim());
    if (existing) {
      navigate(`/events/${encodeURIComponent(existing.id)}`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved=await api("POST", "/scout_events", {
        id: crypto.randomUUID(),
        team_id: workspace.id,
        event_key: key.trim(),
        event_name: name.trim(),
        event_teams: [],
        matches: [],
        created_at: new Date().toISOString(),
      });
      setKey("");
      setName("");
      await onRefresh?.();
      navigate(`/events/${encodeURIComponent(saved.id)}`);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }
  async function refreshOfficial() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const encoded = encodeURIComponent(event.event_key);
      const [teams, matches, rankings] = await Promise.all([
        api("GET", `/tba/event/${encoded}/teams/simple`),
        api("GET", `/tba/event/${encoded}/matches`),
        api("GET", `/tba/event/${encoded}/rankings`),
      ]);
      if (!Array.isArray(teams) || !Array.isArray(matches))
        throw new Error(
          "Official data returned an unexpected format. Existing event data was preserved.",
        );
      await api("PATCH", `/scout_events/${encodeURIComponent(event.id)}`, {
        event_teams: teams,
        matches,
        rankings,
        official_fetched_at: new Date().toISOString(),
      });
      setMessage(
        "Official teams, schedule, results, and rankings updated. Scouting reports are unchanged.",
      );
      await onRefresh?.();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="a-stack">
      <header>
        <h1>Event data</h1>
        <p className="a-muted">
          One event is active for your team. Changing events keeps all historical
          scouting data, schedules, assignments and forms.
        </p>
      </header>
      <>
        {canEdit && (
          <OfficialEventPicker
            workspace={workspace}
            api={api}
            onRefresh={onRefresh}
            navigate={navigate}
          />
        )}
      </>
      <section className="a-panel a-stack">
        <h2>{event?.event_name || "Current event"}</h2>
        {event ? (
          <>
            <p>
              {event.event_key} · {(event.event_teams || []).length} teams ·{" "}
              {(event.matches || []).length} scheduled matches
            </p>
            <p className="a-muted">
              Official data:{" "}
              {event.official_fetched_at
                ? new Date(event.official_fetched_at).toLocaleString()
                : "Not downloaded"}
              . Internal scouting reports remain separate from official results.
            </p>
            {canEdit && (
              <button
                className="a-button"
                disabled={saving}
                onClick={refreshOfficial}
              >
                {saving ? "Updating…" : "Refresh official event data"}
              </button>
            )}
            <button className="a-button" onClick={() => navigate("/matches")}>
              View match schedule
            </button>
          </>
        ) : (
          <p className="a-empty">
            Choose a season and event above. You can select a competition even
            when your team is not attending.
          </p>
        )}
        <Feedback error={error} message={message} />
      </section>
      <section className="a-panel a-stack" aria-label="Manual event setup">
        {canEdit ? (
          <form className="a-stack" onSubmit={create}>
            <details className="a-disclosure">
              <summary>Add a manual event</summary>
              <p className="a-muted">
                Use this only if your competition is not on The Blue Alliance.
                Enter an event key and name, then choose Create event. You can
                add forms without an official schedule.
              </p>
              <div className="a-row">
                <label>
                  Event key
                  <input
                    className="a-input"
                    required
                    value={key}
                    disabled={saving}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="2026example"
                  />
                </label>
                <label>
                  Event name
                  <input
                    className="a-input"
                    required
                    value={name}
                    disabled={saving}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Competition name"
                  />
                </label>
                <button className="a-button" disabled={saving}>
                  Create event
                </button>
              </div>
            </details>
          </form>
        ) : (
          <p className="a-muted">
            A team administrator can add events, change the active event and
            refresh official data.
          </p>
        )}
      </section>
    </div>
  );
}

export function MetricConfiguration(props) {
  return <MetricEditor key={props.event?.id || "no-event"} {...props} />;
}
function MetricEditor({ analytics, event, role, api, onRefresh }) {
  const [config, setConfig] = useState(() =>
      structuredClone(event?.analytics_config || {}),
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const [baseRevision, setBaseRevision] = useState(
    event?.analytics_revision ?? 0,
  );
  const changedOnServer = (event?.analytics_revision ?? 0) !== baseRevision;
  const metrics = analytics?.metrics || [],
    canEdit = editable(role);
  const update = (id, key, value) => {
    setConfig((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value || null },
    }));
    setMessage("Unsaved metric definitions");
  };
  async function save(e) {
    e.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api(
        "PATCH",
        `/scout_events/${encodeURIComponent(event.id)}`,
        { analytics_config: config, analytics_revision: baseRevision },
      );
      setConfig(structuredClone(saved.analytics_config));
      setBaseRevision(saved.analytics_revision);
      setMessage(
        "Metric definitions saved. Analytics will use these explicit settings.",
      );
      await onRefresh?.();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }
  async function reload() {
    if (!event || saving) return;
    setSaving(true);
    setError("");
    try {
      const current = await api(
        "GET",
        `/scout_events/${encodeURIComponent(event.id)}`,
      );
      setConfig(structuredClone(current.analytics_config || {}));
      setBaseRevision(current.analytics_revision ?? 0);
      setMessage(
        "Loaded current server definitions. Previous local edits were replaced.",
      );
      await onRefresh?.();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="a-panel a-stack">
      <h2>Metric definitions</h2>
      {changedOnServer && (
        <p className="a-danger" role="status">
          The server metric revision changed from {baseRevision} to{" "}
          {event?.analytics_revision ?? 0}. Your local edits are preserved.
          Reload the server definitions explicitly to replace them.
        </p>
      )}
      {event && (
        <div className="a-row">
          <span className="a-muted">
            Editing metric revision {baseRevision}
          </span>
          <button
            className="a-button"
            type="button"
            disabled={saving}
            onClick={reload}
          >
            Reload server definitions (discard local edits)
          </button>
        </div>
      )}
      <p className="a-muted">
        Map measured fields explicitly. Unassigned phases and units remain
        unknown. These settings do not introduce scoring weights or combine
        unrelated fields.
      </p>
      {!event ? (
        <p className="a-empty">Select an event to configure its metrics.</p>
      ) : !metrics.length ? (
        <p className="a-empty">
          Create a scouting form to define measured fields.
        </p>
      ) : (
        <form className="a-stack" onSubmit={save}>
          <div className="a-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Measured field</th>
                  <th>Phase</th>
                  <th>Unit</th>
                  <th>Preferred direction</th>
                  <th>Alliance role</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>
                      <strong>{metric.label || metric.id}</strong>
                      <br />
                      <small className="a-muted">
                        {metric.formTitle} · {metric.id}
                      </small>
                    </td>
                    <td>
                      <select
                        className="a-input"
                        aria-label={`Phase for ${metric.label}`}
                        value={config[metric.id]?.phase || ""}
                        disabled={saving || !canEdit}
                        onChange={(e) =>
                          update(metric.id, "phase", e.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        <option value="auto">Autonomous</option>
                        <option value="teleop">Teleoperated</option>
                        <option value="endgame">Endgame</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="a-input"
                        aria-label={`Unit for ${metric.label}`}
                        value={config[metric.id]?.unit || ""}
                        disabled={saving || !canEdit}
                        onChange={(e) =>
                          update(metric.id, "unit", e.target.value)
                        }
                        placeholder="Unknown"
                      />
                    </td>
                    <td>
                      <select
                        className="a-input"
                        aria-label={`Direction for ${metric.label}`}
                        value={config[metric.id]?.direction || ""}
                        disabled={saving || !canEdit}
                        onChange={(e) =>
                          update(metric.id, "direction", e.target.value)
                        }
                      >
                        <option value="">Unspecified</option>
                        <option value="higher">Higher</option>
                        <option value="lower">Lower</option>
                      </select>
                    </td>
                    <td><select className="a-input" aria-label={`Alliance role for ${metric.label}`} value={config[metric.id]?.category || ''} disabled={saving || !canEdit} onChange={e=>update(metric.id,'category',e.target.value)}><option value="">Unassigned</option><option value="scoring">Scoring</option><option value="defense">Defense</option><option value="support">Support</option><option value="reliability">Reliability</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="a-button" disabled={saving || !canEdit}>
            {saving ? "Saving…" : "Save metric definitions"}
          </button>
        </form>
      )}
      <Feedback error={error} message={message} />
    </section>
  );
}
