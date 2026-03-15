let session = localStorage.getItem("vaultSession") || "";

const el = (id) => document.getElementById(id);
const msg = (text) => { el("msg").textContent = text; };

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session) headers["x-vault-session"] = session;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function boot() {
  const status = await api("/api/status", { headers: {} });
  el("init").classList.toggle("hidden", status.initialized);
  el("unlock").classList.toggle("hidden", !status.initialized || session);
  el("dashboard").classList.toggle("hidden", !session);
  if (session) {
    await refreshRecords();
    await refreshSessions();
  }
}

el("initBtn").onclick = async () => {
  try {
    await api("/api/init", { method: "POST", body: JSON.stringify({ masterPassword: el("initPassword").value }) });
    msg("Vault initialized. Unlock it now.");
    localStorage.removeItem("vaultSession");
    session = "";
    await boot();
  } catch (error) { msg(error.message); }
};

el("unlockBtn").onclick = async () => {
  try {
    const data = await api("/api/unlock", { method: "POST", body: JSON.stringify({ masterPassword: el("unlockPassword").value }) });
    session = data.session;
    localStorage.setItem("vaultSession", session);
    msg("Vault unlocked.");
    await boot();
  } catch (error) { msg(error.message); }
};

el("lockBtn").onclick = async () => {
  await api("/api/lock", { method: "POST", body: "{}" });
  localStorage.removeItem("vaultSession");
  session = "";
  msg("Vault locked.");
  await boot();
};

el("recordForm").onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  payload.otherFields = payload.otherFields ? JSON.parse(payload.otherFields) : {};
  payload.extraFieldSelectors = payload.extraFieldSelectors ? JSON.parse(payload.extraFieldSelectors) : {};
  try {
    await api("/api/records", { method: "POST", body: JSON.stringify(payload) });
    msg("Record saved.");
    event.target.reset();
    await refreshRecords();
  } catch (error) { msg(error.message); }
};

el("refreshBtn").onclick = async () => {
  await refreshRecords();
  await refreshSessions();
};

async function refreshRecords() {
  const records = await api("/api/records");
  el("recordsList").innerHTML = "";
  records.forEach((record) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${record.label}</strong> (${record.username || ""})<br>
      URL: ${record.siteUrl || "n/a"} | TOTP: ${record.hasTotp ? "yes" : "no"}
      <div class="inline-actions">
        <button data-action="totp">Generate TOTP</button>
        <button data-action="autologin">Auto Login</button>
        <button data-action="delete">Delete</button>
      </div>
    `;

    li.querySelector('[data-action="totp"]').onclick = async () => {
      try {
        const result = await api(`/api/records/${record.id}/totp`, { method: "POST", body: "{}" });
        msg(`TOTP for ${record.label}: ${result.code}`);
      } catch (error) { msg(error.message); }
    };

    li.querySelector('[data-action="autologin"]').onclick = async () => {
      try {
        const result = await api(`/api/records/${record.id}/auto-login`, { method: "POST", body: "{}" });
        msg(result.message);
        await refreshSessions();
      } catch (error) { msg(error.message); }
    };

    li.querySelector('[data-action="delete"]').onclick = async () => {
      try {
        await api(`/api/records/${record.id}`, { method: "DELETE" });
        msg(`Deleted ${record.label}`);
        await refreshRecords();
      } catch (error) { msg(error.message); }
    };

    el("recordsList").appendChild(li);
  });
}

async function refreshSessions() {
  const snapshots = await api("/api/sessions");
  el("sessionList").innerHTML = "";
  snapshots.forEach((snapshot) => {
    const li = document.createElement("li");
    li.textContent = `Record ${snapshot.recordId} saved at ${snapshot.updatedAt}`;
    el("sessionList").appendChild(li);
  });
}

boot().catch((error) => msg(error.message));
