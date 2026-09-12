const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// Use the workspace's existing jsdom dependency without adding a frontend build.
const packages = path.join(__dirname, "../node_modules/.pnpm");
const jsdomPackage = fs
  .readdirSync(packages)
  .find((name) => name.startsWith("jsdom@"));
const { JSDOM } = require(
  path.join(packages, jsdomPackage, "node_modules/jsdom"),
);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "partners.js"), "utf8");
const row = (Name, Partnership_Tier = "vap", extra = {}) => ({
  Name,
  Partnership_Tier,
  ...extra,
});
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function setup(fetch, team = []) {
  const dom = new JSDOM(html, {
    url: "https://va.example/",
    runScripts: "outside-only",
  });
  dom.window.fetch = fetch;
  dom.window.VA_TEAM = team;
  dom.window.eval(script);
  await settle();
  return dom;
}
const response = (data) => ({ ok: true, json: async () => ({ data }) });

test("directory filters, search, safe content and logo fallback", async () => {
  const dom = await setup(async () =>
    response([
      row("Alpha", "vap", {
        Country: "Canada",
        Callsigns: ["ALP"],
        Website_Link: "https://example.com",
        Logo: "12345678-1234-1234-1234-123456789abc",
      }),
      row("<img src=x onerror=alert(1)>", "vaa", {
        Website_Link: "javascript:alert(1)",
      }),
      row("Unlisted", "unknown"),
    ]),
  );
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll(".partner-card").length, 2);
    assert.equal(doc.querySelectorAll(".partner-details a").length, 1);
    assert.equal(
      doc.querySelector(".partner-details h3").textContent,
      "<img src=x onerror=alert(1)>",
    );
    assert.equal(doc.querySelectorAll(".partner-details h3 img").length, 0);
    const logo = doc.querySelector(".partner-logo img");
    logo.dispatchEvent(new dom.window.Event("error"));
    assert.equal(doc.querySelectorAll(".partner-logo img").length, 0);
    doc.querySelector('[data-tier="vap"]').click();
    assert.equal(doc.querySelectorAll(".partner-card").length, 1);
    const search = doc.querySelector("input");
    search.value = "alp";
    search.dispatchEvent(new dom.window.Event("input"));
    assert.equal(doc.querySelectorAll(".partner-card").length, 1);
    search.value = "nonexistent";
    search.dispatchEvent(new dom.window.Event("input"));
    assert.match(
      doc.querySelector("#directory-status").textContent,
      /No airlines match/,
    );
  } finally {
    dom.window.close();
  }
});

test("fetches all pages using public fields and anonymous requests", async () => {
  const calls = [];
  const dom = await setup(async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, "omit");
    const query = new URL(url, "https://va.example").searchParams;
    assert.equal(
      query.get("fields"),
      "Name,Logo,Website_Link,Country,Callsigns,Partnership_Tier",
    );
    assert.equal(query.get("filter[Partnership_Tier][_in]"), "vap,vaa,disc");
    return response(
      query.get("page") === "1"
        ? Array.from({ length: 100 }, (_, i) => row(`Airline ${i}`))
        : [row("Last airline")],
    );
  });
  try {
    assert.equal(calls.length, 2);
    assert.equal(
      dom.window.document.querySelectorAll(".partner-card").length,
      101,
    );
  } finally {
    dom.window.close();
  }
});

test("Discord-only VAs appear in All airlines and their own searchable category", async () => {
  const dom = await setup(async () =>
    response([
      row("Partner airline"),
      row("Discord Flyers", "disc", {
        Country: "Canada",
        Website_Link: "https://discord.gg/example",
      }),
    ]),
  );
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll(".partner-card").length, 2);
    doc.querySelector('[data-tier="disc"]').click();
    assert.equal(doc.querySelectorAll(".partner-card").length, 1);
    assert.equal(doc.querySelector(".badge").textContent, "Discord-only VA");
    assert.match(
      doc.querySelector("#directory-status").textContent,
      /Discord-only VA/,
    );
    assert.equal(
      doc.querySelector(".partner-details a").href,
      "https://discord.gg/example",
    );
    const search = doc.querySelector("input");
    search.value = "Canada";
    search.dispatchEvent(new dom.window.Event("input"));
    assert.equal(doc.querySelectorAll(".partner-card").length, 1);
    doc.querySelector('[data-tier="vap"]').click();
    assert.equal(doc.querySelectorAll(".partner-card").length, 0);
  } finally {
    dom.window.close();
  }
});

test("failure can be retried and an empty result ends loading", async () => {
  let attempts = 0;
  const dom = await setup(async () =>
    ++attempts === 1 ? { ok: false } : response([]),
  );
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector("#retry-directory").hidden, false);
    assert.equal(
      doc.querySelector("#partner-grid").getAttribute("aria-busy"),
      "false",
    );
    doc.querySelector("#retry-directory").click();
    await settle();
    assert.equal(doc.querySelector("#retry-directory").hidden, true);
    assert.match(
      doc.querySelector("#directory-status").textContent,
      /no airlines to display/,
    );
  } finally {
    dom.window.close();
  }
});

test("homepage totals count Partners and Associates independently of directory filters", async () => {
  const dom = await setup(async () =>
    response([
      { Name: "Partner One", Partnership_Tier: "vap" },
      { Name: "Partner Two", Partnership_Tier: "vap" },
      { Name: "Associate", Partnership_Tier: "vaa" },
      { Name: "Discord VA", Partnership_Tier: "disc" },
    ]),
  );
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector("#home-total-count").textContent, "3");
    assert.equal(doc.querySelector("#home-partner-count").textContent, "2");
    assert.equal(doc.querySelector("#home-associate-count").textContent, "1");
    doc.querySelector("#airline-search").value = "No match";
    doc
      .querySelector("#airline-search")
      .dispatchEvent(new dom.window.Event("input"));
    assert.equal(doc.querySelector("#home-total-count").textContent, "3");
    dom.window.fetch = async () => ({ ok: false });
    doc.querySelector("#refresh-home-statistics").click();
    await settle();
    assert.equal(doc.querySelector("#home-total-count").textContent, "\u2014");
    assert.match(
      doc.querySelector("#homepage-statistics-status").textContent,
      /unavailable/,
    );
  } finally {
    dom.window.close();
  }
});
