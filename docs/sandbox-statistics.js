(() => {
  "use strict";
  const home = Boolean(document.querySelector("#homepage-statistics"));
  const prefix = home ? "home-" : "";
  const status = document.querySelector(home ? "#homepage-statistics-status" : "#statistics-status");
  const refresh = document.querySelector(home ? "#refresh-home-statistics" : "#refresh-statistics");
  const container = document.querySelector(home ? "#homepage-statistics" : "#statistics-results");
  const grid = home ? container : container.querySelector(".statistics-grid");
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(min(100%, 220px), 1fr))";
  const numbers = new Intl.NumberFormat();
  const card = document.createElement("article");
  card.className = "program-card";
  const title = document.createElement(home ? "h3" : "h2");
  title.textContent = "DOVA";
  const count = document.createElement("p");
  count.id = prefix + "dova-count";
  count.className = "stat-value";
  const detail = document.createElement("p");
  detail.textContent = "Discord-only Virtual Airlines";
  card.append(title, count, detail);
  grid.append(card);
  if (home) {
    document.querySelector("#airline-statistics-title").textContent = "Partners, Associates & DOVA";
    grid.querySelector("h3").textContent = "Total virtual airlines";
    const directory = document.querySelector("#directory-status");
    directory.textContent = "The sandbox displays AMS count snapshots below. The live airline directory is available at va.vatsim.net.";
    document.querySelector("#partner-grid").setAttribute("aria-busy", "false");
    document.querySelector("#retry-directory").hidden = true;
    document.querySelector("#airline-search").disabled = true;
    document.querySelectorAll("[data-tier]").forEach(button => { button.disabled = true; });
  } else {
    document.querySelector("h1").textContent = "Partners, Associates & DOVA";
    document.querySelector(".statistics-description").textContent = "Public AMS membership counts by tier and country, recorded at the snapshot date below.";
    document.querySelector("#total-count").nextElementSibling.textContent = "Partners, Associates and DOVA combined";
    document.querySelector("caption").textContent = "Partners, Associates and DOVA by country";
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = "DOVA";
    const row = document.querySelector("thead tr");
    row.insertBefore(heading, row.lastElementChild);
    document.querySelector("#country-empty").textContent = "No virtual airlines were listed in this snapshot.";
  }
  const validCount = value => Number.isSafeInteger(value) && value >= 0;
  async function load() {
    refresh.disabled = true;
    container.setAttribute("aria-busy", "true");
    const ids = ["total-count", "partner-count", "associate-count", "dova-count"];
    ids.forEach(id => { document.getElementById(prefix + id).textContent = "—"; });
    const rows = document.querySelector("#country-rows");
    if (rows) rows.replaceChildren();
    status.textContent = "Loading public AMS snapshot…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("./public-totals.json", {credentials: "omit", cache: "no-store", signal: controller.signal});
      if (!response.ok) throw new Error("Snapshot unavailable");
      const data = await response.json();
      const tiers = ["vap", "vaa", "disc"];
      if (!data.totals || !tiers.every(tier => validCount(data.totals[tier])) ||
          !Number.isFinite(Date.parse(data.retrieved_at)) || !Array.isArray(data.countries) ||
          !data.countries.every(row => typeof row.name === "string" && tiers.every(tier => validCount(row[tier]))) ||
          !tiers.every(tier => data.countries.reduce((sum, row) => sum + row[tier], 0) === data.totals[tier]))
        throw new Error("Invalid snapshot");
      const values = [tiers.reduce((sum, tier) => sum + data.totals[tier], 0), data.totals.vap, data.totals.vaa, data.totals.disc];
      ids.forEach((id, i) => { document.getElementById(prefix + id).textContent = numbers.format(values[i]); });
      if (rows) {
        for (const country of data.countries) {
          const row = document.createElement("tr");
          [country.name, country.vap, country.vaa, country.disc, country.vap + country.vaa + country.disc].forEach((value, i) => {
            const cell = document.createElement(i ? "td" : "th");
            if (!i) cell.scope = "row";
            cell.textContent = typeof value === "number" ? numbers.format(value) : value;
            row.append(cell);
          });
          rows.append(row);
        }
        document.querySelector("#country-empty").hidden = data.countries.length > 0;
      }
      status.textContent = `Source: AMS public directory. Snapshot retrieved ${new Date(data.retrieved_at).toUTCString()}. These are recorded counts, not a live feed. Refresh reloads the published snapshot.`;
    } catch {
      status.textContent = "AMS snapshot unavailable. Please retry; no estimated counts are displayed.";
      if (rows) document.querySelector("#country-empty").hidden = true;
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
      container.setAttribute("aria-busy", "false");
    }
  }
  refresh.addEventListener("click", load);
  load();
})();
