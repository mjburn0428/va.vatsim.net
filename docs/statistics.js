(() => {
  "use strict";
  const status = document.querySelector("#statistics-status");
  const refresh = document.querySelector("#refresh-statistics");
  const results = document.querySelector("#statistics-results");
  const rows = document.querySelector("#country-rows");
  const numbers = new Intl.NumberFormat();

  async function load() {
    refresh.disabled = true;
    results.setAttribute("aria-busy", "true");
    status.textContent = "Loading statistics from AMS…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const query = new URLSearchParams({
        fields: "Partnership_Tier,Country",
        "filter[Partnership_Tier][_in]": "vap,vaa",
        sort: "id",
        limit: "100",
      });
      const totals = { vap: 0, vaa: 0 };
      const countries = new Map();
      for (let page = 1; ; page++) {
        query.set("page", String(page));
        const response = await fetch(`/api/partners?${query}`, {
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("AMS unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.data))
          throw new Error("Invalid AMS response");
        for (const record of payload.data) {
          if (!record || !["vap", "vaa"].includes(record.Partnership_Tier))
            continue;
          const tier = record.Partnership_Tier;
          totals[tier]++;
          const country =
            typeof record.Country === "string" && record.Country.trim()
              ? record.Country.trim()
              : "Not specified";
          const key = country.toLocaleLowerCase();
          if (!countries.has(key))
            countries.set(key, { name: country, vap: 0, vaa: 0 });
          countries.get(key)[tier]++;
        }
        if (payload.data.length < 100) break;
      }
      document.querySelector("#total-count").textContent = numbers.format(
        totals.vap + totals.vaa,
      );
      document.querySelector("#partner-count").textContent = numbers.format(
        totals.vap,
      );
      document.querySelector("#associate-count").textContent = numbers.format(
        totals.vaa,
      );
      rows.replaceChildren();
      const sorted = [...countries.values()].sort(
        (a, b) =>
          b.vap + b.vaa - (a.vap + a.vaa) || a.name.localeCompare(b.name),
      );
      for (const country of sorted) {
        const row = document.createElement("tr");
        [
          country.name,
          country.vap,
          country.vaa,
          country.vap + country.vaa,
        ].forEach((value, index) => {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          cell.textContent =
            typeof value === "number" ? numbers.format(value) : value;
          row.append(cell);
        });
        rows.append(row);
      }
      document.querySelector("#country-empty").hidden = sorted.length > 0;
      status.textContent = `Updated ${new Date().toLocaleString()}. Source: AMS public directory.`;
    } catch {
      // Do not leave old or partially fetched totals presented as current.
      for (const id of ["total-count", "partner-count", "associate-count"])
        document.getElementById(id).textContent = "—";
      rows.replaceChildren();
      document.querySelector("#country-empty").hidden = true;
      status.textContent =
        "Statistics are temporarily unavailable. Please try refreshing shortly.";
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
      results.setAttribute("aria-busy", "false");
    }
  }
  refresh.addEventListener("click", load);
  load();
})();
