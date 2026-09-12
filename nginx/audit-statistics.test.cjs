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
    fs.readFileSync(path.join(__dirname, "audit-statistics.html"), "utf8"),
    {
      url: "https://va.example/audit-statistics.html",
      runScripts: "outside-only",
    },
  );
  dom.window.fetch = fetch;
  dom.window.eval(
    fs.readFileSync(path.join(__dirname, "audit-statistics.js"), "utf8"),
  );
  await settle();
  return dom;
}
test("sorts quarters chronologically and filters totals by year", async () => {
  const dom = await setup(async () => ({
    ok: true,
    json: async () => ({
      data: [
        { year: 2026, quarter: 2, audits: 15, failed: 15 },
        { year: 2025, quarter: 4, audits: 10, failed: 2 },
        { year: 2026, quarter: 1, audits: 20, failed: 0 },
      ],
    }),
  }));
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector("#audit-total").textContent, "45");
    assert.equal(doc.querySelector("#audit-failed").textContent, "17");
    assert.equal(doc.querySelector("#audit-rows tr td:last-child").textContent, "2");
    assert.equal(doc.querySelector("#audit-latest").textContent, "2026 Q2");
    assert.equal(doc.querySelector("#audit-rows th").textContent, "2025 Q4");
    const year = doc.querySelector("select");
    year.value = "2026";
    year.dispatchEvent(new dom.window.Event("change"));
    assert.equal(doc.querySelector("#audit-total").textContent, "35");
    assert.equal(doc.querySelector("#audit-failed").textContent, "15");
    assert.equal(doc.querySelectorAll("#audit-chart > div").length, 2);
    assert.equal(doc.querySelectorAll("#audit-rows tr").length, 2);
  } finally {
    dom.window.close();
  }
});
test("failed refresh clears stale totals and allows retry", async () => {
  let calls = 0;
  const dom = await setup(async () =>
    ++calls === 1
      ? {
          ok: true,
          json: async () => ({
            data: [{ year: 2026, quarter: 1, audits: 12, failed: 3 }],
          }),
        }
      : { ok: false },
  );
  try {
    const doc = dom.window.document;
    doc.querySelector("button").click();
    await settle();
    assert.equal(doc.querySelector("#audit-total").textContent, "—");
    assert.equal(doc.querySelectorAll("#audit-rows tr").length, 0);
    assert.equal(doc.querySelector("#audit-failed").textContent, "\u2014");
    assert.equal(doc.querySelector("button").disabled, false);
    assert.match(doc.querySelector("#audit-status").textContent, /unavailable/);
  } finally {
    dom.window.close();
  }
});
