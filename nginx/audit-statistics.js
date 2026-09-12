(() => {
  "use strict";
  const status = document.querySelector("#audit-status");
  const year = document.querySelector("#audit-year");
  const refresh = document.querySelector("#refresh-audits");
  const rows = document.querySelector("#audit-rows");
  const chart = document.querySelector("#audit-chart");
  const results = document.querySelector("#audit-results");
  const format = new Intl.NumberFormat();
  let quarters = [];
  function element(tag, text, className) {
    const item = document.createElement(tag);
    item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function render() {
    const selected = quarters.filter(
      (item) => year.value === "all" || String(item.year) === year.value,
    );
    const total = selected.reduce((sum, item) => sum + item.audits, 0);
    document.querySelector("#audit-failed").textContent = format.format(
      selected.reduce((sum, item) => sum + item.failed, 0),
    );
    const latest = selected[selected.length - 1];
    document.querySelector("#audit-total").textContent = format.format(total);
    document.querySelector("#audit-quarters").textContent = format.format(
      selected.length,
    );
    document.querySelector("#audit-latest").textContent = latest
      ? `${latest.year} Q${latest.quarter}`
      : "—";
    document.querySelector("#audit-latest-count").textContent = latest
      ? `${format.format(latest.audits)} reviewed; ${format.format(latest.failed)} failed`
      : "No recorded quarters";
    rows.replaceChildren();
    chart.replaceChildren();
    const maximum = Math.max(1, ...selected.map((item) => item.audits));
    for (const item of selected) {
      const label = `${item.year} Q${item.quarter}`;
      const row = document.createElement("tr");
      const heading = element("th", label);
      heading.scope = "row";
      row.append(heading, element("td", format.format(item.audits)), element("td", format.format(item.failed)));
      rows.append(row);
      const barRow = element("div", "", "audit-bar-row");
      const track = element("div", "", "audit-bar-track");
      const bar = element("div", "", "audit-bar");
      bar.style.width = `${(item.audits / maximum) * 100}%`;
      const failedBar = element("div", "", "audit-bar audit-bar-failed");
      failedBar.style.width = `${(item.failed / maximum) * 100}%`;
      failedBar.hidden = item.failed === 0;
      bar.hidden = item.audits === 0;
      track.append(bar, failedBar);
      barRow.append(
        element("span", label),
        track,
        element("span", `${format.format(item.audits)} / ${format.format(item.failed)}`),
      );
      chart.append(barRow);
    }
    document.querySelector("#audit-empty").hidden = selected.length > 0;
  }
  async function load() {
    refresh.disabled = year.disabled = true;
    results.setAttribute("aria-busy", "true");
    status.textContent = "Loading quarterly statistics…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/audit-statistics", {
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (
        !Array.isArray(body.data) ||
        !body.data.every(
          (item) =>
            Number.isInteger(item.year) &&
            item.year > 0 &&
            Number.isInteger(item.quarter) &&
            item.quarter >= 1 &&
            item.quarter <= 4 &&
            Number.isSafeInteger(item.audits) &&
            item.audits >= 0 &&
            Number.isSafeInteger(item.failed) &&
            item.failed >= 0 && item.failed <= item.audits,
        )
      )
        throw new Error();
      quarters = body.data.sort(
        (a, b) => a.year - b.year || a.quarter - b.quarter,
      );
      const previous = year.value;
      year.replaceChildren(new Option("All years", "all"));
      [...new Set(quarters.map((item) => item.year))]
        .reverse()
        .forEach((value) =>
          year.append(new Option(String(value), String(value))),
        );
      year.value = [...year.options].some((option) => option.value === previous)
        ? previous
        : "all";
      render();
      status.textContent = `Updated ${new Date().toLocaleString()}. Source: AMS Audit History quarterly reporting.`;
      year.disabled = false;
    } catch {
      rows.replaceChildren();
      chart.replaceChildren();
      for (const id of ["audit-total", "audit-failed", "audit-quarters", "audit-latest"])
        document.getElementById(id).textContent = "—";
      document.querySelector("#audit-latest-count").textContent =
        "Awaiting data";
      document.querySelector("#audit-empty").hidden = true;
      status.textContent =
        "Audit statistics are temporarily unavailable. Please try refreshing shortly.";
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
      results.setAttribute("aria-busy", "false");
    }
  }
  year.addEventListener("change", render);
  refresh.addEventListener("click", load);
  load();
})();
