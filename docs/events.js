(() => {
  "use strict";
  const grid = document.querySelector("#events-grid");
  const status = document.querySelector("#events-status");
  const refresh = document.querySelector("#refresh-events");
  const more = document.querySelector("#more-events");
  const form = document.querySelector("#event-form");
  const submit = document.querySelector("#submit-button");
  const submission = document.querySelector("#submission-status");
  const localPreview =
    (location.protocol === "file:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
      location.hostname.endsWith(".localhost")) &&
    new URLSearchParams(location.search).get("live") !== "1";
  if (localPreview) {
    document.querySelector("#event-access").textContent =
      "Local form preview — edit and try the fields without signing in. Nothing is submitted or saved.";
    const airline = document.createElement("option");
    airline.value = "preview-va";
    airline.textContent = "Example Virtual Airline (preview)";
    airline.selected = true;
    form.elements.namedItem("partner_id").append(airline);
    form.hidden = false;
    submit.disabled = false;
    submit.textContent = "Check preview form";
    status.textContent = "Local preview: live event listings are not loaded.";
    grid.setAttribute("aria-busy", "false");
    refresh.disabled = true;
    more.hidden = true;
    for (const link of document.querySelectorAll('a[href="/va-portal/events#submit-event"]'))
      link.href = "#submit-event";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (form.reportValidity())
        submission.textContent = "Preview checked. No event has been submitted or saved.";
    });
    return;
  }
  let page = 0;
  let csrfToken = null;
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  function node(tag, text, className) {
    const item = document.createElement(tag);
    item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  async function api(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.method === "POST" ? 45000 : 15000,
    );
    try {
      const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      let body;
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many requests. Please wait a minute and try again."
            : body.error ||
              "Events are temporarily unavailable. Please try again shortly.",
        );
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function load(reset = false) {
    refresh.disabled = more.disabled = true;
    grid.setAttribute("aria-busy", "true");
    status.textContent = "Loading events…";
    const next = reset ? 1 : page + 1;
    try {
      const body = await api(`/api/events?page=${next}`);
      if (!Array.isArray(body.data))
        throw new Error(
          "Events are temporarily unavailable. Please try again shortly.",
        );
      const cards = [];
      for (const event of body.data) {
        const start = new Date(event.starts_at),
          end = new Date(event.ends_at);
        if (
          !Number.isFinite(start.getTime()) ||
          !Number.isFinite(end.getTime())
        )
          continue;
        const card = node("article", "", "partner-card event-card");
        if (
          typeof event.banner_url === "string" &&
          /^\/api\/events\/[0-9a-f-]{36}\/banner$/i.test(event.banner_url)
        ) {
          const banner = document.createElement("img");
          banner.src = event.banner_url;
          banner.alt = `Banner for ${event.title}`;
          banner.loading = "lazy";
          banner.className = "event-banner";
          banner.addEventListener("error", () => banner.remove());
          card.append(banner);
        }
        if (["Americas", "EMEA", "APAC"].includes(event.region))
          card.append(node("span", event.region, "badge"));
        if (event.country)
          card.append(node("p", event.country, "event-country"));
        card.append(
          node("p", event.airline, "eyebrow"),
          node("h3", event.title),
        );
        card.append(
          node(
            "p",
            `${dateFormat.format(start)} – ${dateFormat.format(end)} UTC`,
            "event-time",
          ),
        );
        card.append(node("p", event.description));
        try {
          const url = new URL(event.event_url);
          if (["http:", "https:"].includes(url.protocol)) {
            const link = node("a", "Event details ↗");
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.setAttribute(
              "aria-label",
              `${event.title}: event details (opens in a new tab)`,
            );
            card.append(link);
          }
        } catch {
          /* Invalid links are omitted. */
        }
        cards.push(card);
      }
      if (reset) grid.replaceChildren();
      grid.append(...cards);
      page = next;
      more.hidden = !body.has_more;
      status.textContent = grid.children.length
        ? "Upcoming and ongoing events. All times are UTC."
        : "No upcoming events yet. Be the first to submit one for review.";
    } catch (error) {
      status.textContent =
        error.name === "AbortError"
          ? "The request timed out. Please try again."
          : error.message;
    } finally {
      refresh.disabled = more.disabled = false;
      grid.setAttribute("aria-busy", "false");
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!csrfToken) {
      submission.textContent =
        "Sign in with VATSIM using an authorised representative account to submit an event.";
      return;
    }
    if (submit.disabled) return;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const banner = data.get("banner");
    if (banner && banner.size > 5 * 1024 * 1024) {
      submission.textContent = "Banner must be 5 MB or smaller.";
      return;
    }
    for (const field of ["starts_at", "ends_at"])
      data.set(field, data.get(field) + ":00Z");
    if (
      new Date(data.get("starts_at")) <= new Date() ||
      new Date(data.get("ends_at")) <= new Date(data.get("starts_at"))
    ) {
      submission.textContent =
        "Choose a future start time and an end time after the start (UTC).";
      return;
    }
    submit.disabled = true;
    submission.textContent = "Submitting your event…";
    try {
      const result = await api("/api/events", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: data,
      });
      if (!result.id)
        throw new Error(
          "The server did not confirm your submission. Please contact the department before retrying.",
        );
      submission.textContent = `${result.message} Reference: ${result.id}`;
      form.reset();
    } catch (error) {
      submission.textContent =
        error.name === "AbortError"
          ? "Submission confirmation timed out. Your event may have been received; contact the department before retrying."
          : error.message;
    } finally {
      submit.disabled = false;
    }
  });
  refresh.addEventListener("click", () => load(true));
  more.addEventListener("click", () => load());
  async function loadAccess() {
    const access = document.querySelector("#event-access");
    try {
      const result = await api("/va-portal/session");
      if (
        !result.csrf_token ||
        !Array.isArray(result.airlines) ||
        !result.airlines.length
      )
        throw new Error("Representative access could not be verified.");
      csrfToken = result.csrf_token;
      const select = form.elements.namedItem("partner_id");
      for (const airline of result.airlines) {
        const option = node("option", airline.name);
        option.value = airline.id;
        select.append(option);
      }
      if (result.airlines.length === 1) select.value = result.airlines[0].id;
      access.textContent = `Signed in as ${result.user.name} (CID ${result.user.cid}).`;
      form.hidden = false;
      submit.disabled = false;
    } catch (error) {
      form.hidden = true;
      access.replaceChildren(node("p", error.message));
      const login = node("a", "Open VA Portal", "button");
      login.href = "./va-portal/index.html";
      access.append(login);
    }
  }
  loadAccess();
  load(true);
})();
