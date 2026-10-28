import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../Clasue-scout-app/package.json', import.meta.url));
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const appVersion = require('../Clasue-scout-app/package.json').version;

const baseURL = process.env.QA_BASE_URL;
assert.ok(baseURL && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname), 'Accessibility checks require an explicit loopback QA_BASE_URL and disposable fixture server.');
const artifacts = process.env.QA_ARTIFACT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'argus-accessibility-qa-'));
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, ...(process.env.EDGE_EXECUTABLE ? { executablePath: process.env.EDGE_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow' });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
async function audit(name, width) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  // Axe classifies names on generic div/span elements as manual review. This
  // bounded extra check catches the known concrete case: the generic role has
  // no accessible name. Do not promote unrelated incomplete rules to failures.
  const genericNameFailures = await page.locator('div[aria-label]:not([role]), span[aria-label]:not([role])').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ html: node.outerHTML.slice(0, 500), label: node.getAttribute('aria-label') })));
  const missingControlledIds = await page.locator('[aria-controls]').evaluateAll(nodes => nodes.flatMap(node => node.getAttribute('aria-controls').trim().split(/\s+/).filter(id => !document.getElementById(id)).map(id => ({ id, html: node.outerHTML.slice(0, 500) }))));
  const entry = { name, width, url: page.url(), genericNameFailures, missingControlledIds, violations: result.violations.map(rule => ({ id: rule.id, impact: rule.impact, description: rule.description, help: rule.help, helpUrl: rule.helpUrl, nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) })), incomplete: result.incomplete.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), passes: result.passes.map(rule => rule.id) };
  results.push(entry);
  await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'accessibility-results.json'), JSON.stringify({ checked_at: new Date().toISOString(), appVersion, browser: await browser.version(), axe: result.testEngine, tags, results, pageErrors: errors, limitations: 'Automated rules only; incomplete checks and manual keyboard, screen-reader, zoom, touch, and physical-device checks require separate review.' }, null, 2));
  console.log(JSON.stringify({ name, width, genericNameFailures: genericNameFailures.length, missingControlledIds: missingControlledIds.length, violations: entry.violations.map(rule => ({ id: rule.id, nodes: rule.nodes.length })), incomplete: entry.incomplete.map(rule => rule.id) }));
}
async function route(destination, ready) {
  await page.evaluate(value => { location.hash = value; }, destination);
  if (ready) await ready();
  else await page.locator('#workspace-main h1, #workspace-main h2').first().waitFor();
  await page.waitForTimeout(300);
}
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, destination, heading] of [['welcome', '/', 'Scout every match. Make every decision count.'], ['login', '/login', 'Sign in'], ['signup', '/signup', 'Create an account']]) {
      await page.goto(`${baseURL}/#${destination}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await audit(name, width);
    }
  }
  await page.goto(`${baseURL}/#/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Username', { exact: true }).fill('qa_owner');
  await page.getByLabel('Password', { exact: true }).fill('ArgusQA2026!');
  await page.locator('.auth-submit').click(); await page.locator('.argus-app').waitFor();
  const cases = [
    ['dashboard', '/dashboard'], ['match-schedule', '/matches'],
    ['match-form', '/match?event_key=2026qa&match_key=2026qa_qm4&scouted_team=6390&form_id=qa-match-form&assignment_id=qa-assignment', () => page.getByRole('heading', { name: 'QA match report', exact: true }).waitFor()],
    ['pit-form', '/pit?form_id=qa-pit-form', () => page.getByRole('heading', { name: 'QA pit report', exact: true }).waitFor()],
    ['teams', '/teams'], ['team-profile', '/teams/254'], ['comparison', '/compare?teams=254,1678'],
    ['admin', '/admin'], ['assignments', '/assignments'], ['strategy', '/strategy'],
    ['reports', '/reports'], ['help', '/help'], ['settings', '/settings'],
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, destination, ready] of cases) {
      await route(destination, ready);
      await audit(name, width);
      if (name === 'team-profile') {
        const tabs = page.getByRole('tab');
        for (const tab of await tabs.all()) {
          const label = (await tab.innerText()).trim();
          await tab.click(); await audit(`profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, width);
        }
      }
      if (name === 'reports') {
        const browse = page.getByRole('button', { name: 'View all forms', exact: true });
        if (await browse.count()) { await browse.click(); await audit('report-browser', width); }
      }
    }
    if (width === 390) {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('dialog', { name: 'More', exact: true }).waitFor();
      await audit('more-dialog', width); await page.keyboard.press('Escape');
    }
  }
  const violations = results.reduce((sum, result) => sum + result.violations.length, 0);
  const genericNames = results.reduce((sum, result) => sum + result.genericNameFailures.length, 0);
  const missingIds = results.reduce((sum, result) => sum + result.missingControlledIds.length, 0);
  console.log(JSON.stringify({ artifacts, states: results.length, violationRulesAcrossStates: violations, genericNameFailures: genericNames, missingControlledIds: missingIds, pageErrors: errors.length }));
  assert.equal(errors.length, 0, 'Application errors occurred during accessibility checks.');
  assert.equal(violations, 0, 'Accessibility rule violations remain; inspect accessibility-results.json.');
  assert.equal(genericNames, 0, 'Names on generic containers are not exposed reliably; inspect accessibility-results.json.');
  assert.equal(missingIds, 0, 'aria-controls references a missing element; inspect accessibility-results.json.');
} finally { await context.close(); await browser.close(); }
