import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../app-version.js';

const examples = [
  {id:'workspace',label:'Event workspace',title:'Everyone knows what comes next.',body:'Bring the event schedule, team assignments, and match entry into one place. Scouts keep responsibility for their assigned teams across the event.',example:'Before qualification 12: check your assigned team, open the match, and start the right report.',alt:'Illustrated Argus dashboard showing the next match, labelled red and blue alliances, persistent team responsibilities and upcoming matches.'},
  {id:'scouting',label:'Match scouting',title:'From the first observation to a saved report.',body:'Capture match performance and pit observations with your team’s forms. Match, team, alliance, and assignment context stay with the evidence.',example:'Connection drops in the stands? A prepared device keeps scouting available. Your report stays pending until the server confirms it.',alt:'Illustrated match form showing team 1001 in qualification 12, autonomous and teleoperated counts, and an offline report waiting for server confirmation.'},
  {id:'comparison',label:'Compare and choose',title:'Go into alliance selection with evidence.',body:'Compare teams side by side, inspect source reports, and keep your alliance picklist together. Missing data and conflicting reports stay visible.',example:'Two teams look close? Compare their linked match medians and coverage, then add a reminder to review the evidence.',alt:'Illustrated comparison of three sample teams showing autonomous and teleoperated medians, linked match counts, coverage and alliance picklist notes.'},
  {id:'pit-display',label:'Pit display',title:'Bring the whole pit into the picture.',body:'Put the match schedule on a shared display. Use team presentations and PDF or PowerPoint exports to bring scouting findings into strategy conversations.',example:'Before the next match: review the downloaded schedule in the pit, then share a team presentation with your strategy group.',alt:'Illustrated pit display with the next qualification match and clearly labelled red and blue alliances.'},
];

