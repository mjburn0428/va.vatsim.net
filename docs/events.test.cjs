const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packages = path.join(__dirname, "../node_modules/.pnpm");
const entry = fs
  .readdirSync(packages)
  .find((name) => name.startsWith("jsdom@"));
const { JSDOM } = require(path.join(packages, entry, "node_modules/jsdom"));
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("local event preview shows editable fields without authentication or API requests", () => {
  for (const url of ["http://127.0.0.1:5500/nginx/events.html", "file:///workspace/nginx/events.html", "https://mjburn0428.github.io/va.vatsim.net/events.html?live=1"]) {
    const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "events.html"), "utf8"),
      { url, runScripts: "outside-only" });
    let requests = 0;
    if (url.includes("github.io")) dom.window.document.documentElement.dataset.staticPreview = "true";
    dom.window.fetch = () => { requests++; throw new Error("Preview must not call the API"); };
    try {
      dom.window.eval(fs.readFileSync(path.join(__dirname, "events.js"), "utf8"));
      const doc = dom.window.document;
      const form = doc.querySelector("#event-form");
      assert.equal(form.hidden, false);
      assert.equal(doc.querySelectorAll("#events-grid article").length, 3);
      assert.equal(doc.querySelectorAll("#events-grid img.event-banner").length, 3);
      assert.equal(doc.querySelector("#submit-button").textContent, "Submit");
      assert.match(doc.querySelector("#events-status").textContent, /fictional/);
      assert.equal(doc.querySelector("main > .actions > a.button").hash, "#submit-event");
      assert.equal(doc.querySelector("#submit-button").disabled, false);
      assert.equal(form.elements.namedItem("partner_id").value, "preview-va");
      form.reportValidity = () => true;
      const event = new dom.window.Event("submit", {cancelable: true});
      form.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      assert.match(doc.querySelector("#submission-status").textContent, /No event has been submitted/);
      form.elements.namedItem("title").value = "Clear this title";
      doc.querySelector("#clear-button").click();
      assert.equal(form.elements.namedItem("title").value, "");
      assert.equal(doc.querySelector("#submission-status").textContent, "");
      assert.equal(form.elements.namedItem("partner_id").value, "preview-va");
      assert.equal(requests, 0);
    } finally { dom.window.close(); }
  }
});
test("legacy form matches public fields and loads assets from the site root", () => {
  const publicPage = new JSDOM(
    fs.readFileSync(path.join(__dirname, "events.html"), "utf8"),
  );
  const legacyPage = new JSDOM(
    fs.readFileSync(
      path.join(__dirname, "../flask/templates/event_requests.html"),
      "utf8",
    ),
    { url: "https://va.example/ap/events/request/1234567" },
  );
  try {
    const fields = (doc) =>
      [...doc.querySelectorAll("#event-form [name]")].map((el) => [
        el.name,
        el.type,
        el.required,
        el.maxLength,
      ]);
    assert.deepEqual(
      fields(legacyPage.window.document),
      fields(publicPage.window.document),
    );
    assert.equal(
      legacyPage.window.document.querySelector('link[rel="stylesheet"]').href,
      "https://va.example/main.css",
    );
    assert.equal(
      legacyPage.window.document.querySelector("script[src]").src,
      "https://va.example/events.js",
    );
    assert.ok(
      legacyPage.window.document.querySelector(".event-submit-heading img"),
    );
    assert.equal(
      legacyPage.window.document.querySelectorAll(
        '[src*="jotfor"], [action*="jotfor"]',
      ).length,
      0,
    );
  } finally {
    publicPage.window.close();
    legacyPage.window.close();
  }
});
async function setup(fetch, sessionResponse) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "events.html"), "utf8"),
    { url: "https://va.example/events.html", runScripts: "outside-only" },
  );
  dom.window.fetch = (url, options) =>
    url === "/va-portal/session"
      ? Promise.resolve(
          sessionResponse || {
            ok: true,
            json: async () => ({
              csrf_token: "test-csrf",
              user: { name: "Example", cid: "1234567" },
              airlines: [{ id: "partner-id", name: "VA" }],
            }),
          },
        )
      : fetch(url, options);
  dom.window.eval(fs.readFileSync(path.join(__dirname, "events.js"), "utf8"));
  await settle();
  return dom;
}

test("anonymous visitors can view listings but cannot submit the hidden form", async () => {
  let posts = 0;
  const dom = await setup(
    async (url, options) => {
      if (options.method === "POST") posts++;
      return { ok: true, json: async () => ({ data: [], has_more: false }) };
    },
    {
      ok: false,
      json: async () => ({ error: "Sign in with VATSIM to submit an event." }),
    },
  );
  try {
    const form = dom.window.document.querySelector("#event-form");
    assert.equal(form.hidden, true);
    assert.equal(
      dom.window.document.querySelector("#submit-button").disabled,
      true,
    );
    assert.match(
      dom.window.document.querySelector("#events-status").textContent,
      /No upcoming events/,
    );
    assert.equal(
      dom.window.document.querySelector("#event-access a").pathname,
      "/va-portal/index.html",
    );
    form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    await settle();
    assert.equal(posts, 0);
  } finally {
    dom.window.close();
  }
});
test("listing renders event text safely and omits unsafe links", async () => {
  const dom = await setup(async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          title: "<img src=x>",
          airline: "Test VA",
          description: "<b>Flight</b>",
          starts_at: "2030-01-01T12:00:00Z",
          ends_at: "2030-01-01T15:00:00Z",
          event_url: "javascript:alert(1)",
        },
      ],
      has_more: false,
    }),
  }));
  try {
    const doc = dom.window.document;
    assert.equal(
      doc.querySelector(".event-card h3").textContent,
      "<img src=x>",
    );
    assert.equal(
      doc.querySelectorAll(".event-card img, .event-card b, .event-card a")
        .length,
      0,
    );
    assert.match(doc.querySelector(".event-time").textContent, /UTC/);
  } finally {
    dom.window.close();
  }
});
test("submissions send UTC dates and only clear the form after confirmation", async () => {
  let sent;
  const dom = await setup(async (url, options) => {
    if (options.method === "POST") {
      assert.equal(options.headers["X-CSRF-Token"], "test-csrf");
      assert.equal(options.credentials, "same-origin");
      sent = Object.fromEntries(options.body);
      return {
        ok: true,
        json: async () => ({
          id: "reference",
          message: "Submitted for review.",
        }),
      };
    }
    return { ok: true, json: async () => ({ data: [], has_more: false }) };
  });
  try {
    const doc = dom.window.document;
    const form = doc.querySelector("form");
    const year = new Date().getUTCFullYear() + 1;
    for (const [key, value] of Object.entries({
      title: "Test",
      region: "EMEA",
      country: "EMEA - United Kingdom",
      partner_id: "partner-id",
      description: "Flight",
      contact_email: "a@example.org",
      event_url: "https://example.org",
      starts_at: `${year}-01-01T12:00`,
      ends_at: `${year}-01-01T15:00`,
    }))
      form.elements.namedItem(key).value = value;
    form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    await settle();
    assert.equal(sent.starts_at, `${year}-01-01T12:00:00Z`);
    assert.equal(sent.status, undefined);
    assert.equal(sent.region, "EMEA");
    assert.equal(sent.country, "EMEA - United Kingdom");
    assert.match(
      doc.querySelector("#submission-status").textContent,
      /reference/,
    );
    assert.equal(form.elements.namedItem("title").value, "");
  } finally {
    dom.window.close();
  }
});
