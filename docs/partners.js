(() => {
  "use strict";
  const grid = document.querySelector("#partner-grid");
  const status = document.querySelector("#directory-status");
  const search = document.querySelector("#airline-search");
  const retry = document.querySelector("#retry-directory");
  const refreshTotals = document.querySelector("#refresh-home-statistics");
  const totalsStatus = document.querySelector("#homepage-statistics-status");
  const totalsGrid = document.querySelector("#homepage-statistics");
  const numberFormat = new Intl.NumberFormat();
  const filters = [...document.querySelectorAll("[data-tier]")];
  const tierLabels = {
    vap: "Partner",
    vaa: "Associate",
    disc: "Discord-only VA",
  };
  let airlines = [];
  let tier = "all";
  let loaded = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.origin);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function render() {
    if (!loaded) return;
    const term = search.value.trim().toLocaleLowerCase();
    const visible = airlines.filter(
      (airline) =>
        (tier === "all" || airline.Partnership_Tier === tier) &&
        [airline.Name, airline.Country, airline.Callsigns]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term),
    );
    grid.replaceChildren();
    for (const airline of visible) {
      const card = element("article", "partner-card");
      const logo = element("div", "partner-logo");
      const fallback = element("span", "initials", initials(airline.Name));
      fallback.setAttribute("aria-hidden", "true");
      logo.append(fallback);
      if (
        typeof airline.Logo === "string" &&
        /^[a-f0-9-]{36}$/i.test(airline.Logo)
      ) {
        const img = element("img");
        img.alt = "";
        img.loading = "lazy";
        img.addEventListener("load", () => {
          fallback.hidden = true;
        });
        img.addEventListener("error", () => {
          img.remove();
          fallback.hidden = false;
        });
        img.src = `/assets/${encodeURIComponent(airline.Logo)}`;
        logo.append(img);
      }
      const details = element("div", "partner-details");
      details.append(
        element(
          "span",
          `badge ${airline.Partnership_Tier}`,
          tierLabels[airline.Partnership_Tier],
        ),
      );
      details.append(element("h3", "", airline.Name));
      const info = [
        airline.Country,
        Array.isArray(airline.Callsigns)
          ? airline.Callsigns.join(" · ")
          : airline.Callsigns,
      ]
        .filter(Boolean)
        .join(" / ");
      if (info) details.append(element("p", "", info));
      const url = safeUrl(airline.Website_Link);
      if (url) {
        const link = element("a", "", "Visit airline ↗");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          `Visit ${airline.Name} (opens in a new tab)`,
        );
        details.append(link);
      }
      card.append(logo, details);
      grid.append(card);
    }
    status.textContent = visible.length
      ? `${visible.length} ${visible.length === 1 ? "airline" : "airlines"}${
          tier === "all"
            ? " in our community"
            : ` in the ${tierLabels[tier]} category`
        }`
      : airlines.length
        ? "No airlines match your search. Try another name or select All airlines."
        : "There are no airlines to display right now. Please check back soon.";
  }

  async function loadAirlines() {
    loaded = false;
    refreshTotals.disabled = true;
    totalsGrid.setAttribute("aria-busy", "true");
    totalsStatus.textContent = "Loading statistics from AMS…";
    for (const id of [
      "home-total-count",
      "home-partner-count",
      "home-associate-count",
    ])
      document.getElementById(id).textContent = "—";
    retry.hidden = true;
    grid.setAttribute("aria-busy", "true");
    status.textContent = "Loading our community…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({
        fields: "Name,Logo,Website_Link,Country,Callsigns,Partnership_Tier",
        "filter[Partnership_Tier][_in]": "vap,vaa,disc",
        sort: "Name",
        limit: "100",
      });
      const records = [];
      for (let page = 1; ; page++) {
        params.set("page", String(page));
        const response = await fetch(`/api/partners?${params}`, {
          signal: controller.signal,
          credentials: "omit",
        });
        if (!response.ok) throw new Error("Directory unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.data))
          throw new Error("Invalid directory response");
        records.push(...payload.data);
        if (payload.data.length < 100) break;
      }
      airlines = records.filter(
        (row) =>
          row &&
          typeof row.Name === "string" &&
          row.Name.trim() &&
          ["vap", "vaa", "disc"].includes(row.Partnership_Tier),
      );
      airlines.sort((a, b) => a.Name.localeCompare(b.Name));
      const partners = records.filter(
        (row) => row?.Partnership_Tier === "vap",
      ).length;
      const associates = records.filter(
        (row) => row?.Partnership_Tier === "vaa",
      ).length;
      document.getElementById("home-total-count").textContent =
        numberFormat.format(partners + associates);
      document.getElementById("home-partner-count").textContent =
        numberFormat.format(partners);
      document.getElementById("home-associate-count").textContent =
        numberFormat.format(associates);
      totalsStatus.textContent =
        "Source: AMS public directory. Totals include Partners and Associates.";
      loaded = true;
      render();
    } catch {
      totalsStatus.textContent =
        "Statistics are temporarily unavailable. Please try refreshing shortly.";
      status.textContent =
        "The airline directory is temporarily unavailable. Please try again shortly.";
      retry.hidden = false;
    } finally {
      refreshTotals.disabled = false;
      totalsGrid.setAttribute("aria-busy", "false");
      clearTimeout(timeout);
      grid.setAttribute("aria-busy", "false");
    }
  }

  for (const button of filters) {
    button.addEventListener("click", () => {
      tier = button.dataset.tier;
      for (const filter of filters)
        filter.setAttribute("aria-pressed", String(filter === button));
      render();
    });
  }
  search.addEventListener("input", render);
  retry.addEventListener("click", loadAirlines);

  refreshTotals.addEventListener("click", loadAirlines);
  loadAirlines();
})();
