(() => {
  "use strict";
  const groups = ["leadership", "senior-audit-managers", "audit-managers"];
  const leadershipRoles = {
    "Vice President": "vice-president-grid",
    "Director": "director-grid",
    "Assistant Director": "assistant-director-grid",
    "Training Coordinator": "training-coordinator-grid",
  };
  function element(tag, text, className) {
    const item = document.createElement(tag);
    item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function render(members) {
    for (const group of groups) {
      const grid = document.querySelector(`#${group}-grid`);
      if (group === "leadership") {
        for (const id of Object.values(leadershipRoles))
          document.getElementById(id).replaceChildren();
      } else grid.replaceChildren();
      for (const member of members.filter(
        (item) =>
          item &&
          item.group === group &&
          typeof item.name === "string" &&
          item.name.trim(),
      )) {
        const target = group === "leadership"
          ? document.getElementById(leadershipRoles[member.role])
          : grid;
        if (!target) continue;
        const card = element("article", "", "team-card");
        const initials = member.name
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("");
        const avatar = element("div", initials, "team-monogram");
        avatar.setAttribute("aria-hidden", "true");
        card.append(avatar);
        if (typeof member.photo === "string" && member.photo) {
          try {
            const url = new URL(member.photo, document.baseURI);
            if (["http:", "https:", "file:"].includes(url.protocol)) {
              const photo = document.createElement("img");
              photo.alt = "";
              photo.loading = "lazy";
              photo.addEventListener("load", () => {
                avatar.hidden = true;
              });
              photo.addEventListener("error", () => {
                photo.remove();
                avatar.hidden = false;
              });
              photo.src = url.href;
              card.append(photo);
            }
          } catch {
            /* Keep initials when the photo URL is invalid. */
          }
        }
        card.append(element(group === "leadership" ? "h4" : "h3", member.name));
        if (typeof member.role === "string")
          card.append(element("p", member.role, "role"));
        if (typeof member.bio === "string" && member.bio)
          card.append(element("p", member.bio));
        target.append(card);
      }
      document.querySelector(`#${group}-empty`).hidden =
        grid.querySelectorAll(".team-card").length > 0;
    }
  }
  const status = document.querySelector("#team-status");
  const refresh = document.querySelector("#refresh-team");
  async function load() {
    refresh.disabled = true;
    status.textContent = "Loading the department team from AMS…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/team", {
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Team unavailable");
      const body = await response.json();
      if (!Array.isArray(body.data)) throw new Error("Invalid team response");
      render(body.data);
      status.textContent = "Team profiles from AMS.";
    } catch {
      render([]);
      for (const group of groups)
        document.querySelector(`#${group}-empty`).hidden = true;
      status.textContent =
        "Unable to load the team from AMS. Please try again. Live profiles require the site API; IDE previews show the page layout.";
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
    }
  }
  refresh.addEventListener("click", load);
  load();
})();