export default function WelcomeScreen({ signedIn=false }) {
  const main=useRef(null);
  const [selected,setSelected]=useState(0);
  const preview=examples[selected];
  useEffect(()=>{main.current?.focus();},[]);
  const explore=event=>{event.preventDefault();document.getElementById('product-examples')?.focus();document.getElementById('product-examples')?.scrollIntoView({block:'start'});};
  const access=signedIn?'#/dashboard':'#/signup';
  return <div className="argus-public">
    <a className="a-skip" href="#welcome-main" onClick={event=>{event.preventDefault();main.current?.focus();}}>Skip to content</a>
    <header className="a-public-header">
      <span className="a-public-brand">Argus <span>FRC scouting</span></span>
      <nav aria-label="Welcome navigation"><a className="a-public-explore" href="#product-examples" onClick={explore}>Explore Argus</a>{signedIn?<a className="a-button a-primary" href="#/dashboard">Open workspace</a>:<><a className="a-button" href="#/login">Log in</a><a className="a-button a-primary" href={access}>Start now</a></>}</nav>
    </header>
    <main id="welcome-main" tabIndex={-1} ref={main}>
      <section className="a-public-hero a-product-hero" aria-labelledby="welcome-title">
        <div className="a-product-intro">
          <p className="a-public-kicker">Built by FRC 6390 · Hephaestus</p>
          <h1 id="welcome-title">Scout every match. Make every decision count.</h1>
          <p>From the stands to alliance selection, Argus brings your team’s scouting into one workspace. Capture observations, coordinate scouts, and turn shared evidence into your next decision.</p>
          <div className="a-public-actions"><a className="a-button a-primary" href={access}>{signedIn?'Open workspace':'Start now'}</a><a className="a-button" href="#product-examples" onClick={explore}>See how it works</a></div>
          <p className="a-public-caption">Match and pit scouting · Team comparison · Alliance picklists</p>
        </div>
        <figure className="a-product-hero-image"><img src="/product/workspace.svg" width="1120" height="680" fetchPriority="high" alt={examples[0].alt}/><figcaption>One workspace, from your next assignment to your next match. Illustrative preview with sample data.</figcaption></figure>
      </section>
      <div className="a-product-capabilities" role="group" aria-label="Argus capabilities"><span>Match + pit scouting</span><span>Offline on prepared devices</span><span>Evidence behind the numbers</span><span>Built by an FRC team</span></div>
      <section id="product-examples" tabIndex={-1} className="a-public-section a-product-examples" aria-labelledby="examples-title">
        <div className="a-product-section-intro"><p className="a-public-kicker">See the workflow</p><h2 id="examples-title">Less scattered information. More shared understanding.</h2><p>Explore how Argus fits into a competition day. These are illustrated product previews; all teams, names, and numbers are sample data.</p></div>
        <div className="a-product-selector" role="group" aria-label="Product examples">{examples.map((item,index)=><button key={item.id} className="a-button" type="button" aria-pressed={selected===index} aria-controls="product-preview" onClick={()=>setSelected(index)}>{item.label}</button>)}</div>
        <div id="product-preview" className="a-product-preview">
          <figure><img src={`/product/${preview.id}.svg`} width="1120" height="680" loading="lazy" alt={preview.alt}/><figcaption>Illustrative preview · Sample data<br/><a href={`/product/${preview.id}.svg`} target="_blank" rel="noopener noreferrer">Open full-size preview</a></figcaption></figure>
          <div className="a-product-example-copy"><h3>{preview.title}</h3><p>{preview.body}</p><div className="a-product-scenario"><strong>At your event</strong><p>{preview.example}</p></div></div>
        </div>
        {preview.id==='comparison'&&<details className="a-product-sample-data"><summary>Read the sample comparison data</summary><div className="a-table-wrap" role="region" aria-label="Sample comparison data" tabIndex={0}><table><caption>Illustrative values only. Coverage uses five completed scheduled matches per team.</caption><thead><tr><th scope="col">Metric</th><th scope="col">1001</th><th scope="col">1004</th><th scope="col">1006</th></tr></thead><tbody><tr><th scope="row">Autonomous pieces, match median</th><td>4</td><td>3</td><td>5</td></tr><tr><th scope="row">Teleop pieces, match median</th><td>12</td><td>14</td><td>9</td></tr><tr><th scope="row">Linked matches</th><td>4</td><td>3</td><td>4</td></tr><tr><th scope="row">Completed-match coverage</th><td>4 / 5</td><td>3 / 5</td><td>4 / 5</td></tr></tbody></table></div></details>}
      </section>
      <section className="a-public-section" aria-labelledby="why-argus">
        <div className="a-product-section-intro"><p className="a-public-kicker">The rest of your scouting toolkit</p><h2 id="why-argus">Built for the work around every match.</h2></div>
        <dl className="a-public-features">
          <div><dt>Give every scout a clear job</dt><dd>Manage team responsibilities, handle match handoffs, and keep pit and match assignments connected throughout the event.</dd></div>
          <div><dt>Run your team’s workspace</dt><dd>Admins organize events, forms, access, and scouting responsibilities. Training and practice help scouts get familiar before competition.</dd></div>
          <div><dt>Trace a number back to its source</dt><dd>Team profiles and comparisons expose report references, sample sizes, missing answers, and disagreements. Review the evidence before making the call.</dd></div>
          <div><dt>Keep your strategy together</dt><dd>Build alliance picklists with notes, review team presentations, and export findings as PDF or PowerPoint for your next discussion.</dd></div>
        </dl>
      </section>
      <section className="a-public-section" aria-labelledby="how-argus">
        <p className="a-public-kicker">Get your team ready</p><h2 id="how-argus">From setup to the stands in three steps.</h2>
        <ol className="a-public-steps">
          <li><h3>Create an account and join your team</h3><p>Start now to create your account. Join your team’s workspace using its team details, or create a workspace for your team.</p></li>
          <li><h3>Prepare for the event</h3><p>Set up the event, forms, and assignments. While connected, open your workspace and use “Sync &amp; prepare device” on each scouting device.</p></li>
          <li><h3>Scout, review, and choose</h3><p>Record matches and pit observations. Compare the evidence together, keep your picklist current, and share what your team has learned.</p></li>
        </ol>
      </section>
      <section className="a-public-offline" aria-labelledby="offline-argus">
        <p className="a-public-kicker">Ready for unreliable event Wi-Fi</p><h2 id="offline-argus">Keep scouting when the connection drops.</h2>
        <p>Sign in and prepare each device while connected. Existing scouts reopen their saved workspace automatically, including offline. Drafts stay on the device; queued reports wait for server confirmation after reconnection.</p>
        <details><summary>What to know before going offline</summary><p>Use the same browser or installed app and stay signed in. A first visit, a new login, or joining a new team needs a connection. Clearing browser site data removes locally stored drafts and queued reports. Check sync status after reconnecting to confirm your reports reached the server.</p></details>
      </section>
      <section className="a-public-section a-public-credit" aria-labelledby="credits-argus">
        <div><p className="a-public-kicker">By a robotics team, for robotics teams</p><h2 id="credits-argus">Built by Hephaestus</h2><p>Developed by FRC Team 6390, Hephaestus. Argus brings match scouting, pit scouting, and team strategy into one place, so your team can spend more time using its observations.</p></div>
        <div className="a-product-final-action"><h3>Bring your scouting together.</h3><a className="a-button a-primary" href={access}>{signedIn?'Open workspace':'Start now'}</a>{!signedIn&&<a href="#/login">Already have an account? Log in</a>}</div>
      </section>
    </main>
    <footer className="a-public-footer"><span>Argus {APP_VERSION} · FRC 6390</span><a href="/third-party-notices.txt">Third-party notices</a><a href={signedIn?'#/dashboard':'#/login'}>{signedIn?'Return to your workspace':'Log in to your workspace'}</a></footer>
  </div>;
}
