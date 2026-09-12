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
async function setup(fetch) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "statistics.html"), "utf8"),
    { url: "https://va.example/statistics.html", runScripts: "outside-only" },
  );
  dom.window.fetch = fetch;
  dom.window.eval(
    fs.readFileSync(path.join(__dirname, "statistics.js"), "utf8"),
  );
  await settle();
  return dom;
}
const response = (data) => ({ ok: true, json: async () => ({ data }) });
test("counts all pages, excludes other tiers and groups countries safely", async () => {
  let calls = 0;
  const dom = await setup(async (url, options) => {
    calls++;
    assert.equal(options.credentials, "omit");
    const query = new URL(url, "https://va.example").searchParams;
    assert.equal(query.get("fields"), "Partnership_Tier,Country");
    assert.equal(query.get("sort"), "id");
    return response(
      query.get("page") === "1"
        ? Array.from({ length: 100 }, () => ({
            Partnership_Tier: "vap",
            Country: "Canada",
          }))
        : [
            { Partnership_Tier: "vaa", Country: " canada " },
            { Partnership_Tier: "vaa", Country: null },
            { Partnership_Tier: "vap", Country: "<img src=x>" },
            { Partnership_Tier: "disc" },
          ],
    );
  });
  try {
    const doc = dom.window.document;
    assert.equal(calls, 2);
    assert.equal(doc.querySelector("#total-count").textContent, "103");
    assert.equal(doc.querySelector("#partner-count").textContent, "101");
    assert.equal(doc.querySelector("#associate-count").textContent, "2");
    assert.equal(doc.querySelectorAll("#country-rows tr").length, 3);
    assert.equal(
      doc.querySelector("#country-rows tr td:last-child").textContent,
      "101",
    );
    assert.equal(doc.querySelectorAll("#country-rows img").length, 0);
    assert.match(
      doc.querySelector("#country-rows").textContent,
      /Not specified/,
    );
  } finally {
    dom.window.close();
  }
});
test("failure clears totals and retry can show a true zero", async () => {
  let calls = 0;
  const dom = await setup(async () =>
    ++calls === 1
      ? response([{ Partnership_Tier: "vap" }])
      : calls === 2
        ? { ok: false }
        : response([]),
  );
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector("#total-count").textContent, "1");
    doc.querySelector("button").click();
    await settle();
    assert.equal(doc.querySelector("#total-count").textContent, "—");
    assert.match(
      doc.querySelector("#statistics-status").textContent,
      /unavailable/,
    );
    assert.equal(doc.querySelectorAll("#country-rows tr").length, 0);
    doc.querySelector("button").click();
    await settle();
    assert.equal(doc.querySelector("#total-count").textContent, "0");
    assert.equal(doc.querySelector("#country-empty").hidden, false);
    assert.equal(
      doc.querySelector("#statistics-results").getAttribute("aria-busy"),
      "false",
    );
  } finally {
    dom.window.close();
  }
});
