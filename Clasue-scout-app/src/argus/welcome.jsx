import { useEffect, useRef } from 'react';
import { APP_VERSION } from '../app-version.js';

export default function WelcomeScreen() {
  const main=useRef(null);
  useEffect(()=>{main.current?.focus();},[]);
  return <div className="argus-public">
    <a className="a-skip" href="#welcome-main" onClick={event=>{event.preventDefault();main.current?.focus();}}>Skip to content</a>
    <header className="a-public-header">
      <span className="a-public-brand">Argus <span>FRC scouting</span></span>
      <nav aria-label="Welcome navigation"><a className="a-button" href="#/login">Log in</a><a className="a-button a-primary" href="#/signup">Start now</a></nav>
    </header>
    <main id="welcome-main" tabIndex={-1} ref={main}>
      <section className="a-public-hero" aria-labelledby="welcome-title">
        <p className="a-public-kicker">Built by FRC 6390 · The Flusters</p>
        <h1 id="welcome-title">Your team’s scouting, from the stands to alliance selection.</h1>
        <p>Argus is a match and pit scouting workspace for FIRST Robotics Competition teams. Record what you see, organize your scouts, and use shared evidence to make team and alliance decisions.</p>
        <div className="a-public-actions"><a className="a-button a-primary" href="#/signup">Start now</a><a className="a-button" href="#/login">Log in</a></div>
        <p className="a-public-caption">Already scouting with Argus? A saved account and downloaded workspace reopen automatically on this device, including offline.</p>
      </section>
      <section className="a-public-section" aria-labelledby="why-argus">
        <h2 id="why-argus">Why use Argus?</h2>
        <dl className="a-public-features">
          <div><dt>Keep scouting together</dt><dd>Use match and pit forms, schedules, and team assignments in one workspace. Admins manage access, forms, and scouting responsibilities.</dd></div>
          <div><dt>Make decisions with evidence</dt><dd>Review team profiles, compare teams, and build alliance picklists. Check source reports, sample sizes, missing data, and conflicting observations alongside the numbers.</dd></div>
          <div><dt>Bring the data to your team</dt><dd>Use the pit display, team presentations, and PDF or PowerPoint exports to share scouting findings during event planning and alliance discussions.</dd></div>
          <div><dt>Keep working without a connection</dt><dd>Prepared devices keep downloaded scouting data available. Drafts save on your device, and queued reports wait for server confirmation when you reconnect.</dd></div>
        </dl>
      </section>
      <section className="a-public-section" aria-labelledby="how-argus">
        <h2 id="how-argus">How it works</h2>
        <ol className="a-public-steps">
          <li><h3>Create an account and join your team</h3><p>Start now to create your account. Join your team’s workspace using its team details, or create a workspace for your team.</p></li>
          <li><h3>Prepare for the event</h3><p>Set up the event, scouting forms, and assignments. While connected, open your workspace and use “Sync &amp; prepare device” before heading to the stands.</p></li>
          <li><h3>Scout, review, and choose</h3><p>Record match performance and pit observations. Review the evidence together, compare teams, and maintain your alliance picklist as the event develops.</p></li>
        </ol>
      </section>
      <section className="a-public-offline" aria-labelledby="offline-argus">
        <h2 id="offline-argus">Before you go offline</h2>
        <p>Sign in and prepare each device while connected. Keep that account signed in and use the same browser or installed app. A first visit, a new login, or joining a new team needs a connection.</p>
        <p>Keep browser site data: clearing it removes locally stored drafts and queued reports. After reconnecting, check sync status to confirm your reports have reached the server.</p>
      </section>
      <section className="a-public-section a-public-credit" aria-labelledby="credits-argus">
        <h2 id="credits-argus">Built by the Flusters</h2>
        <p>Argus is developed by FRC Team 6390, the Flusters, to support match scouting, pit scouting, and team strategy.</p>
        <a className="a-button a-primary" href="#/signup">Start now</a>
      </section>
    </main>
    <footer className="a-public-footer"><span>Argus {APP_VERSION} · FRC 6390</span><a href="#/login">Log in to your workspace</a></footer>
  </div>;
}
