const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const packages = path.join(__dirname, '../node_modules/.pnpm');
const entry = fs.readdirSync(packages).find(name => name.startsWith('jsdom@'));
const { JSDOM } = require(path.join(packages, entry, 'node_modules/jsdom'));
const settle = () => new Promise(resolve => setImmediate(resolve));

test('team profiles load into their groups safely and recover after an API failure', async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'team.html'), 'utf8'), {
    url: 'https://va.example/team.html', runScripts: 'outside-only'
  });
  let failed = false;
  dom.window.fetch = async () => ({ok: !failed, json: async () => ({data: [
    {name: '<img src=x>', role: 'Director', group: 'leadership'},
    {name: 'Training Example', role: 'Training Coordinator', group: 'leadership'},
    {name: 'Vice President Example', role: 'Vice President', group: 'leadership'},
    {name: 'Assistant Example', role: 'Assistant Director', group: 'leadership'},
    {name: 'Senior Example', role: 'Senior Audit Manager', group: 'senior-audit-managers'},
    {name: 'Audit Example', role: 'Audit Manager', group: 'audit-managers'},
  ]})});
  try {
    dom.window.eval(fs.readFileSync(path.join(__dirname, 'team-page.js'), 'utf8'));
    await settle();
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.team-card').length, 6);
    assert.equal(doc.querySelector('#director-grid h4').textContent, '<img src=x>');
    assert.equal(doc.querySelector('#vice-president-grid h4').textContent, 'Vice President Example');
    assert.equal(doc.querySelector('#assistant-director-grid h4').textContent, 'Assistant Example');
    assert.equal(doc.querySelector('#training-coordinator-grid h4').textContent, 'Training Example');
    assert.equal(doc.querySelectorAll('#senior-audit-managers-grid .team-card').length, 1);
    assert.equal(doc.querySelector('#leadership-grid img'), null);
    failed = true;
    doc.querySelector('#refresh-team').click();
    await settle();
    assert.equal(doc.querySelectorAll('.team-card').length, 0);
    assert.match(doc.querySelector('#team-status').textContent, /Unable to load/);
    assert.equal(doc.querySelector('#leadership-empty').hidden, true);
    failed = false;
    doc.querySelector('#refresh-team').click();
    await settle();
    assert.equal(doc.querySelectorAll('.team-card').length, 6);
  } finally { dom.window.close(); }
});
