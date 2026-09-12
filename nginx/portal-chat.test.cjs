const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const packages = path.join(__dirname, '../node_modules/.pnpm');
const entry = fs.readdirSync(packages).find(name => name.startsWith('jsdom@'));
const {JSDOM} = require(path.join(packages, entry, 'node_modules/jsdom'));
const settle = () => new Promise(resolve => setImmediate(resolve));

test('chat renders safe text, retries without duplicate IDs, and clears revoked access', async () => {
  const dom = new JSDOM(`<section data-chat="/va-portal/api/chat/example" data-csrf="test-csrf"><div class="chat-messages"></div><p class="chat-status"></p><form><textarea name="message" required></textarea><button type="submit" disabled>Send</button><button type="button" class="chat-refresh">Refresh</button></form></section>`, {url:'https://va.example/va-portal/', runScripts:'outside-only'});
  let revoked = false;
  const sent = [];
  dom.window.fetch = async (url, options) => {
    if (options.method === 'POST') {
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.headers['X-CSRF-Token'], 'test-csrf');
      sent.push(JSON.parse(options.body));
      return {ok:sent.length > 1, status:sent.length > 1 ? 201 : 503, json:async()=>({message:'Sent', error:'Retry to confirm'})};
    }
    return revoked ? {ok:false,status:403,json:async()=>({error:'Access revoked'})} : {ok:true,json:async()=>({cycle:'2026-09-08',has_more:false,data:[{id:1,name:'Example',role:'Audit Manager',body:'<img src=x onerror=alert(1)>',sent_at:'2026-09-11T12:00:00Z',mine:false}]})};
  };
  try {
    dom.window.eval(fs.readFileSync(path.join(__dirname, 'portal-chat.js'), 'utf8'));
    await settle();
    const doc = dom.window.document;
    assert.equal(doc.querySelector('.chat-message img'), null);
    assert.match(doc.querySelector('.chat-message').textContent, /<img/);
    const form = doc.querySelector('form');
    form.elements.message.value = 'Here is my update';
    form.dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
    await settle();
    assert.equal(form.elements.message.value, 'Here is my update');
    form.dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
    await settle();
    assert.equal(sent[0].client_id, sent[1].client_id);
    assert.equal(sent[0].cycle, '2026-09-08');
    assert.equal(form.elements.message.value, '');
    revoked = true;
    doc.querySelector('.chat-refresh').click();
    await settle();
    assert.equal(doc.querySelectorAll('.chat-message').length, 0);
    assert.equal(doc.querySelector('[type="submit"]').disabled, true);
  } finally {dom.window.close();}
});
