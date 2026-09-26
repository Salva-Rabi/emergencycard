/* ============================================================
   EmergencyCard — app.js
   Vanilla JS SPA, hash-routed. No backend: the owner's profile
   lives in this browser's localStorage, and the public emergency
   data travels *inside the QR code itself* (base64 JSON in the
   URL). That's what makes "Phone B scans QR" work without a
   server — see README for why, and the tradeoffs.
   ============================================================ */

const STORAGE_KEY = "emergencycard_profile_v1";
const DEACTIVATED_KEY = "emergencycard_deactivated_ids_v1";

const FIELD_META = [
  { key: "name", label: "Name" },
  { key: "photo", label: "Photo" },
  { key: "bloodGroup", label: "Blood group" },
  { key: "allergies", label: "Allergies" },
  { key: "medicalAlert", label: "Medical alert" },
  { key: "contact", label: "Emergency contact" },
];

const app = document.getElementById("app");

/* ---------------- storage helpers ---------------- */

function getProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function getDeactivatedIds() {
  try {
    return JSON.parse(localStorage.getItem(DEACTIVATED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function setDeactivated(id, isDeactivated) {
  let ids = getDeactivatedIds();
  if (isDeactivated) {
    if (!ids.includes(id)) ids.push(id);
  } else {
    ids = ids.filter((x) => x !== id);
  }
  localStorage.setItem(DEACTIVATED_KEY, JSON.stringify(ids));
}

/* ---------------- encode helpers ---------------- */

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode("0x" + p1)
  ));
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

function buildPublicPayload(profile) {
  const p = profile.privacy;
  const data = { id: profile.id };
  if (p.name) data.name = profile.name;
  if (p.photo) data.photo = profile.photo || null;
  if (p.bloodGroup) data.bloodGroup = profile.bloodGroup;
  if (p.allergies) data.allergies = profile.allergies;
  if (p.medicalAlert) data.medicalAlert = profile.medicalAlert;
  if (p.contact) {
    data.contactName = profile.contactName;
    data.contactPhone = profile.contactPhone;
  }
  data.instructions = profile.instructions || "";
  return data;
}

function emergencyUrlFor(profile) {
  const payload = buildPublicPayload(profile);
  const encoded = b64EncodeUnicode(JSON.stringify(payload));
  const base = location.href.split("#")[0];
  return `${base}#/emergency/${encoded}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

/* ---------------- toast ---------------- */

let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------------- draft (in-progress create/edit form) ---------------- */

let draft = null;
function freshDraft() {
  return {
    id: uid(),
    name: "",
    photo: null,
    bloodGroup: "",
    allergies: "",
    medicalAlert: "",
    instructions: "Please keep the person calm and contact the emergency contact if necessary.",
    contactName: "",
    contactPhone: "",
    privacy: {
      name: true,
      photo: true,
      bloodGroup: true,
      allergies: true,
      medicalAlert: true,
      contact: true,
    },
    active: true,
  };
}

/* ---------------- router ---------------- */

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  return { name: parts[0] || "landing", param: parts.slice(1).join("/") };
}

function render() {
  const { name, param } = currentRoute();
  window.scrollTo(0, 0);

  switch (name) {
    case "landing":
      return renderLanding();
    case "create":
      return renderCreate(param || "1");
    case "card":
      return renderCard();
    case "dashboard":
      return renderDashboard();
    case "edit":
      return renderCreate("1", true);
    case "emergency":
      return renderEmergency(param);
    default:
      return renderLanding();
  }
}

/* ---------------- shared chrome ---------------- */

function topbar(activeAction) {
  const profile = getProfile();
  return `
    <div class="topbar">
      <div class="topbar-inner">
        <a href="#/" class="brand"><span class="brand-mark">✚</span>EmergencyCard</a>
        <div class="topbar-actions">
          ${
            profile
              ? `<button class="btn btn-outline" data-nav="#/dashboard">Dashboard</button>`
              : `<button class="btn btn-primary" data-nav="#/create/1">Create EmergencyCard</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function bindNav(root) {
  root.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(el.getAttribute("data-nav"));
    });
  });
}

/* ---------------- physical card component ---------------- */

function cardMotif(profile, opts = {}) {
  const inactive = profile && profile.active === false;
  const photo = profile && profile.photo
    ? `<img src="${profile.photo}" alt="">`
    : `👤`;
  const qrSlot = opts.qrCanvasId
    ? `<div class="pcard-qr" id="${opts.qrCanvasId}"></div>`
    : `<div class="pcard-qr" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">QR</div>`;

  return `
    <div class="pcard ${inactive ? "inactive" : ""}">
      <div class="pcard-top">
        <div class="pcard-brand">✚ EMERGENCYCARD</div>
        <div class="pcard-strip">SCAN IN CASE<br>OF EMERGENCY</div>
      </div>
      <div class="pcard-mid">
        <div class="pcard-photo">${photo}</div>
        <div>
          <div class="pcard-name">${escapeHtml(profile?.name || "Your name")}</div>
          <div class="pcard-blood">${profile?.privacy?.bloodGroup !== false ? escapeHtml(profile?.bloodGroup || "Blood group") : "Blood group hidden"}</div>
        </div>
      </div>
      <div class="pcard-bottom">
        <div class="pcard-instruction">If I cannot communicate, please scan this code.</div>
        ${qrSlot}
      </div>
    </div>
  `;
}

function renderQrInto(elId, text, size) {
  const el = document.getElementById(elId);
  if (!el || typeof QRCode === "undefined") return;
  el.innerHTML = "";
  new QRCode(el, {
    text,
    width: size || 54,
    height: size || 54,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

/* ================================================================
   LANDING
   ================================================================ */

function renderLanding() {
  app.innerHTML = `
    ${topbar()}
    <div class="wrap">
      <section class="hero">
        <div class="hero-eyebrow">A QR-powered emergency ID</div>
        <h1>If you can't speak, let your card speak for you.</h1>
        <p class="hero-tagline">A bystander scans the code on your card with any phone camera and instantly sees the blood group, allergies, and emergency contact you've chosen to share &mdash; nothing more.</p>
        <div class="hero-actions btn-row">
          <button class="btn btn-primary" data-nav="#/create/1">Create your EmergencyCard</button>
          <a href="#how" class="btn btn-outline">See how it works</a>
        </div>
        <div class="hero-card-stage">${cardMotif(null)}</div>
      </section>

      <section class="section" id="how">
        <h2>How it works</h2>
        <p class="section-lead">Four steps, from a locked phone to the right information in someone's hands.</p>
        <div class="steps">
          <div class="step-row">
            <div class="step-num">1</div>
            <div class="step-body">
              <h3>Create your profile</h3>
              <p>Add the essentials &mdash; blood group, allergies, a medical alert, and who to call.</p>
            </div>
          </div>
          <div class="step-row">
            <div class="step-num">2</div>
            <div class="step-body">
              <h3>Choose what's visible</h3>
              <p>You decide field by field what a stranger is allowed to see. Nothing is shared by default.</p>
            </div>
          </div>
          <div class="step-row">
            <div class="step-num">3</div>
            <div class="step-body">
              <h3>Print your card</h3>
              <p>A unique QR code is generated for your profile. Put it on a wallet card, ID holder, or bag tag.</p>
            </div>
          </div>
          <div class="step-row">
            <div class="step-num">4</div>
            <div class="step-body">
              <h3>A bystander scans it</h3>
              <p>Any phone camera opens your emergency profile in a browser &mdash; no app install required &mdash; with a one-tap call button.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Built for the moment you can't speak</h2>
        <p class="section-lead">Useful for anyone who wants a faster way to be understood in an emergency.</p>
        <div class="who-grid">
          <span class="who-chip">People who live alone</span>
          <span class="who-chip">Elderly people</span>
          <span class="who-chip">People with allergies</span>
          <span class="who-chip">Travelers</span>
          <span class="who-chip">Students</span>
          <span class="who-chip">Cyclists &amp; runners</span>
          <span class="who-chip">Hikers</span>
          <span class="who-chip">Parents, for their kids</span>
        </div>
      </section>

      <section class="section">
        <h2>Only what's necessary &mdash; nothing else</h2>
        <p class="section-lead">Your emergency profile is built to share the minimum, not your whole life. Home address, ID numbers, and financial details are never part of it &mdash; there's no field for them.</p>
      </section>

      <footer class="footer">
        EmergencyCard &middot; a hackathon prototype. Built for First Commit.
      </footer>
    </div>
  `;
  bindNav(app);
}

/* ================================================================
   CREATE / EDIT — 3 step flow
   ================================================================ */

function renderCreate(step, isEdit) {
  step = String(step || "1");
  if (!draft) {
    const existing = getProfile();
    draft = isEdit && existing ? JSON.parse(JSON.stringify(existing)) : freshDraft();
  }

  const stepIndex = { 1: 0, 2: 1, 3: 2 }[step] ?? 0;

  let body = "";
  if (step === "1") body = stepBasics();
  else if (step === "2") body = stepPrivacy();
  else body = stepReview();

  app.innerHTML = `
    ${topbar()}
    <div class="wrap">
      <div class="flow-header">
        <div class="flow-title">${isEdit ? "Edit your EmergencyCard" : "Create your EmergencyCard"}</div>
        <div class="flow-sub">${
          step === "1"
            ? "Start with the information that matters most in an emergency."
            : step === "2"
            ? "Choose exactly what a stranger can see."
            : "Check everything before your card is generated."
        }</div>
      </div>
      <div class="progress">
        ${[0, 1, 2]
          .map(
            (i) =>
              `<div class="progress-seg ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}"></div>`
          )
          .join("")}
      </div>
      <form id="flow-form">${body}</form>
    </div>
  `;

  bindNav(app);
  wireCreateStep(step, isEdit);
}

function stepBasics() {
  const d = draft;
  return `
    <div class="field">
      <label for="f-name">Full name</label>
      <input type="text" id="f-name" value="${escapeHtml(d.name)}" placeholder="e.g. Sara Ahmed" required>
    </div>

    <div class="field">
      <label for="f-photo">Profile photo <span class="hint" style="font-weight:400;">(optional)</span></label>
      <div class="photo-picker">
        <div class="photo-preview" id="photo-preview">${d.photo ? `<img src="${d.photo}" alt="">` : "👤"}</div>
        <input type="file" id="f-photo" accept="image/*" style="display:none;">
        <button type="button" class="btn btn-outline" id="photo-btn">Choose photo</button>
        ${d.photo ? `<button type="button" class="btn btn-ghost" id="photo-remove">Remove</button>` : ""}
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="f-blood">Blood group</label>
        <select id="f-blood" required>
          <option value="" ${!d.bloodGroup ? "selected" : ""} disabled>Select</option>
          ${["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
            .map((bg) => `<option value="${bg}" ${d.bloodGroup === bg ? "selected" : ""}>${bg}</option>`)
            .join("")}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="f-allergies">Allergies</label>
      <input type="text" id="f-allergies" value="${escapeHtml(d.allergies)}" placeholder="e.g. Penicillin, peanuts &mdash; or None">
    </div>

    <div class="field">
      <label for="f-alert">Medical alert</label>
      <input type="text" id="f-alert" value="${escapeHtml(d.medicalAlert)}" placeholder="e.g. Asthma, epilepsy, diabetic &mdash; or None">
    </div>

    <div class="field">
      <label for="f-instr">Emergency instructions</label>
      <textarea id="f-instr" placeholder="What should a bystander do?">${escapeHtml(d.instructions)}</textarea>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="f-cname">Emergency contact name</label>
        <input type="text" id="f-cname" value="${escapeHtml(d.contactName)}" placeholder="e.g. Mother">
      </div>
      <div class="field">
        <label for="f-cphone">Contact phone number</label>
        <input type="tel" id="f-cphone" value="${escapeHtml(d.contactPhone)}" placeholder="+92 3XX XXXXXXX">
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-nav="#/">Cancel</button>
      <button type="submit" class="btn btn-primary">Continue to privacy</button>
    </div>
  `;
}

function stepPrivacy() {
  const d = draft;
  const rows = [
    { key: "photo", label: "Profile photo", value: d.photo ? "Added" : "Not added" },
    { key: "bloodGroup", label: "Blood group", value: d.bloodGroup || "&mdash;" },
    { key: "allergies", label: "Allergies", value: d.allergies || "&mdash;" },
    { key: "medicalAlert", label: "Medical alert", value: d.medicalAlert || "&mdash;" },
    { key: "contact", label: "Emergency contact", value: d.contactName || "&mdash;" },
  ];

  return `
    <div class="privacy-note">Name is always shown, so a bystander knows whose card they're looking at. Everything else is your choice.</div>

    <div class="privacy-row">
      <div>
        <div class="privacy-label">Name</div>
        <div class="privacy-value">${escapeHtml(d.name)}</div>
      </div>
      <div class="privacy-locked">Always visible</div>
    </div>

    ${rows
      .map(
        (r) => `
      <div class="privacy-row">
        <div>
          <div class="privacy-label">${r.label}</div>
          <div class="privacy-value">${r.value}</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-privacy="${r.key}" ${d.privacy[r.key] ? "checked" : ""}>
          <span class="switch-track"></span>
        </label>
      </div>
    `
      )
      .join("")}

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-nav="#/create/1">Back</button>
      <button type="submit" class="btn btn-primary">Continue to review</button>
    </div>
  `;
}

function stepReview() {
  const d = draft;
  const items = [
    ["Name", d.name],
    ["Blood group", d.privacy.bloodGroup ? d.bloodGroup : `${d.bloodGroup || "&mdash;"} (hidden)`],
    ["Allergies", d.privacy.allergies ? d.allergies || "None" : "Hidden"],
    ["Medical alert", d.privacy.medicalAlert ? d.medicalAlert || "None" : "Hidden"],
    ["Emergency contact", d.privacy.contact ? `${d.contactName} &middot; ${d.contactPhone}` : "Hidden"],
    ["Photo", d.privacy.photo ? (d.photo ? "Visible" : "Not added") : "Hidden"],
  ];

  return `
    <div class="review-list">
      ${items
        .map(
          (i) => `
        <div class="review-item">
          <div class="review-k">${i[0]}</div>
          <div class="review-v">${i[1]}</div>
        </div>
      `
        )
        .join("")}
    </div>
    <p class="muted small" style="margin-top:18px;">This is exactly what a bystander will see if they scan your card. You can change any of it later from your dashboard.</p>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-nav="#/create/2">Back</button>
      <button type="submit" class="btn btn-primary">Generate my EmergencyCard</button>
    </div>
  `;
}

function wireCreateStep(step, isEdit) {
  const form = document.getElementById("flow-form");

  if (step === "1") {
    const photoBtn = document.getElementById("photo-btn");
    const photoInput = document.getElementById("f-photo");
    const photoRemove = document.getElementById("photo-remove");
    photoBtn.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        draft.photo = reader.result;
        renderCreate("1", isEdit);
      };
      reader.readAsDataURL(file);
    });
    if (photoRemove) {
      photoRemove.addEventListener("click", () => {
        draft.photo = null;
        renderCreate("1", isEdit);
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      draft.name = document.getElementById("f-name").value.trim();
      draft.bloodGroup = document.getElementById("f-blood").value;
      draft.allergies = document.getElementById("f-allergies").value.trim();
      draft.medicalAlert = document.getElementById("f-alert").value.trim();
      draft.instructions = document.getElementById("f-instr").value.trim();
      draft.contactName = document.getElementById("f-cname").value.trim();
      draft.contactPhone = document.getElementById("f-cphone").value.trim();

      if (!draft.name || !draft.bloodGroup) {
        toast("Please add at least a name and blood group.");
        return;
      }
      navigate(`#/${isEdit ? "edit" : "create"}/2`);
    });
    return;
  }

  if (step === "2") {
    form.querySelectorAll("[data-privacy]").forEach((el) => {
      el.addEventListener("change", () => {
        draft.privacy[el.getAttribute("data-privacy")] = el.checked;
      });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      navigate(`#/${isEdit ? "edit" : "create"}/3`);
    });
    return;
  }

  // step 3
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    draft.active = true;
    saveProfile(draft);
    setDeactivated(draft.id, false);
    const wasEdit = isEdit;
    draft = null;
    toast(wasEdit ? "EmergencyCard updated." : "EmergencyCard created.");
    navigate("#/card");
  });
}

/* ================================================================
   CARD + QR RESULT
   ================================================================ */

function renderCard() {
  const profile = getProfile();
  if (!profile) {
    return renderEmptyState(
      "🪪",
      "No EmergencyCard yet",
      "Create your profile first and we'll generate your card and QR code.",
      "Create your EmergencyCard",
      "#/create/1"
    );
  }

  const url = emergencyUrlFor(profile);

  app.innerHTML = `
    ${topbar()}
    <div class="wrap">
      <div class="flow-header">
        <div class="flow-title">Your EmergencyCard is ready</div>
        <div class="flow-sub">Print this QR onto a wallet card, ID holder, or bag tag. Anyone who scans it sees only what you chose to share.</div>
      </div>

      <div class="result-stage">${cardMotif(profile, { qrCanvasId: "pcard-qr-canvas" })}</div>

      <div class="qr-box">
        <div class="qr-frame">
          <div id="qr-canvas"></div>
        </div>
      </div>
      <div class="qr-url">${escapeHtml(url)}</div>

      <div class="result-actions">
        <button class="btn btn-dark btn-block" id="download-qr">Download QR (PNG)</button>
        <button class="btn btn-outline btn-block" id="copy-link">Copy emergency profile link</button>
        <button class="btn btn-teal btn-block" data-nav="#/dashboard">Go to dashboard</button>
      </div>
    </div>
  `;

  bindNav(app);
  renderQrInto("qr-canvas", url, 200);
  renderQrInto("pcard-qr-canvas", url, 54);

  document.getElementById("download-qr").addEventListener("click", () => {
    const canvas = document.querySelector("#qr-canvas canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `emergencycard-${profile.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  document.getElementById("copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    } catch (e) {
      toast("Couldn't copy automatically — select the link text above.");
    }
  });
}

/* ================================================================
   DASHBOARD
   ================================================================ */

function renderDashboard() {
  const profile = getProfile();
  if (!profile) {
    return renderEmptyState(
      "🪪",
      "No EmergencyCard yet",
      "Once you create your profile, you'll manage it here — view your card, edit details, or deactivate it if it's lost.",
      "Create your EmergencyCard",
      "#/create/1"
    );
  }

  const isActive = profile.active !== false;
  const url = emergencyUrlFor(profile);

  app.innerHTML = `
    ${topbar()}
    <div class="wrap">
      <div class="status-row">
        <h1 style="font-size:24px;">Welcome back, ${escapeHtml(profile.name.split(" ")[0] || profile.name)}</h1>
        <span class="status-pill ${isActive ? "active" : "inactive"}">
          <span class="status-dot"></span>${isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div class="dash-card-stage">${cardMotif(profile, { qrCanvasId: "dash-pcard-qr" })}</div>

      <div class="dash-actions">
        <button class="btn btn-dark btn-block" data-nav="#/card">View card &amp; QR</button>
        <button class="btn btn-outline btn-block" data-nav="#/edit">Edit profile</button>
        ${
          isActive
            ? `<button class="btn btn-danger-outline btn-block" id="toggle-active">Deactivate card</button>`
            : `<button class="btn btn-teal btn-block" id="toggle-active">Reactivate card</button>`
        }
      </div>

      <div class="summary-block">
        <h3>Your emergency profile</h3>
        <div class="review-list">
          <div class="review-item"><div class="review-k">Blood group</div><div class="review-v">${escapeHtml(profile.bloodGroup)}</div></div>
          <div class="review-item"><div class="review-k">Allergies</div><div class="review-v">${escapeHtml(profile.allergies || "None listed")}</div></div>
          <div class="review-item"><div class="review-k">Medical alert</div><div class="review-v">${escapeHtml(profile.medicalAlert || "None listed")}</div></div>
          <div class="review-item"><div class="review-k">Emergency contact</div><div class="review-v">${escapeHtml(profile.contactName || "—")}</div></div>
        </div>
      </div>

      <p class="muted small" style="padding-bottom:60px;">Card ID: ${escapeHtml(profile.id)}</p>
    </div>
  `;

  bindNav(app);
  renderQrInto("dash-pcard-qr", url, 54);

  document.getElementById("toggle-active").addEventListener("click", () => {
    profile.active = !isActive;
    saveProfile(profile);
    setDeactivated(profile.id, !profile.active);
    toast(profile.active ? "Card reactivated." : "Card deactivated. Scans will now show it as inactive on this device.");
    renderDashboard();
  });
}

/* ================================================================
   EMPTY STATE
   ================================================================ */

function renderEmptyState(icon, title, body, ctaLabel, ctaHref) {
  app.innerHTML = `
    ${topbar()}
    <div class="wrap">
      <div class="empty-state">
        <div class="em-icon">${icon}</div>
        <h2>${title}</h2>
        <p>${body}</p>
        <button class="btn btn-primary" data-nav="${ctaHref}">${ctaLabel}</button>
      </div>
    </div>
  `;
  bindNav(app);
}

/* ================================================================
   EMERGENCY PROFILE (bystander view)
   ================================================================ */

function renderEmergency(encoded) {
  let data = null;
  try {
    data = JSON.parse(b64DecodeUnicode(decodeURIComponent(encoded)));
  } catch (e) {
    data = null;
  }

  if (!data) {
    app.innerHTML = `
      <div class="deactivated-stage">
        <div class="deactivated-box">
          <div class="deactivated-icon">⚠️</div>
          <h1>This card couldn't be read</h1>
          <p>The QR code link looks incomplete or damaged. Ask the card owner for a fresh card, or check the link was copied in full.</p>
          <button class="btn btn-outline" data-nav="#/">Go to EmergencyCard</button>
        </div>
      </div>
    `;
    bindNav(app);
    return;
  }

  const deactivated = getDeactivatedIds().includes(data.id);
  if (deactivated) {
    app.innerHTML = `
      <div class="deactivated-stage">
        <div class="deactivated-box">
          <div class="deactivated-icon">🔒</div>
          <h1>This EmergencyCard is currently inactive</h1>
          <p>The owner has deactivated this card, so its information is no longer shown. This usually happens after a card is reported lost.</p>
          <button class="btn btn-outline" data-nav="#/">Go to EmergencyCard</button>
        </div>
      </div>
    `;
    bindNav(app);
    return;
  }

  const hasAny =
    data.bloodGroup || data.allergies || data.medicalAlert || data.contactName;

  app.innerHTML = `
    <div class="emergency-page">
      <div class="emergency-band">EMERGENCY PROFILE &middot; Scanned via EmergencyCard</div>
      <div class="wrap">
        <div class="profile-head">
          <div class="profile-photo">${data.photo ? `<img src="${data.photo}" alt="">` : "👤"}</div>
          <h1 class="profile-name">${escapeHtml(data.name || "Unknown")}</h1>
          <div class="profile-kicker">If this person can't communicate, the details below may help.</div>
        </div>

        ${
          hasAny
            ? `
        <div class="fact-grid">
          ${
            data.bloodGroup
              ? `<div class="fact-card"><div class="fact-icon">🩸</div><div class="fact-label">Blood group</div><div class="fact-value">${escapeHtml(data.bloodGroup)}</div></div>`
              : ""
          }
          ${
            data.medicalAlert
              ? `<div class="fact-card"><div class="fact-icon">🩺</div><div class="fact-label">Medical alert</div><div class="fact-value small">${escapeHtml(data.medicalAlert)}</div></div>`
              : ""
          }
          ${
            data.allergies
              ? `<div class="fact-card wide"><div class="fact-icon">⚠️</div><div class="fact-label">Allergies</div><div class="fact-value small">${escapeHtml(data.allergies)}</div></div>`
              : ""
          }
        </div>
        `
            : `<p class="muted center" style="padding:20px 0;">No medical details were shared on this card.</p>`
        }

        ${
          data.contactName
            ? `
        <div class="contact-card">
          <div class="fact-label">Emergency contact</div>
          <div class="contact-name">${escapeHtml(data.contactName)}${data.contactPhone ? " &middot; " + escapeHtml(data.contactPhone) : ""}</div>
          ${
            data.contactPhone
              ? `<a class="call-btn" href="tel:${escapeHtml(data.contactPhone)}">📞 Call emergency contact</a>`
              : ""
          }
        </div>
        `
            : ""
        }

        ${
          data.instructions
            ? `<div class="instructions-card"><strong>Emergency instructions</strong><br>${nl2br(data.instructions)}</div>`
            : ""
        }

        <div class="footer center">
          This profile only shows what the owner chose to make public.
        </div>
      </div>
    </div>
  `;
  bindNav(app);
}
