(() => {
  "use strict";
  for (const panel of document.querySelectorAll("[data-chat]")) {
    const messages = panel.querySelector(".chat-messages");
    const status = panel.querySelector(".chat-status");
    const form = panel.querySelector("form");
    const input = form.elements.namedItem("message");
    const send = form.querySelector('[type="submit"]');
    const refresh = panel.querySelector(".chat-refresh");
    let after = 0, cycle = null, loading = false, sending = false, pending = null;
    async function api(url, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { ...options, credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) {
          if ([401, 403].includes(response.status)) { cycle = null; after = 0; messages.replaceChildren(); }
          throw new Error(body.error || "Conversation unavailable.");
        }
        return body;
      } finally { clearTimeout(timeout); }
    }
    function text(tag, value) { const node = document.createElement(tag); node.textContent = value; return node; }
    async function load() {
      if (loading) return;
      loading = true;
      try {
        let more;
        do {
          const body = await api(`${panel.dataset.chat}?after=${after}`);
          if (!Array.isArray(body.data) || typeof body.cycle !== "string") throw new Error("Invalid conversation response.");
          if (cycle && cycle !== body.cycle) {
            messages.replaceChildren(); after = 0; cycle = body.cycle;
            status.textContent = "A new audit cycle has started.";
            more = true;
            continue;
          }
          cycle = body.cycle;
          const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
          for (const message of body.data) {
            if (!Number.isSafeInteger(message.id) || message.id <= after) continue;
            const card = document.createElement("article");
            card.className = "chat-message" + (message.mine ? " chat-mine" : "");
            card.append(text("p", `${message.name} · ${message.role}`), text("p", message.body));
            const stamp = text("time", new Date(message.sent_at).toLocaleString());
            stamp.dateTime = message.sent_at;
            card.append(stamp); messages.append(card); after = message.id;
          }
          if (atBottom) messages.scrollTop = messages.scrollHeight;
          more = body.has_more;
        } while (more);
        status.textContent = after ? "Conversation up to date." : "No messages yet. Start the audit conversation below.";
      } catch (error) {
        status.textContent = error.name === "AbortError" ? "Conversation timed out. Please refresh." : error.message;
      } finally { loading = false; send.disabled = sending || !cycle; }
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending || !cycle || !form.reportValidity()) return;
      const body = input.value.trim();
      if (!body) return;
      if (!pending || pending.body !== body || pending.cycle !== cycle) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
        pending = { body, cycle, client_id: `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}` };
      }
      sending = true; send.disabled = true;
      status.textContent = "Sending…";
      try {
        await api(panel.dataset.chat, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": panel.dataset.csrf }, body: JSON.stringify(pending) });
        if (input.value.trim() === body) input.value = "";
        pending = null;
        await load();
      } catch (error) {
        status.textContent = error.name === "AbortError" ? "Confirmation timed out. Retry this message to confirm it without duplicating it." : error.message;
      } finally { sending = false; send.disabled = !cycle; }
    });
    refresh.addEventListener("click", load);
    const timer = setInterval(() => { if (!document.hidden && !sending) load(); }, 10000);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
    load();
  }
})();
