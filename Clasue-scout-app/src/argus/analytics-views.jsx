import { useEffect, useId, useRef, useState } from "react";
import { formatValue, presentationSections } from "./analytics.js";
import "./analytics-views.css";

const phases = {
  auto: "Autonomous",
  teleop: "Teleoperated",
  endgame: "Endgame",
};
const isNumeric = (metric) => ["number", "scale"].includes(metric.type);
const numericMetrics = (analytics) =>
  (analytics?.metrics || []).filter(isNumeric);
const findTeam = (analytics, number) =>
  analytics?.teams?.find((team) => String(team.teamNumber) === String(number));
const dateLabel = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";
const matchLabel = (value) =>
  value
    ? String(value)
        .replace(/^.*_(qm|ef|qf|sf|f)/, "$1 ")
        .toUpperCase()
    : "Match not linked";
const withUnit = (value, metric) =>
  `${formatValue(value)}${value != null && metric?.unit ? ` ${metric.unit}` : ""}`;
const coverage = (team) =>
  team.confidence.coveragePercent == null
    ? "Unknown"
    : `${formatValue(team.confidence.coveragePercent)}%`;
const safeImage = (value) =>
  typeof value === "string" &&
  /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value);
const axisValue = (value) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

function MetricSelect({
  analytics,
  value,
  onChange,
  label = "Measured field",
}) {
  const id = useId(),
    metrics = numericMetrics(analytics);
  return (
    <label className="av-metric-select" htmlFor={id}>
      {label}
      <select
        id={id}
        className="a-input"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={!metrics.length}
      >
        {!metrics.length && (
          <option value="">No numeric fields available</option>
        )}
        {metrics.map((metric) => (
          <option key={metric.id} value={metric.id}>
            {metric.formTitle ? `${metric.formTitle}: ` : ""}
            {metric.label}
            {metric.unit ? ` (${metric.unit})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceButton({ id, onOpenReport, children }) {
  return onOpenReport ? (
    <button
      type="button"
      className="av-source"
      onClick={() => onOpenReport(id)}
    >
      {children || `Report ${String(id).slice(0, 8)}`}
    </button>
  ) : (
    <span className="av-source-id">
      {children || `Report ${String(id).slice(0, 8)}`}
    </span>
  );
}

function SampleNote({ metric }) {
  if (!metric?.n)
    return (
      <p className="av-data-note">
        No valid numeric observations for this field. Missing answers are not
        counted as zero.
      </p>
    );
  return (
    <p className="av-data-note">
      {metric.n} {metric.n === 1 ? "sample" : "samples"} from{" "}
      {metric.observationCount} valid scout{" "}
      {metric.observationCount === 1 ? "observation" : "observations"}. Each
      linked match contributes its median; reports without a match link remain
      separate.{" "}
      {metric.n < 3 && <strong>Small sample: fewer than three samples.</strong>}
    </p>
  );
}

function MetricFacts({ metric }) {
  return (
    <dl className="av-metric-facts">
      {[
        ["Average", withUnit(metric?.mean, metric)],
        ["Median", withUnit(metric?.median, metric)],
        [
          "Observed range",
          metric?.n
            ? `${formatValue(metric.min)}–${withUnit(metric.max, metric)}`
            : "—",
        ],
        ["Variation (SD)", withUnit(metric?.stddev, metric)],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrendChart({ metric, onOpenReport }) {
  const id = useId(),
    values = metric?.values || [];
  if (!values.length)
    return (
      <div className="a-empty">No valid values to chart for this field.</div>
    );
  const minimum = Math.min(...values.map((item) => item.value)),
    maximum = Math.max(...values.map((item) => item.value));
  const padding =
    minimum === maximum
      ? Math.max(Math.abs(minimum) * 0.1, 1)
      : (maximum - minimum) * 0.12;
  const low = minimum >= 0 ? Math.max(0, minimum - padding) : minimum - padding,
    high = maximum + padding;
  const x = (index) =>
    values.length === 1 ? 340 : 62 + (index / (values.length - 1)) * 552;
  const y = (value) => 192 - ((value - low) / (high - low)) * 164;
  const ticks = [0, 0.5, 1].map((ratio) => low + (high - low) * ratio);
  return (
    <figure className="av-chart">
      <svg
        viewBox="0 0 640 240"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{metric.label}: observed values</title>
        <desc id={`${id}-description`}>
          {values.length} samples. Minimum {formatValue(minimum)}, maximum{" "}
          {formatValue(maximum)}. Values use official schedule order when
          available, otherwise report time. The data table follows.
        </desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1="62"
              x2="614"
              y1={y(tick)}
              y2={y(tick)}
              className="av-grid-line"
            />
            <text
              x="51"
              y={y(tick) + 4}
              textAnchor="end"
              className="av-axis-label"
            >
              {axisValue(tick)}
            </text>
          </g>
        ))}
        {values.length > 1 && (
          <polyline
            points={values
              .map((item, index) => `${x(index)},${y(item.value)}`)
              .join(" ")}
            className="av-trend-line"
          />
        )}
        {values.map((item, index) => (
          <circle
            key={item.key}
            cx={x(index)}
            cy={y(item.value)}
            r="4"
            className="av-trend-dot"
          >
            <title>
              {matchLabel(item.matchKey)}: {withUnit(item.value, metric)}
            </title>
          </circle>
        ))}
        <text x="62" y="218" className="av-axis-label">
          {matchLabel(values[0].matchKey)}
        </text>
        {values.length > 1 && (
          <text x="614" y="218" textAnchor="end" className="av-axis-label">
            {matchLabel(values.at(-1).matchKey)}
          </text>
        )}
      </svg>
      <figcaption>
        Observed {metric.label.toLowerCase()}
        {metric.unit ? ` (${metric.unit})` : ""}. Lines connect samples; they do
        not predict future performance.
      </figcaption>
      <details className="av-chart-data">
        <summary>View chart data and sources ({values.length})</summary>
        <div
          className="av-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={`${metric.label} chart data`}
        >
          <table>
            <caption>{metric.label}: one median per linked match</caption>
            <thead>
              <tr>
                <th scope="col">Match / observation</th>
                <th scope="col">Value</th>
                <th scope="col">Source reports</th>
              </tr>
            </thead>
            <tbody>
              {values.map((item) => (
                <tr key={item.key}>
                  <th scope="row">
                    {matchLabel(item.matchKey)}
                    {!item.matchKey && (
                      <small>{dateLabel(item.createdAt)}</small>
                    )}
                  </th>
                  <td>{withUnit(item.value, metric)}</td>
                  <td>
                    <div className="av-source-list">
                      {item.sourceIds.map((source) => (
                        <SourceButton
                          key={source}
                          id={source}
                          onOpenReport={onOpenReport}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function DistributionChart({ metric }) {
  const id = useId(),
    values = metric?.values || [];
  if (!values.length) return null;
  const low = metric.min,
    high = metric.max,
    count = low === high ? 1 : Math.min(6, values.length);
  const bins = Array.from({ length: count }, (_, index) => ({
    low: low + ((high - low) * index) / count,
    high: low + ((high - low) * (index + 1)) / count,
    count: 0,
  }));
  values.forEach((item) => {
    const index =
      low === high
        ? 0
        : Math.min(
            count - 1,
            Math.floor(((item.value - low) / (high - low)) * count),
          );
    bins[index].count++;
  });
  const maxCount = Math.max(...bins.map((bin) => bin.count)),
    width = 520 / count;
  return (
    <figure className="av-chart av-distribution">
      <svg
        viewBox="0 0 640 220"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{metric.label} distribution</title>
        <desc id={`${id}-description`}>
          {bins
            .map(
              (bin) =>
                `${formatValue(bin.low)}${bin.high !== bin.low ? ` to ${formatValue(bin.high)}` : ""}: ${bin.count} samples`,
            )
            .join(". ")}
          . Values on an interior boundary belong to the next interval.
        </desc>
        {[0, maxCount].map((value) => (
          <g key={value}>
            <line
              x1="62"
              x2="614"
              y1={176 - (value / maxCount) * 140}
              y2={176 - (value / maxCount) * 140}
              className="av-grid-line"
            />
            <text
              x="51"
              y={180 - (value / maxCount) * 140}
              textAnchor="end"
              className="av-axis-label"
            >
              {value}
            </text>
          </g>
        ))}
        {bins.map((bin, index) => (
          <g key={index}>
            <rect
              x={72 + index * width}
              y={176 - (bin.count / maxCount) * 140}
              width={width - 12}
              height={(bin.count / maxCount) * 140}
              rx="3"
              className="av-bar"
            />
            <text
              x={72 + index * width + (width - 12) / 2}
              y={Math.max(23, 167 - (bin.count / maxCount) * 140)}
              textAnchor="middle"
              className="av-axis-label"
            >
              {bin.count}
            </text>
          </g>
        ))}
        <text x="62" y="203" className="av-axis-label">
          {axisValue(low)}
        </text>
        <text x="614" y="203" textAnchor="end" className="av-axis-label">
          {axisValue(high)}
        </text>
      </svg>
      <figcaption>
        Distribution of {values.length} samples
        {metric.unit ? ` in ${metric.unit}` : ""}. Vertical axis: sample count.{" "}
        {bins.length > 1
          ? "Equal-width intervals; a boundary value belongs to the next interval."
          : "All observed samples have the same value."}
      </figcaption>
      <details className="av-chart-data">
        <summary>View distribution table</summary>
        <div
          className="av-table-wrap"
          role="region"
          aria-label={`${metric.label} distribution table`}
          tabIndex={0}
        >
          <table>
            <caption>
              Sample distribution. Interior upper boundaries are excluded; the
              final upper boundary is included.
            </caption>
            <thead>
              <tr>
                <th scope="col">Interval</th>
                <th scope="col">Sample count</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin, index) => (
                <tr key={index}>
                  <th scope="row">
                    {bin.low === bin.high
                      ? withUnit(bin.low, metric)
                      : `${formatValue(bin.low)} to ${withUnit(bin.high, metric)}`}
                  </th>
                  <td>{bin.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function PhaseMetrics({ team, onOpenReport }) {
  const numeric = Object.values(team.metrics).filter(isNumeric);
  const pitNumeric = Object.values(team.pitMetrics || {}).filter(
    (metric) => isNumeric(metric) && metric.n > 0,
  );
  const capabilities = [
    ...Object.values(team.metrics).map((metric) => ({
      ...metric,
      evidenceKind: "Match",
    })),
    ...Object.values(team.pitMetrics || {}).map((metric) => ({
      ...metric,
      evidenceKind: "Pit",
    })),
  ].filter((metric) => metric.counts?.length);
  return (
    <div className="av-phases">
      {Object.entries(phases).map(([key, label]) => (
        <section key={key}>
          <h3>{label}</h3>
          {numeric.some((metric) => metric.phase === key) ? (
            <MetricTable
              metrics={numeric.filter((metric) => metric.phase === key)}
            />
          ) : (
            <p className="a-muted">
              No fields mapped to {label.toLowerCase()}. An admin can map
              existing numeric questions in Event Data.
            </p>
          )}
        </section>
      ))}
      {numeric.some((metric) => !metric.phase) && (
        <section>
          <h3>Other measured fields</h3>
          <MetricTable metrics={numeric.filter((metric) => !metric.phase)} />
        </section>
      )}
      <p className="av-data-note">
        These are field measurements, not calculated game points. Phase labels
        come from your event configuration. Fields with different units are
        never added together.
      </p>
      {pitNumeric.length > 0 && (
        <section>
          <h3>Pit measurements</h3>
          <p className="a-muted">
            These measurements come from pit reports and are excluded from match
            averages and coverage.
          </p>
          <MetricTable
            metrics={pitNumeric}
            caption="Pit measurements: separate report observations, excluded from match statistics."
          />
        </section>
      )}
      {capabilities.length > 0 && (
        <section>
          <h3>Reported capabilities</h3>
          <div className="av-capability-list">
            {capabilities.map((metric) => (
              <div key={`${metric.evidenceKind}:${metric.id}`}>
                <strong>{metric.label}</strong>
                <p>
                  {metric.counts
                    .map((item) => `${item.value}: ${item.count}`)
                    .join(" · ")}
                </p>
                <small className="a-muted">
                  {metric.evidenceKind} evidence: {metric.n} scout observations,
                  including repeat reports. {metric.missing} unanswered.
                </small>
                <div className="av-source-list">
                  {metric.sourceIds.slice(0, 4).map((id) => (
                    <SourceButton
                      key={id}
                      id={id}
                      onOpenReport={onOpenReport}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricTable({
  metrics,
  caption = "Valid observations only. Sample count uses one median per linked match.",
}) {
  return (
    <div
      className="av-table-wrap"
      role="region"
      aria-label="Measured field statistics"
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Measured field</th>
            <th scope="col">Average</th>
            <th scope="col">Median</th>
            <th scope="col">Range</th>
            <th scope="col">Samples</th>
            <th scope="col">Missing / invalid</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.id}>
              <th scope="row">
                {metric.label}
                <small>
                  {metric.formTitle}
                  {metric.unit ? ` · ${metric.unit}` : ""}
                </small>
              </th>
              <td>{formatValue(metric.mean)}</td>
              <td>{formatValue(metric.median)}</td>
              <td>
                {metric.n
                  ? `${formatValue(metric.min)}–${formatValue(metric.max)}`
                  : "—"}
              </td>
              <td>
                {metric.n}
                {metric.n > 0 && metric.n < 3 && <small>Small sample</small>}
              </td>
              <td>
                {metric.missing} / {metric.invalid}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function History({ team, onOpenReport }) {
  return (
    <section>
      <h2>Match history</h2>
      <p className="a-muted">
        Scouting reports are observations, separate from official match results.
      </p>
      {team.history.length ? (
        <div
          className="av-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Team report history"
        >
          <table>
            <caption>
              {team.history.length} event-linked scouting reports
            </caption>
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Report</th>
                <th scope="col">Scout</th>
                <th scope="col">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {[...team.history].reverse().map((report) => (
                <tr key={report.id}>
                  <th scope="row">
                    {report.report_kind === "pit"
                      ? "Pit scouting"
                      : matchLabel(report.match_key)}
                    {report.report_kind !== "pit" && report.alliance && (
                      <small>{report.alliance} alliance</small>
                    )}
                  </th>
                  <td>
                    <SourceButton id={report.id} onOpenReport={onOpenReport}>
                      {report.form_title || "Scouting report"}
                    </SourceButton>
                    {report.report_kind && <small>{report.report_kind}</small>}
                  </td>
                  <td>{report.submitted_by || "Unknown scout"}</td>
                  <td>{dateLabel(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="a-empty">No reports linked to this event.</p>
      )}
      {team.unlinkedReportCount > 0 && (
        <details className="av-legacy">
          <summary>
            {team.unlinkedReportCount} reports without an event link
          </summary>
          <p className="a-muted">
            These records are preserved and excluded from event calculations.
          </p>
          <ul>
            {team.unlinkedReports.map((report) => (
              <li key={report.id}>
                <SourceButton id={report.id} onOpenReport={onOpenReport}>
                  {report.form_title || "Scouting report"}
                </SourceButton>
                <span className="a-muted">{dateLabel(report.created_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Observations({ team, onOpenReport }) {
  const [kind,setKind]=useState('all');
  const notes=team.notes.filter(note=>kind==='all'||(kind==='pit'?note.reportKind==='pit':note.reportKind!=='pit'));
  return (
    <section>
      <h2>Scout observations</h2>
      <label>Observation source<select className="a-input" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All observations</option><option value="pit">Pit observations</option><option value="match">Match observations</option></select></label>
      <p className="a-muted">
        Notes are attributed observations. Review the source reports before
        treating a note as an established capability or limitation.
      </p>
      {notes.length ? (
        <ul className="av-observations">
          {[...notes].reverse().map((note) => (
            <li key={`${note.reportId}:${note.label}`}>
              <strong>{note.label}</strong>
              <blockquote>{String(note.value)}</blockquote>
              <div className="av-observation-meta">
                <SourceButton id={note.reportId} onOpenReport={onOpenReport} />
                <span>
                  {note.reportKind === "pit"
                    ? "Pit scouting"
                    : matchLabel(note.matchKey)}
                </span>
                <span>{dateLabel(note.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="a-empty">
          No written scout observations for this event. Strengths and weaknesses
          cannot be inferred from missing notes.
        </p>
      )}
    </section>
  );
}

function Confidence({ team, onOpenReport }) {
  const confidence = team.confidence;
  return (
    <section className="av-confidence">
      <h2>Data confidence</h2>
      <p className="a-muted">
        Coverage describes the evidence available. It does not score the robot.
      </p>
      <dl className="av-facts">
        <div>
          <dt>Match coverage</dt>
          <dd>{coverage(team)}</dd>
        </div>
        <div>
          <dt>Completed scheduled matches</dt>
          <dd>{confidence.expectedMatches ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Unanswered eligible fields</dt>
          <dd>{confidence.missingObservations}</dd>
        </div>
        <div>
          <dt>Invalid numeric answers</dt>
          <dd>{confidence.invalidObservations ?? 0}</dd>
        </div>
        <div>
          <dt>Conflicting fields / matches</dt>
          <dd>{confidence.disagreements.length}</dd>
        </div>
        <div>
          <dt>Latest report</dt>
          <dd>{dateLabel(confidence.freshness)}</dd>
        </div>
      </dl>
      <p className="av-data-note">{confidence.coverageDefinition}</p>
      {confidence.missingMatches.length > 0 && (
        <div className="av-confidence-note">
          <h3>Missing match reports</h3>
          <p>{confidence.missingMatches.map(matchLabel).join(", ")}</p>
        </div>
      )}
      {confidence.smallSamples.length > 0 && (
        <div className="av-confidence-note">
          <h3>Small samples</h3>
          <p>
            {confidence.smallSamples
              .map((id) => team.metrics[id]?.label || id)
              .join(", ")}
          </p>
          <p className="a-muted">
            These fields have fewer than three samples. Compare their
            observations and ranges before drawing conclusions.
          </p>
        </div>
      )}
      {confidence.disagreements.length > 0 && (
        <div className="av-confidence-note">
          <h3>Scout disagreement</h3>
          <ul className="av-disagreements">
            {confidence.disagreements.map((item, index) => (
              <li key={`${item.metricId}:${item.matchKey}:${index}`}>
                <strong>{item.label}</strong>
                <p>
                  {matchLabel(item.matchKey)}: scouts reported{" "}
                  {item.values.map(formatValue).join(", ")}.
                </p>
                <div className="av-source-list">
                  {item.sourceIds.map((id) => (
                    <SourceButton
                      key={id}
                      id={id}
                      onOpenReport={onOpenReport}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {confidence.limitations.length > 0 && (
        <ul className="av-limitations">
          {confidence.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeamProfile({
  analytics,
  teamNumber,
  onCompare,
  onPresent,
  onPicklist,
  onOpenReport,
}) {
  const [section, setSection] = useState("overview"),
    [selectedMetric, setSelectedMetric] = useState("");
  const team = findTeam(analytics, teamNumber),
    metrics = numericMetrics(analytics),
    metricId = metrics.some((metric) => metric.id === selectedMetric)
      ? selectedMetric
      : metrics[0]?.id;
  const tabId = useId();
  if (!team)
    return (
      <div className="a-panel a-empty">
        Select a team from the directory to view its scouting evidence.
      </div>
    );
  const metric = team.metrics[metricId],
    photo = [
      ...Object.values(team.metrics),
      ...Object.values(team.pitMetrics || {}),
    ]
      .filter((item) => item.type === "photo")
      .flatMap((item) => item.observations || [])
      .filter((item) => safeImage(item.value))
      .at(-1);
  const tabs = [
    ["overview", "Overview"],
    ["scoring", "Scoring"],
    ["trends", "Trends"],
    ["history", "Match history"],
    ["observations", "Observations"],
    ["confidence", "Data confidence"],
  ];
  function moveTab(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setSection(tabs[next][0]);
    document.getElementById(`${tabId}-${tabs[next][0]}`)?.focus();
  }
  return (
    <article className="av-root a-stack">
      <header className="av-profile-header">
        <div>
          <p className="av-event-context">
            {analytics.event?.name || "No event selected"}
          </p>
          <h1>Team {team.teamNumber}</h1>
          {team.nickname && <p className="av-team-name">{team.nickname}</p>}
        </div>
        <div className="av-actions">
          {onCompare && (
            <button
              className="a-button"
              onClick={() => onCompare([Number(team.teamNumber)])}
            >
              Compare
            </button>
          )}
          {onPicklist && (
            <button
              className="a-button"
              onClick={() => onPicklist(Number(team.teamNumber))}
            >
              Add to picklist
            </button>
          )}
          {onPresent && (
            <button
              className="a-button av-primary"
              onClick={() => onPresent(Number(team.teamNumber))}
            >
              Present team
            </button>
          )}
        </div>
      </header>
      <dl className="av-facts av-top-facts">
        <div>
          <dt>Event reports</dt>
          <dd>{team.reportCount}</dd>
        </div>
        <div>
          <dt>Linked matches</dt>
          <dd>{team.matchCount}</dd>
        </div>
        <div>
          <dt>Match coverage</dt>
          <dd>{coverage(team)}</dd>
        </div>
        <div>
          <dt>Latest report</dt>
          <dd>{dateLabel(team.confidence.freshness)}</dd>
        </div>
      </dl>
      {!team.reportCount && (
        <p className="a-empty">
          No event-linked scouting reports for this team.{" "}
          {team.unlinkedReportCount
            ? `${team.unlinkedReportCount} preserved reports have no event link; inspect them in Match history.`
            : "Collect a report before evaluating performance."}
        </p>
      )}
      <div
        className="av-tabs"
        role="tablist"
        aria-label="Team analytics sections"
      >
        {tabs.map(([id, label], index) => (
          <button
            type="button"
            id={`${tabId}-${id}`}
            key={id}
            role="tab"
            aria-selected={section === id}
            aria-controls={`${tabId}-panel`}
            tabIndex={section === id ? 0 : -1}
            onClick={() => setSection(id)}
            onKeyDown={(event) => moveTab(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="av-section-body"
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${section}`}
        tabIndex={0}
      >
        {section === "overview" && (
          <div className="av-overview">
            <section>
              <h2>Observed performance</h2>
              <p className="a-muted">
                {team.matchCount
                  ? `${team.matchCount} distinct linked matches; ${team.matchReportCount ?? team.reportCount} match or unclassified reports and ${team.pitReportCount || 0} pit reports.`
                  : "No match-linked performance reports are available. Pit evidence remains separate."}{" "}
                {team.confidence.disagreements.length > 0
                  ? `${team.confidence.disagreements.length} fields have conflicting scout observations; review Data confidence.`
                  : "Available observations are summarized below."}
              </p>
              <MetricSelect
                analytics={analytics}
                value={metricId}
                onChange={setSelectedMetric}
              />
              <MetricFacts metric={metric} />
              <SampleNote metric={metric} />
              {metric?.n > 0 && (
                <TrendChart metric={metric} onOpenReport={onOpenReport} />
              )}
            </section>
            <aside className="av-profile-aside">
              {photo && (
                <figure className="av-robot-photo">
                  <img
                    src={photo.value}
                    alt={`Team ${team.teamNumber} robot from a scouting report`}
                  />
                  <figcaption>
                    Scout-provided robot photo.{" "}
                    <SourceButton
                      id={photo.reportId}
                      onOpenReport={onOpenReport}
                    />
                  </figcaption>
                </figure>
              )}
              <h3>Evidence to review</h3>
              <p>
                {team.confidence.smallSamples.length} fields with fewer than
                three samples.
              </p>
              <p>
                {team.confidence.missingObservations} eligible answers missing.
              </p>
              <button
                className="a-button"
                onClick={() => setSection("confidence")}
              >
                Inspect data confidence
              </button>
              <h3>Calculation rules</h3>
              <ul className="av-limitations">
                {analytics.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          </div>
        )}
        {section === "scoring" && (
          <div className="a-stack">
            <PhaseMetrics team={team} onOpenReport={onOpenReport} />
            <section>
              <h2>Scoring distribution</h2>
              <MetricSelect
                analytics={analytics}
                value={metricId}
                onChange={setSelectedMetric}
              />
              <SampleNote metric={metric} />
              <DistributionChart metric={metric} />
              {metric?.n > 0 && (
                <TrendChart metric={metric} onOpenReport={onOpenReport} />
              )}
            </section>
          </div>
        )}
        {section === "trends" && (
          <section>
            <h2>Performance over the available matches</h2>
            <p className="a-muted">
              Official schedule order is used when available; other reports
              follow recording time. The chart does not fill gaps or estimate
              missing matches.
            </p>
            <MetricSelect
              analytics={analytics}
              value={metricId}
              onChange={setSelectedMetric}
            />
            <MetricFacts metric={metric} />
            <SampleNote metric={metric} />
            <TrendChart metric={metric} onOpenReport={onOpenReport} />
            <p className="av-data-note">
              Variation is the population standard deviation of the displayed
              samples. A low value with one sample provides no evidence of
              consistency.
            </p>
          </section>
        )}
        {section === "history" && (
          <History team={team} onOpenReport={onOpenReport} />
        )}
        {section === "observations" && (
          <Observations team={team} onOpenReport={onOpenReport} />
        )}
        {section === "confidence" && (
          <Confidence team={team} onOpenReport={onOpenReport} />
        )}
      </div>
      <p className="av-data-note">
        Calculated {dateLabel(analytics.generatedAt)} from the reports available
        to your account.
      </p>
    </article>
  );
}

function ComparisonChart({ teams, metricId }) {
  const id = useId(),
    measured = teams.filter((team) => team.metrics[metricId]?.mean != null);
  if (!measured.length)
    return (
      <p className="a-empty">
        The selected teams have no valid observations for this field.
      </p>
    );
  const minimum = Math.min(
      0,
      ...measured.map((team) => team.metrics[metricId].mean),
    ),
    maximum = Math.max(
      0,
      ...measured.map((team) => team.metrics[metricId].mean),
    );
  const low = minimum === maximum ? minimum - 1 : minimum,
    high = minimum === maximum ? maximum + 1 : maximum;
  const x = (value) => 112 + ((value - low) / (high - low)) * 402,
    height = 64 + teams.length * 54,
    metric = measured[0].metrics[metricId];
  return (
    <figure className="av-chart">
      <svg
        viewBox={`0 0 640 ${height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>Team comparison: {metric.label}</title>
        <desc id={`${id}-desc`}>
          {teams
            .map(
              (team) =>
                `Team ${team.teamNumber}: ${withUnit(team.metrics[metricId]?.mean, metric)}, ${team.metrics[metricId]?.n || 0} samples`,
            )
            .join(". ")}
          . The comparison table provides the same values.
        </desc>
        <line
          x1={x(0)}
          x2={x(0)}
          y1="12"
          y2={height - 36}
          className="av-grid-line"
        />
        {teams.map((team, index) => {
          const measured = team.metrics[metricId],
            y = 22 + index * 54;
          return (
            <g key={team.teamNumber}>
              <text
                x="96"
                y={y + 17}
                textAnchor="end"
                className="av-axis-label"
              >
                {team.teamNumber}
              </text>
              {measured?.mean != null && (
                <rect
                  x={Math.min(x(0), x(measured.mean))}
                  y={y}
                  width={Math.max(2, Math.abs(x(measured.mean) - x(0)))}
                  height="26"
                  rx="3"
                  className={`av-compare-bar av-color-${index}`}
                />
              )}
              <text x="530" y={y + 17} className="av-axis-label">
                {measured?.mean != null
                  ? formatValue(measured.mean)
                  : "No data"}
                {measured?.n ? ` (n=${measured.n})` : ""}
              </text>
            </g>
          );
        })}
        <text x="112" y={height - 8} className="av-axis-label">
          {formatValue(low)}
        </text>
        <text x="514" y={height - 8} textAnchor="end" className="av-axis-label">
          {withUnit(high, metric)}
        </text>
      </svg>
      <figcaption>
        Average of match medians. Missing observations are omitted, never shown
        as zero. Color identifies the team; it does not indicate an alliance or
        ranking.
      </figcaption>
    </figure>
  );
}

export function TeamComparison({
  analytics,
  teamNumbers = [],
  onChange,
  onOpenTeam,
  onPresent,
}) {
  const [query, setQuery] = useState(""),
    [chosenMetric, setChosenMetric] = useState("");
  const metrics = numericMetrics(analytics),
    metricId = metrics.some((metric) => metric.id === chosenMetric)
      ? chosenMetric
      : metrics[0]?.id;
  const selected = [...new Set(teamNumbers.map(String))].slice(0, 4),
    teams = selected
      .map((number) => findTeam(analytics, number))
      .filter(Boolean);
  const candidates = (analytics?.teams || []).filter(
    (team) =>
      !selected.includes(String(team.teamNumber)) &&
      `${team.teamNumber} ${team.nickname}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const setTeams = (next) => onChange?.(next.map(Number));
  const row = (label, getValue) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      {teams.map((team) => (
        <td key={team.teamNumber}>{getValue(team)}</td>
      ))}
    </tr>
  );
  return (
    <article className="av-root a-stack">
      <header>
        <h1>Compare teams</h1>
        <p className="a-muted">
          Select two to four teams. Compare the same measured field and units,
          with sample sizes in view.
        </p>
      </header>
      <section className="a-panel av-comparison-controls">
        <div
          className="av-selected-teams"
          aria-label="Selected comparison teams"
        >
          {teams.map((team) => (
            <div key={team.teamNumber}>
              <strong>Team {team.teamNumber}</strong>
              <button
                className="a-button"
                disabled={!onChange}
                aria-label={`Remove team ${team.teamNumber} from comparison`}
                onClick={() =>
                  setTeams(
                    selected.filter(
                      (number) => number !== String(team.teamNumber),
                    ),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
          {!teams.length && <p className="a-muted">No teams selected.</p>}
        </div>
        <label className="av-search-label">
          Find a team
          <input
            className="a-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Team number or name"
          />
        </label>
        <ul className="av-team-candidates">
          {candidates.slice(0, 8).map((team) => (
            <li key={team.teamNumber}>
              <span>
                <strong>{team.teamNumber}</strong> {team.nickname}
              </span>
              <button
                className="a-button"
                disabled={!onChange || selected.length >= 4}
                aria-label={`Add team ${team.teamNumber} to comparison`}
                onClick={() => {
                  setTeams([...selected, String(team.teamNumber)]);
                  setQuery("");
                }}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
        {candidates.length > 8 && (
          <p className="a-muted">Refine your search to find more teams.</p>
        )}
        {!candidates.length && (
          <p className="a-muted">No additional teams match your search.</p>
        )}
        <p className="av-data-note" role="status">
          {teams.length}/4 teams selected.
          {teams.length < 2 ? " Add another team to compare." : ""}
        </p>
      </section>
      {teams.length > 0 && (
        <>
          <section className="a-panel">
            <h2>Observed performance</h2>
            <MetricSelect
              analytics={analytics}
              value={metricId}
              onChange={setChosenMetric}
            />
            {metricId && <ComparisonChart teams={teams} metricId={metricId} />}
            <div
              className="av-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Team comparison statistics"
            >
              <table className="av-comparison-table">
                <caption>
                  {metrics.find((metric) => metric.id === metricId)?.label ||
                    "Coverage and report counts"}{" "}
                  · {analytics.event?.name || "No event selected"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Evidence / statistic</th>
                    {teams.map((team) => (
                      <th scope="col" key={team.teamNumber}>
                        Team {team.teamNumber}
                        <small>{team.nickname}</small>
                        <div className="av-team-links">
                          {onOpenTeam && (
                            <button
                              className="av-source"
                              onClick={() =>
                                onOpenTeam(Number(team.teamNumber))
                              }
                            >
                              Open profile
                            </button>
                          )}
                          {onPresent && (
                            <button
                              className="av-source"
                              onClick={() => onPresent(Number(team.teamNumber))}
                            >
                              Present team
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row("Average", (team) =>
                    withUnit(
                      team.metrics[metricId]?.mean,
                      team.metrics[metricId],
                    ),
                  )}
                  {row("Median", (team) =>
                    formatValue(team.metrics[metricId]?.median),
                  )}
                  {row("Variation (population SD)", (team) =>
                    formatValue(team.metrics[metricId]?.stddev),
                  )}
                  {row("Observed range", (team) => {
                    const metric = team.metrics[metricId];
                    return metric?.n
                      ? `${formatValue(metric.min)}–${formatValue(metric.max)}`
                      : "—";
                  })}
                  {row("Samples for selected field", (team) => (
                    <>
                      {team.metrics[metricId]?.n || 0}
                      {team.metrics[metricId]?.n > 0 &&
                        team.metrics[metricId].n < 3 && (
                          <small>Small sample</small>
                        )}
                    </>
                  ))}
                  {row(
                    "Unanswered / invalid",
                    (team) =>
                      `${team.metrics[metricId]?.missing || 0} / ${team.metrics[metricId]?.invalid || 0}`,
                  )}
                  {row("Event reports", (team) => team.reportCount)}
                  {row("Distinct linked matches", (team) => team.matchCount)}
                  {row("Completed-match coverage", coverage)}
                  {row(
                    "Conflicting fields / matches",
                    (team) => team.confidence.disagreements.length,
                  )}
                  {row("Latest report", (team) =>
                    dateLabel(team.confidence.freshness),
                  )}
                </tbody>
              </table>
            </div>
            <p className="av-data-note">
              Every linked match contributes one median for the selected field.
              Variation with one sample is not a measure of reliability.
              Coverage uses completed official matches for each team; it is
              unknown if no denominator is available.
            </p>
          </section>
          <section className="a-panel">
            <h2>Phase measurements</h2>
            <p className="a-muted">
              Only explicit mappings are used. No overall robot score or
              inferred game points.
            </p>
            {Object.entries(phases).map(([phase, label]) => (
              <section className="av-comparison-phase" key={phase}>
                <h3>{label}</h3>
                {metrics.some((metric) => metric.phase === phase) ? (
                  <div
                    className="av-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label={`${label} comparison`}
                  >
                    <table>
                      <caption>Averages and sample counts</caption>
                      <thead>
                        <tr>
                          <th scope="col">Measured field</th>
                          {teams.map((team) => (
                            <th scope="col" key={team.teamNumber}>
                              {team.teamNumber}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics
                          .filter((metric) => metric.phase === phase)
                          .map((metric) => (
                            <tr key={metric.id}>
                              <th scope="row">
                                {metric.label}
                                <small>{metric.unit || "Question units"}</small>
                              </th>
                              {teams.map((team) => (
                                <td key={team.teamNumber}>
                                  {formatValue(team.metrics[metric.id]?.mean)}
                                  <small>
                                    n={team.metrics[metric.id]?.n || 0}
                                  </small>
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="a-muted">
                    No numeric fields mapped to {label.toLowerCase()}.
                  </p>
                )}
              </section>
            ))}
          </section>
          <section className="a-panel">
            <h2>Recent samples and scout notes</h2>
            <div className="av-comparison-notes">
              {teams.map((team) => (
                <section key={team.teamNumber}>
                  <h3>Team {team.teamNumber}</h3>
                  <p className="a-muted">
                    {team.metrics[metricId]?.values
                      ?.slice(-4)
                      .map(
                        (item) =>
                          `${matchLabel(item.matchKey)}: ${formatValue(item.value)}`,
                      )
                      .join("; ") || "No samples for the selected field."}
                  </p>
                  {team.notes.length ? (
                    team.notes.slice(-2).map((note) => (
                      <blockquote key={`${note.reportId}:${note.label}`}>
                        <strong>{note.label}</strong>
                        <p>{String(note.value)}</p>
                        <cite>
                          Scout report {String(note.reportId).slice(0, 8)}
                        </cite>
                      </blockquote>
                    ))
                  ) : (
                    <p className="a-muted">No written observations.</p>
                  )}
                  {team.unlinkedReportCount > 0 && (
                    <p className="av-data-note">
                      {team.unlinkedReportCount} reports excluded because the
                      event is unknown.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </section>
        </>
      )}
    </article>
  );
}

export function TeamPresentation({ analytics, teamNumber, onClose, onExport }) {
  const [index, setIndex] = useState(0),
    [exporting, setExporting] = useState(""),
    [exportError, setExportError] = useState(""),
    [fullScreen, setFullScreen] = useState(false);
  const dialogRef = useRef(null),
    closeRef = useRef(null),
    touchRef = useRef(null);
  const team = findTeam(analytics, teamNumber),
    sections = presentationSections(analytics, team),
    currentIndex = Math.min(index, Math.max(0, sections.length - 1));
  const titleId = useId(),
    slide = sections[currentIndex],
    metric =
      team &&
      Object.values(team.metrics).find((item) => isNumeric(item) && item.n > 0);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement,
      previousOverflow = document.body.style.overflow;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close?.();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  useEffect(() => {
    const update = () => setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const step = (direction) =>
    setIndex((value) =>
      Math.max(0, Math.min(sections.length - 1, value + direction)),
    );
  async function exportFile(format) {
    setExporting(format);
    setExportError("");
    try {
      await onExport?.(format, Number(teamNumber));
    } catch (error) {
      setExportError(error.message || "Export failed. Try again.");
    } finally {
      setExporting("");
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialogRef.current?.requestFullscreen?.();
    } catch {
      setExportError(
        "Full-screen access was unavailable. The presentation remains open.",
      );
    }
  }
  function keydown(event) {
    if (event.key === "Tab") {
      const elements = [
        ...dialogRef.current.querySelectorAll(
          'button:not(:disabled),a[href],select,input,[tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.target.closest('input,textarea,select,[contenteditable="true"]'))
      return;
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setIndex(sections.length - 1);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className="av-presentation av-root"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      onKeyDown={keydown}
    >
      <header className="av-presentation-toolbar">
        <span>
          Team {teamNumber}
          <small>{analytics?.event?.name || "No event selected"}</small>
        </span>
        <div className="av-actions">
          {onExport && (
            <>
              <button
                className="a-button"
                disabled={!!exporting || !team}
                onClick={() => exportFile("pdf")}
              >
                {exporting === "pdf" ? "Creating PDF…" : "Export PDF"}
              </button>
              <button
                className="a-button"
                disabled={!!exporting || !team}
                onClick={() => exportFile("pptx")}
              >
                {exporting === "pptx"
                  ? "Creating PowerPoint…"
                  : "Export PowerPoint"}
              </button>
            </>
          )}
          {typeof document.documentElement.requestFullscreen === "function" && (
            <button className="a-button" onClick={toggleFullscreen}>
              {fullScreen ? "Exit full screen" : "Full screen"}
            </button>
          )}
          <button
            ref={closeRef}
            className="a-button"
            onClick={() => onClose?.()}
          >
            Back to team
          </button>
        </div>
      </header>
      {exportError && (
        <p role="alert" className="a-danger av-export-error">
          {exportError}
        </p>
      )}
      <div
        className="av-slide-scroll"
        onPointerDown={(event) => {
          if (
            event.pointerType === "touch" &&
            !event.target.closest("button,a,input,select,textarea,summary")
          )
            touchRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = touchRef.current;
          touchRef.current = null;
          if (!start) return;
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4)
            step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          touchRef.current = null;
        }}
      >
        {slide && team ? (
          <section className="av-slide">
            <p className="av-slide-counter">
              Section {currentIndex + 1} of {sections.length}
            </p>
            <h1 id={titleId}>{slide.title}</h1>
            <p className="av-slide-subtitle">{slide.subtitle}</p>
            <div className="av-slide-content">
              <ul className="av-slide-lines">
                {slide.lines.map((line, lineIndex) => (
                  <li key={lineIndex}>{line}</li>
                ))}
              </ul>
              {currentIndex === 0 && (
                <dl className="av-facts">
                  <div>
                    <dt>Event reports</dt>
                    <dd>{team.reportCount}</dd>
                  </div>
                  <div>
                    <dt>Linked matches</dt>
                    <dd>{team.matchCount}</dd>
                  </div>
                  <div>
                    <dt>Coverage</dt>
                    <dd>{coverage(team)}</dd>
                  </div>
                </dl>
              )}
              {currentIndex === 1 && metric && (
                <>
                  <MetricFacts metric={metric} />
                  <DistributionChart metric={metric} />
                  <SampleNote metric={metric} />
                </>
              )}
              {currentIndex === 2 && <PhaseMetrics team={team} />}
              {currentIndex === 3 && metric && (
                <>
                  <TrendChart metric={metric} />
                  <SampleNote metric={metric} />
                </>
              )}
              {currentIndex === 6 && (
                <p className="av-data-note">
                  {team.confidence.coverageDefinition}
                </p>
              )}
            </div>
            <details className="av-slide-sources">
              <summary>
                Source reports ({slide.sourceIds.length}) and data freshness
              </summary>
              <p>
                Calculated {dateLabel(analytics.generatedAt)}. Latest report:{" "}
                {dateLabel(team.confidence.freshness)}.
              </p>
              <p>
                {slide.sourceIds.length
                  ? slide.sourceIds.join(", ")
                  : "No event-linked source reports."}
              </p>
            </details>
          </section>
        ) : (
          <section className="av-slide">
            <h1 id={titleId}>Team unavailable</h1>
            <p>Select a team with access to its scouting records.</p>
          </section>
        )}
      </div>
      <footer className="av-presentation-footer">
        <button
          className="a-button"
          disabled={currentIndex === 0 || !sections.length}
          onClick={() => step(-1)}
        >
          Previous
        </button>
        <nav aria-label="Presentation sections" className="av-slide-progress">
          {sections.map((section, slideIndex) => (
            <button
              key={section.title}
              type="button"
              aria-label={`Section ${slideIndex + 1}: ${section.title}`}
              aria-current={currentIndex === slideIndex ? "step" : undefined}
              onClick={() => setIndex(slideIndex)}
            >
              {slideIndex + 1}
            </button>
          ))}
        </nav>
        <button
          className="a-button"
          disabled={currentIndex >= sections.length - 1 || !sections.length}
          onClick={() => step(1)}
        >
          Next
        </button>
        <span className="av-reader-status" role="status">
          Section {currentIndex + 1} of {sections.length}: {slide?.title}
        </span>
      </footer>
    </dialog>
  );
}
