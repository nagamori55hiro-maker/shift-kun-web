let FIXED_VALUES = ["公休", "有休", "特休", "欠"];
const ROLE_LABELS = {
  all: "全体",
  leader: "リーダー",
  staff: "スタッフ",
};

const ROLE_MATCHERS = {
  leader: new Set(["リーダー", "leader"]),
  staff: new Set(["スタッフ", "staff"]),
};

let DEFAULT_WORK_PATTERNS = ["A", "B"];
let DEFAULT_REST_PATTERN = "公休";
let MONTHLY_REST_TARGET = 8;
let MIN_DAILY_ATTENDANCE = 9;
let MAX_DAILY_ATTENDANCE_SOFT = 12;
let MIN_DUAL_BUSINESS_ATTENDANCE = 4;
let IDEAL_DUAL_BUSINESS_A = 2;
let IDEAL_DUAL_BUSINESS_B = 2;
let MAX_CONSECUTIVE_WORK = 4;
let MAX_B_REST_A = 3;
let MAX_CONSECUTIVE_OFF_SOFT = 3;
const LEADER_ALL_WORK_DATES = [
  { month: 7, day: 8 },
  { month: 7, day: 22 },
];
const DUAL_BUSINESS_PATTERN = /MCL\s*\/\s*STL|STL\s*\/\s*MCL|MCL\s*・\s*STL|STL\s*・\s*MCL/i;
const SCORE_WEIGHTS = {
  dailyAttendance: 100,
  dualBusinessMin: 100,
  dualBusinessAB: 60,
  noBToA: 100,
  monthlyRest: 80,
  abBalance: 50,
  dailyABBalance: 35,
  noLongWorkRun: 30,
};

const HEADER_PATTERNS = {
  role: ["役職", "職位", "区分", "ポジション", "position", "role"],
  name: ["名前", "氏名", "メンバー", "スタッフ名", "社員名", "従業員名", "name"],
  affiliation: ["所属", "部署", "店舗", "部門", "エリア", "team", "store"],
  capability: ["所属/対応", "所属対応", "対応", "対応可否", "事業対応", "両事業", "対応事業", "capability"],
};

const DEFAULT_ALLOWED_EMAILS = [
  "cs.administrator@mensclear.com",
  "cs.leader2@mensclear.com",
  "nagamori55hiro@gmail.com",
];
const RECOVERY_ALLOWED_EMAILS = ["nagamori55hiro@gmail.com"];
const ACCESS_STORAGE_KEY = "shift-kun-access-list-v2";
const LEGACY_ACCESS_STORAGE_KEY = "shift-kun-access-list-v1";
const GROUP_AUTH_CONFIG = {
  // Cloudflare Worker のURLを設定すると、Googleグループの実メンバー照会を有効にします。
  endpoint: "",
};
const GOOGLE_SHEETS_CONFIG = {
  // URLで指定されたシートの読込・反映に必要な権限です。
  scopes: "https://www.googleapis.com/auth/spreadsheets",
};

const AUTH_CONFIG = {
  enabled: true,
  googleClientId: "309455868192-sj3j6qo659hj53lnfuelv6otu1nvcm4g.apps.googleusercontent.com",
  allowedEmails: [...DEFAULT_ALLOWED_EMAILS],
  allowedDomains: [],
};
const FIREBASE_ACCESS_CONFIG = {
  collectionName: "shiftKunAccess",
  bootstrapAdminEmails: [
    "nagamori55hiro@gmail.com",
    "cs.administrator@mensclear.com",
  ],
  sdkVersion: "11.10.0",
};

const state = {
  workbookName: "",
  sheetName: "",
  googleSpreadsheetId: "",
  googleSpreadsheetUrl: "",
  googleSpreadsheetTitle: "",
  googleSheetId: null,
  googleAccessToken: "",
  googleAccessTokenExpiresAt: 0,
  originalData: [],
  workingData: [],
  headerRowIndex: -1,
  roleColIndex: -1,
  nameColIndex: -1,
  affiliationColIndex: -1,
  capabilityColIndex: -1,
  dateColumns: [],
  structureWarnings: [],
  roleWarnings: {
    all: [],
    leader: [],
    staff: [],
  },
  generationWarnings: [],
  optimizationScores: {
    all: null,
    leader: null,
    staff: null,
  },
  historyModel: createEmptyHistoryModel(),
  historyFiles: [],
  ruleSourceName: "",
  ruleImportSummary: [],
  proposals: [],
  activeProposalIndex: -1,
  generationSalt: 0,
  alternativeRun: 0,
  generatedCells: new Map(),
  lastRoleKey: null,
  activeResultTab: "preview",
  auth: {
    allowed: !AUTH_CONFIG.enabled,
    profile: null,
    role: null,
    firebaseUser: null,
    sharedAccessReady: false,
  },
};
let toastTimer = null;
let firebaseServicesPromise = null;

const els = {
  appShell: document.querySelector("#appShell"),
  authGate: document.querySelector("#authGate"),
  authMessage: document.querySelector("#authMessage"),
  googleSignIn: document.querySelector("#googleSignIn"),
  appStatus: document.querySelector("#appStatus"),
  googleSheetUrl: document.querySelector("#googleSheetUrl"),
  loadGoogleSheetBtn: document.querySelector("#loadGoogleSheetBtn"),
  historyFileInput: document.querySelector("#historyFileInput"),
  chooseHistoryBtn: document.querySelector("#chooseHistoryBtn"),
  historyBadge: document.querySelector("#historyBadge"),
  historyMeta: document.querySelector("#historyMeta"),
  ruleFileInput: document.querySelector("#ruleFileInput"),
  chooseRuleFileBtn: document.querySelector("#chooseRuleFileBtn"),
  ruleImportMeta: document.querySelector("#ruleImportMeta"),
  accessListInput: document.querySelector("#accessListInput"),
  saveAccessBtn: document.querySelector("#saveAccessBtn"),
  accessBadge: document.querySelector("#accessBadge"),
  accessMeta: document.querySelector("#accessMeta"),
  fileBadge: document.querySelector("#fileBadge"),
  importMeta: document.querySelector("#importMeta"),
  workPatternInput: document.querySelector("#workPatternInput"),
  restPatternInput: document.querySelector("#restPatternInput"),
  settingSummary: document.querySelector("#settingSummary"),
  leaderRules: document.querySelector("#leaderRules"),
  staffRules: document.querySelector("#staffRules"),
  createLeaderBtn: document.querySelector("#createLeaderBtn"),
  createStaffBtn: document.querySelector("#createStaffBtn"),
  createAllBtn: document.querySelector("#createAllBtn"),
  createAlternativeBtn: document.querySelector("#createAlternativeBtn"),
  proposalCountSelect: document.querySelector("#proposalCountSelect"),
  feedbackInput: document.querySelector("#feedbackInput"),
  applyGoogleSheetsBtn: document.querySelector("#applyGoogleSheetsBtn"),
  generatedBadge: document.querySelector("#generatedBadge"),
  leaderCount: document.querySelector("#leaderCount"),
  staffCount: document.querySelector("#staffCount"),
  excludedCount: document.querySelector("#excludedCount"),
  generatedCount: document.querySelector("#generatedCount"),
  alerts: document.querySelector("#alerts"),
  proposalPanel: document.querySelector("#proposalPanel"),
  proposalList: document.querySelector("#proposalList"),
  proposalSummary: document.querySelector("#proposalSummary"),
  comparisonPanel: document.querySelector("#comparisonPanel"),
  resultTabButtons: document.querySelectorAll(".result-tab"),
  resultTabPanels: document.querySelectorAll(".result-tab-panel"),
  issueBadge: document.querySelector("#issueBadge"),
  tableFrame: document.querySelector("#tableFrame"),
  previewSubtext: document.querySelector("#previewSubtext"),
  steps: document.querySelectorAll(".step"),
  toastRegion: document.querySelector("#toastRegion"),
};

document.addEventListener("DOMContentLoaded", () => {
  loadAccessSettings();
  initAccessControl();
  bindEvents();
  renderAll();
  refreshIcons();
});

function bindEvents() {
  els.chooseHistoryBtn.addEventListener("click", () => els.historyFileInput.click());
  els.chooseRuleFileBtn.addEventListener("click", () => els.ruleFileInput.click());
  els.loadGoogleSheetBtn.addEventListener("click", loadGoogleSheet);
  els.googleSheetUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadGoogleSheet();
  });
  els.historyFileInput.addEventListener("change", (event) => {
    const files = [...event.target.files];
    if (files.length) {
      importHistoryFiles(files);
    }
  });
  els.ruleFileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      importRuleFile(file);
    }
  });
  els.saveAccessBtn.addEventListener("click", () => void saveAccessSettings());
  els.createLeaderBtn.addEventListener("click", () => createShift("leader"));
  els.createStaffBtn.addEventListener("click", () => createShift("staff"));
  els.createAllBtn.addEventListener("click", () => createShift("all"));
  els.createAlternativeBtn.addEventListener("click", () => createAlternativeShift());
  els.proposalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-proposal-index]");
    if (button) {
      selectProposal(Number(button.dataset.proposalIndex));
    }
  });
  els.resultTabButtons.forEach((button) => {
    button.addEventListener("click", () => setResultTab(button.dataset.resultTab));
  });
  els.applyGoogleSheetsBtn.addEventListener("click", applyGoogleSheet);
  els.workPatternInput.addEventListener("input", renderSettingSummary);
  els.restPatternInput.addEventListener("input", renderSettingSummary);
}

function loadAccessSettings() {
  if (typeof localStorage === "undefined") {
    renderAccessSettings();
    return;
  }

  try {
    const current = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || "null");
    const legacy = JSON.parse(localStorage.getItem(LEGACY_ACCESS_STORAGE_KEY) || "null");
    const saved = current || legacy;
    if (saved && Array.isArray(saved.allowedEmails)) {
      AUTH_CONFIG.allowedEmails = current
        ? saved.allowedEmails
        : uniqueStrings([...DEFAULT_ALLOWED_EMAILS, ...saved.allowedEmails]);
      AUTH_CONFIG.allowedDomains = Array.isArray(saved.allowedDomains) ? saved.allowedDomains : [];
    }
  } catch (_) {
    localStorage.removeItem(ACCESS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ACCESS_STORAGE_KEY);
  }

  renderAccessSettings();
}

async function saveAccessSettings() {
  const parsed = parseAccessList(els.accessListInput.value);

  if (usesSharedFirebaseAccess()) {
    if (state.auth.role !== "admin") {
      showToast("アクセス権限を変更できるのは管理者のみです", "error");
      return;
    }

    if (parsed.allowedDomains.length) {
      showToast("共通のアクセス権限には個別のメールアドレスを入力してください", "warn");
    }

    try {
      await saveSharedAccessSettings(parsed.allowedEmails);
      const message = "アクセス権限を全利用者へ共有しました";
      setStatus(message);
      showToast(message, "success");
    } catch (error) {
      const message = error?.message || "アクセス権限を共有できませんでした";
      setStatus(message);
      showToast(message, "error");
    }
    return;
  }

  AUTH_CONFIG.allowedEmails = parsed.allowedEmails;
  AUTH_CONFIG.allowedDomains = parsed.allowedDomains;

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(parsed));
    localStorage.removeItem(LEGACY_ACCESS_STORAGE_KEY);
  }
  renderAccessSettings();
  const message = parsed.ignoredGroups.length
    ? "Googleグループは個別メールを登録してください"
    : "アクセス権限を保存しました";
  setStatus(message);
  showToast(message, parsed.ignoredGroups.length ? "warn" : "success");
}

function parseAccessList(value) {
  const items = normalizeAscii(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowedEmails = [];
  const allowedDomains = [];
  const ignoredGroups = [];

  items.forEach((item) => {
    if (item.startsWith("group:")) {
      ignoredGroups.push(item.replace(/^group:/, "").trim());
      return;
    }

    if (item.startsWith("@")) {
      allowedDomains.push(item.slice(1));
      return;
    }

    if (item.includes("@")) {
      allowedEmails.push(item);
      return;
    }

    allowedDomains.push(item);
  });

  return {
    allowedEmails: uniqueStrings(allowedEmails),
    allowedDomains: uniqueStrings(allowedDomains),
    ignoredGroups: uniqueStrings(ignoredGroups),
  };
}

function renderAccessSettings() {
  if (!els.accessListInput) return;

  const lines = [
    ...AUTH_CONFIG.allowedEmails,
    ...AUTH_CONFIG.allowedDomains.map((domain) => `@${domain}`),
  ];
  els.accessListInput.value = lines.join("\n");

  const sharedAccess = usesSharedFirebaseAccess();
  const canManageAccess = !sharedAccess || state.auth.role === "admin";
  els.accessListInput.disabled = !canManageAccess;
  els.saveAccessBtn.disabled = !canManageAccess;

  const count = AUTH_CONFIG.allowedEmails.length + AUTH_CONFIG.allowedDomains.length;
  if (els.accessBadge) els.accessBadge.textContent = `${count}件`;
  if (els.accessMeta) {
    els.accessMeta.innerHTML = [
      ["ユーザー", `${AUTH_CONFIG.allowedEmails.length}件`],
      ["ドメイン", `${AUTH_CONFIG.allowedDomains.length}件`],
      ["方式", AUTH_CONFIG.enabled ? "Googleログイン有効" : "ローカル確認中"],
    ]
      .map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd>
        </div>
      `)
      .join("");
    if (sharedAccess) {
      els.accessMeta.insertAdjacentHTML(
        "beforeend",
        `<div><dt>同期</dt><dd>${state.auth.sharedAccessReady ? "Firestore共有" : "ログイン後に確認"}</dd></div>`,
      );
    }
  }
}

function uniqueStrings(items) {
  return [...new Set(items.map((item) => normalizeText(item).toLowerCase()).filter(Boolean))];
}

function initAccessControl() {
  if (!AUTH_CONFIG.enabled) {
    state.auth.allowed = true;
    renderAuthGate();
    return;
  }

  state.auth.allowed = false;
  renderAuthGate("許可されたGoogleアカウントでログインしてください。");

  if (!AUTH_CONFIG.googleClientId) {
    renderAuthGate("GoogleログインのクライアントIDが未設定です。AUTH_CONFIG.googleClientId を設定してください。");
    return;
  }

  waitForGoogleIdentity();
}

function waitForGoogleIdentity(attempt = 0) {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.initialize({
      client_id: AUTH_CONFIG.googleClientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(els.googleSignIn, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
    });
    return;
  }

  if (attempt >= 50) {
    renderAuthGate("Googleログインを読み込めませんでした。ネットワーク接続を確認してください。");
    return;
  }

  window.setTimeout(() => waitForGoogleIdentity(attempt + 1), 100);
}

async function handleGoogleCredential(response) {
  const profile = decodeJwtPayload(response.credential);

  if (!profile?.email) {
    renderAuthGate("Googleアカウント情報を確認できませんでした。");
    return;
  }

  if (usesSharedFirebaseAccess()) {
    try {
      const sharedAccess = await authorizeSharedFirebaseAccess(profile, response.credential);
      if (sharedAccess.allowed) {
        grantAccess(profile, sharedAccess);
        return;
      }

      state.auth = { allowed: false, profile, role: null, firebaseUser: null, sharedAccessReady: true };
      renderAuthGate(`${profile.email} はこのアプリの許可対象ではありません。`);
    } catch (error) {
      state.auth = { allowed: false, profile, role: null, firebaseUser: null, sharedAccessReady: false };
      renderAuthGate(error?.message || "共通のアクセス権限を確認できませんでした。もう一度ログインしてください。");
    }
    return;
  }

  if (isAllowedGoogleProfile(profile)) {
    grantAccess(profile);
    return;
  }

  const groupAccess = await checkGoogleGroupAccess(response.credential, profile);
  if (groupAccess.allowed) {
    grantAccess(profile);
    return;
  }

  state.auth = { allowed: false, profile };
  renderAuthGate(`${profile.email} はこのアプリの許可対象ではありません。`);
}

function grantAccess(profile, access = {}) {
  state.auth = {
    allowed: true,
    profile,
    role: access.role || null,
    firebaseUser: access.firebaseUser || null,
    sharedAccessReady: Boolean(access.sharedAccessReady),
  };
  renderAuthGate();
  renderAccessSettings();
}

function isAllowedGoogleProfile(profile) {
  const email = normalizeText(profile.email).toLowerCase();
  const domain = email.split("@")[1] || "";
  const hostedDomain = normalizeText(profile.hd).toLowerCase();
  const allowedEmails = uniqueStrings([
    ...RECOVERY_ALLOWED_EMAILS,
    ...AUTH_CONFIG.allowedEmails,
  ]);
  const allowedDomains = AUTH_CONFIG.allowedDomains.map((item) => normalizeText(item).toLowerCase());

  if (allowedEmails.includes(email)) return true;
  if (allowedDomains.includes(domain) || (hostedDomain && allowedDomains.includes(hostedDomain))) return true;

  return false;
}

async function checkGoogleGroupAccess(credential, profile) {
  const endpoint = normalizeText(GROUP_AUTH_CONFIG.endpoint).replace(/\/$/, "");
  if (!endpoint || !credential || !profile?.email) return { allowed: false };

  try {
    const response = await fetch(`${endpoint}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) return { allowed: false };

    const result = await response.json();
    return {
      allowed: result?.allowed === true && normalizeText(result.email).toLowerCase() === normalizeText(profile.email).toLowerCase(),
    };
  } catch (_) {
    return { allowed: false };
  }
}

function usesSharedFirebaseAccess() {
  const config = window.SHIFT_KUN_FIREBASE_CONFIG;
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function isBootstrapAccessAdmin(email) {
  return FIREBASE_ACCESS_CONFIG.bootstrapAdminEmails.includes(normalizeText(email).toLowerCase());
}

async function getFirebaseServices() {
  if (!usesSharedFirebaseAccess()) {
    throw new Error("Firestoreの共有権限設定が見つかりません。");
  }

  if (!firebaseServicesPromise) {
    firebaseServicesPromise = (async () => {
      const root = `https://www.gstatic.com/firebasejs/${FIREBASE_ACCESS_CONFIG.sdkVersion}`;
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`${root}/firebase-app.js`),
        import(`${root}/firebase-auth.js`),
        import(`${root}/firebase-firestore.js`),
      ]);
      const config = window.SHIFT_KUN_FIREBASE_CONFIG;
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);

      return {
        auth: authModule.getAuth(app),
        db: firestoreModule.getFirestore(app),
        GoogleAuthProvider: authModule.GoogleAuthProvider,
        signInWithCredential: authModule.signInWithCredential,
        collection: firestoreModule.collection,
        deleteDoc: firestoreModule.deleteDoc,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        serverTimestamp: firestoreModule.serverTimestamp,
        setDoc: firestoreModule.setDoc,
        writeBatch: firestoreModule.writeBatch,
      };
    })().catch((error) => {
      firebaseServicesPromise = null;
      throw error;
    });
  }

  return firebaseServicesPromise;
}

function getSharedAccessDoc(services, email) {
  return services.doc(services.db, FIREBASE_ACCESS_CONFIG.collectionName, normalizeText(email).toLowerCase());
}

function normalizeSharedAccessRecord(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    email: normalizeText(data.email || snapshot.id).toLowerCase(),
    active: data.active !== false,
    role: data.role === "admin" ? "admin" : "member",
  };
}

async function ensureSharedAccessSeed(services) {
  const existing = await services.getDocs(services.collection(services.db, FIREBASE_ACCESS_CONFIG.collectionName));
  if (!existing.empty) return;

  const seedEmails = uniqueStrings([
    ...DEFAULT_ALLOWED_EMAILS,
    ...RECOVERY_ALLOWED_EMAILS,
    ...AUTH_CONFIG.allowedEmails,
  ]);
  const batch = services.writeBatch(services.db);
  seedEmails.forEach((email) => {
    batch.set(getSharedAccessDoc(services, email), {
      email,
      active: true,
      role: isBootstrapAccessAdmin(email) ? "admin" : "member",
      updatedAt: services.serverTimestamp(),
    });
  });
  await batch.commit();
}

async function loadSharedAccessSettings(services) {
  const snapshot = await services.getDocs(services.collection(services.db, FIREBASE_ACCESS_CONFIG.collectionName));
  const records = snapshot.docs
    .map(normalizeSharedAccessRecord)
    .filter((record) => record?.active && record.email)
    .sort((a, b) => a.email.localeCompare(b.email));

  AUTH_CONFIG.allowedEmails = records.map((record) => record.email);
  AUTH_CONFIG.allowedDomains = [];
  renderAccessSettings();
  return records;
}

async function authorizeSharedFirebaseAccess(profile, googleIdToken) {
  const services = await getFirebaseServices();
  const credential = services.GoogleAuthProvider.credential(googleIdToken);
  const result = await services.signInWithCredential(services.auth, credential);
  const email = normalizeText(result.user?.email || profile.email).toLowerCase();
  const profileEmail = normalizeText(profile.email).toLowerCase();
  if (!email || email !== profileEmail) {
    throw new Error("Googleアカウントの確認に失敗しました。");
  }

  const bootstrapAdmin = isBootstrapAccessAdmin(email);
  if (bootstrapAdmin) {
    await ensureSharedAccessSeed(services);
  }

  const record = normalizeSharedAccessRecord(await services.getDoc(getSharedAccessDoc(services, email)));
  const allowed = bootstrapAdmin || Boolean(record?.active);
  if (!allowed) return { allowed: false };

  const role = bootstrapAdmin || record?.role === "admin" ? "admin" : "member";
  if (role === "admin") {
    await loadSharedAccessSettings(services);
  }

  return {
    allowed: true,
    role,
    firebaseUser: result.user,
    sharedAccessReady: true,
  };
}

async function saveSharedAccessSettings(emails) {
  const services = await getFirebaseServices();
  const desiredEmails = uniqueStrings(emails);
  if (!desiredEmails.length) {
    throw new Error("少なくとも1件の許可メールアドレスを入力してください。");
  }

  const existing = await services.getDocs(services.collection(services.db, FIREBASE_ACCESS_CONFIG.collectionName));
  const existingByEmail = new Map(
    existing.docs
      .map(normalizeSharedAccessRecord)
      .filter(Boolean)
      .map((record) => [record.email, record]),
  );
  const desiredSet = new Set(desiredEmails);
  const batch = services.writeBatch(services.db);

  desiredEmails.forEach((email) => {
    const previous = existingByEmail.get(email);
    batch.set(
      getSharedAccessDoc(services, email),
      {
        email,
        active: true,
        role: isBootstrapAccessAdmin(email) || previous?.role === "admin" ? "admin" : "member",
        updatedAt: services.serverTimestamp(),
      },
      { merge: true },
    );
  });
  existingByEmail.forEach((record, email) => {
    if (!desiredSet.has(email)) batch.delete(getSharedAccessDoc(services, email));
  });

  await batch.commit();
  await loadSharedAccessSettings(services);
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function renderAuthGate(message = "") {
  if (!els.appShell || !els.authGate) return;

  const shouldGate = AUTH_CONFIG.enabled && !state.auth.allowed;
  els.appShell.hidden = shouldGate;
  els.authGate.hidden = !shouldGate;

  if (els.authMessage) {
    els.authMessage.textContent = message || "許可されたGoogleアカウントでログインしてください。";
  }

  refreshIcons();
}

async function loadGoogleSheet() {
  let source;

  try {
    source = parseGoogleSpreadsheetUrl(els.googleSheetUrl.value);
  } catch (error) {
    showToast(error.message || "GoogleスプレッドシートURLを確認してください。", "error");
    return;
  }

  try {
    setStatus("スプレッドシートを読み込み中です");
    els.loadGoogleSheetBtn.disabled = true;

    const accessToken = await getGoogleSheetsAccessToken();
    const spreadsheet = await fetchGoogleSpreadsheet(source.spreadsheetId, accessToken);
    const sheet = selectGoogleSheet(spreadsheet.sheets || [], source.sheetId);
    const rows = sheetDataToRows(sheet);

    if (!rows.length || !getMaxColumns(rows)) {
      throw new Error("選択したシートに読み込み可能なデータがありません。");
    }

    state.workbookName = spreadsheet.properties?.title || "Googleスプレッドシート";
    state.sheetName = sheet.properties.title;
    state.googleSpreadsheetId = source.spreadsheetId;
    state.googleSpreadsheetUrl = source.url;
    state.googleSpreadsheetTitle = spreadsheet.properties?.title || "Googleスプレッドシート";
    state.googleSheetId = sheet.properties.sheetId;
    state.originalData = normalizeRows(rows);
    state.workingData = cloneRows(state.originalData);
    state.generatedCells.clear();
    state.roleWarnings = { all: [], leader: [], staff: [] };
    state.generationWarnings = [];
    state.optimizationScores = { all: null, leader: null, staff: null };
    state.proposals = [];
    state.activeProposalIndex = -1;
    state.lastRoleKey = null;
    state.activeResultTab = "preview";

    analyzeStructure();
    setStatus(`${state.googleSpreadsheetTitle} を読み込みました`);
    setActiveStep("settings");
    renderAll();
    showToast(`${state.sheetName} タブを読み込みました`);
  } catch (error) {
    state.structureWarnings = [
      {
        level: "error",
        message: error.message || "スプレッドシートの読み込みに失敗しました。",
      },
    ];
    setStatus("スプレッドシートの読み込みに失敗しました");
    renderAll();
    showToast(error.message || "スプレッドシートの読み込みに失敗しました", "error");
  } finally {
    els.loadGoogleSheetBtn.disabled = false;
  }
}

function parseGoogleSpreadsheetUrl(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const isId = /^[a-zA-Z0-9_-]{20,}$/.test(raw);
  const spreadsheetId = match?.[1] || (isId ? raw : "");

  if (!spreadsheetId) {
    throw new Error("GoogleスプレッドシートのURLを入力してください。");
  }

  let sheetId = null;
  try {
    const url = new URL(raw);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const gid = url.searchParams.get("gid") || hashParams.get("gid");
    if (gid !== null && /^\d+$/.test(gid)) sheetId = Number(gid);
  } catch (_) {
    // スプレッドシートIDだけが入力された場合は先頭タブを読み込みます。
  }

  return {
    spreadsheetId,
    sheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${sheetId === null ? "" : `#gid=${sheetId}`}`,
  };
}

async function getGoogleSheetsAccessToken() {
  if (state.googleAccessToken && state.googleAccessTokenExpiresAt > Date.now() + 60_000) {
    return state.googleAccessToken;
  }

  const token = await requestGoogleSheetsAccessToken({
    prompt: state.googleAccessToken ? "" : "consent",
  });
  state.googleAccessToken = token.accessToken;
  state.googleAccessTokenExpiresAt = token.expiresAt;
  return state.googleAccessToken;
}

async function fetchGoogleSpreadsheet(spreadsheetId, accessToken) {
  const fields = [
    "spreadsheetId",
    "properties(title)",
    "sheets(properties(sheetId,title,index,hidden),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))))",
  ].join(",");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=true&fields=${encodeURIComponent(fields)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw await readGoogleApiError(response, "スプレッドシートを読み込めませんでした。共有権限を確認してください。");
  }
  return response.json();
}

function selectGoogleSheet(sheets, requestedSheetId) {
  if (!sheets.length) throw new Error("スプレッドシートにシートがありません。");

  if (Number.isInteger(requestedSheetId)) {
    const matched = sheets.find((sheet) => sheet.properties?.sheetId === requestedSheetId);
    if (!matched) throw new Error("URLで指定されたタブを見つけられませんでした。");
    return matched;
  }

  return sheets.find((sheet) => !sheet.properties?.hidden) || sheets[0];
}

function sheetDataToRows(sheet) {
  const rows = [];

  for (const grid of sheet.data || []) {
    const startRow = Number(grid.startRow || 0);
    const startColumn = Number(grid.startColumn || 0);

    for (const [relativeRow, rowData] of (grid.rowData || []).entries()) {
      const rowIndex = startRow + relativeRow;
      if (!rows[rowIndex]) rows[rowIndex] = [];

      for (const [relativeColumn, cell] of (rowData.values || []).entries()) {
        const columnIndex = startColumn + relativeColumn;
        rows[rowIndex][columnIndex] = googleCellValue(cell);
      }
    }
  }

  return rows;
}

function googleCellValue(cell) {
  if (cell?.formattedValue !== undefined) return cell.formattedValue;

  const value = cell?.effectiveValue || {};
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.numberValue !== undefined) return value.numberValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.formulaValue !== undefined) return value.formulaValue;
  return "";
}

async function importHistoryFiles(files) {
  setStatus("過去シフトを学習中です");

  try {
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = readWorkbook(file, buffer);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) continue;

      const worksheet = workbook.Sheets[sheetName];
      const rows = normalizeRows(XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: "",
      }));

      learnFromHistoryRows(rows, file.name);
      state.historyFiles.push(file.name);
    }

    setStatus(`${files.length}件の過去シフトを学習しました`);
    renderAll();
    showToast(`${files.length}件の過去シフトを学習しました`);
  } catch (error) {
    pushRuntimeWarning("error", `過去シフトの学習に失敗しました。${error.message || ""}`);
    showToast(error.message || "過去シフトの学習に失敗しました", "error");
  } finally {
    els.historyFileInput.value = "";
  }
}

async function importRuleFile(file) {
  setStatus("条件・ルールを読み込み中です");

  try {
    const text = await readTextFile(file);
    const summary = applyImportedRules(text, file.name);
    state.ruleSourceName = file.name;
    state.ruleImportSummary = summary;
    renderRuleImportMeta();
    renderSettingSummary();
    setStatus(`${file.name} の条件・ルールを読み込みました`);
    setActiveStep("rules");
    showToast(`${file.name} の条件・ルールを読み込みました`);
  } catch (error) {
    pushRuntimeWarning("error", `条件・ルールの読み込みに失敗しました。${error.message || ""}`);
    showToast(error.message || "条件・ルールの読み込みに失敗しました", "error");
  } finally {
    els.ruleFileInput.value = "";
  }
}

async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  return decodeCsv(buffer);
}

function applyImportedRules(text, fileName = "") {
  const isJson = /\.json$/i.test(fileName);
  const values = isJson ? parseRuleJson(text) : parseRuleText(text);
  const summary = [];

  if (Number.isFinite(values.PUBLIC_OFF_TARGET)) {
    MONTHLY_REST_TARGET = values.PUBLIC_OFF_TARGET;
    summary.push(`公休${MONTHLY_REST_TARGET}日`);
  }

  if (Number.isFinite(values.MIN_DAILY_ATTENDANCE)) {
    MIN_DAILY_ATTENDANCE = values.MIN_DAILY_ATTENDANCE;
    summary.push(`毎日出勤${MIN_DAILY_ATTENDANCE}名以上`);
  }

  if (Number.isFinite(values.MIN_MCL_STL_ATTENDANCE)) {
    MIN_DUAL_BUSINESS_ATTENDANCE = values.MIN_MCL_STL_ATTENDANCE;
    summary.push(`MCL/STL ${MIN_DUAL_BUSINESS_ATTENDANCE}名以上`);
  }

  if (Number.isFinite(values.IDEAL_MCL_STL_A)) {
    IDEAL_DUAL_BUSINESS_A = values.IDEAL_MCL_STL_A;
    summary.push(`MCL/STL A${IDEAL_DUAL_BUSINESS_A}名`);
  }

  if (Number.isFinite(values.IDEAL_MCL_STL_B)) {
    IDEAL_DUAL_BUSINESS_B = values.IDEAL_MCL_STL_B;
    summary.push(`MCL/STL B${IDEAL_DUAL_BUSINESS_B}名`);
  }

  if (Number.isFinite(values.MAX_CONSECUTIVE_WORK)) {
    MAX_CONSECUTIVE_WORK = values.MAX_CONSECUTIVE_WORK;
    summary.push(`${MAX_CONSECUTIVE_WORK}連勤以内`);
  }

  if (Array.isArray(values.OFF_WORDS) && values.OFF_WORDS.length) {
    FIXED_VALUES = uniqueStrings([...FIXED_VALUES, ...values.OFF_WORDS]);
    summary.push(`休み語句 ${values.OFF_WORDS.length}件`);
  }

  applyImportedRuleText(summary);

  return summary.length ? summary : ["読み取り可能な条件がありませんでした"];
}

function parseRuleJson(text) {
  const data = JSON.parse(text);
  return {
    PUBLIC_OFF_TARGET: numberFromValue(data.PUBLIC_OFF_TARGET ?? data.publicOffTarget ?? data.monthlyRestTarget),
    MIN_DAILY_ATTENDANCE: numberFromValue(data.MIN_DAILY_ATTENDANCE ?? data.minDailyAttendance),
    MIN_MCL_STL_ATTENDANCE: numberFromValue(data.MIN_MCL_STL_ATTENDANCE ?? data.minMclStlAttendance),
    IDEAL_MCL_STL_A: numberFromValue(data.IDEAL_MCL_STL_A ?? data.idealMclStlA),
    IDEAL_MCL_STL_B: numberFromValue(data.IDEAL_MCL_STL_B ?? data.idealMclStlB),
    MAX_CONSECUTIVE_WORK: numberFromValue(data.MAX_CONSECUTIVE_WORK ?? data.maxConsecutiveWork),
    OFF_WORDS: Array.isArray(data.OFF_WORDS) ? data.OFF_WORDS : data.offWords,
  };
}

function parseRuleText(text) {
  const values = {
    PUBLIC_OFF_TARGET: extractPythonNumber(text, "PUBLIC_OFF_TARGET"),
    MIN_DAILY_ATTENDANCE: extractPythonNumber(text, "MIN_DAILY_ATTENDANCE"),
    MIN_MCL_STL_ATTENDANCE: extractPythonNumber(text, "MIN_MCL_STL_ATTENDANCE"),
    IDEAL_MCL_STL_A: extractPythonNumber(text, "IDEAL_MCL_STL_A"),
    IDEAL_MCL_STL_B: extractPythonNumber(text, "IDEAL_MCL_STL_B"),
    MAX_CONSECUTIVE_WORK: extractPythonNumber(text, "MAX_CONSECUTIVE_WORK"),
    OFF_WORDS: extractPythonTupleStrings(text, "OFF_WORDS"),
  };

  const runLimit = text.match(/run_excess_mask\s*\(\s*work\s*,\s*(\d+)\s*\)/);
  if (!Number.isFinite(values.MAX_CONSECUTIVE_WORK) && runLimit) {
    values.MAX_CONSECUTIVE_WORK = Number(runLimit[1]);
  }

  return values;
}

function extractPythonNumber(text, name) {
  const match = text.match(new RegExp(`^\\s*${name}\\s*=\\s*([0-9]+)`, "m"));
  return match ? Number(match[1]) : null;
}

function extractPythonTupleStrings(text, name) {
  const match = text.match(new RegExp(`${name}\\s*=\\s*\\(([^)]*)\\)`, "s"));
  if (!match) return [];

  return [...match[1].matchAll(/["']([^"']+)["']/g)]
    .map((item) => normalizeText(item[1]))
    .filter(Boolean);
}

function numberFromValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function applyImportedRuleText(summary) {
  const commonLines = [
    `公休は月間${MONTHLY_REST_TARGET}日`,
    `毎日出勤${MIN_DAILY_ATTENDANCE}名以上`,
    `MCL/STLは毎日${MIN_DUAL_BUSINESS_ATTENDANCE}名以上`,
    `MCL/STLはA${IDEAL_DUAL_BUSINESS_A}名・B${IDEAL_DUAL_BUSINESS_B}名が理想`,
    `B→Aは禁止`,
    `${MAX_CONSECUTIVE_WORK}連勤以内にする`,
    `固定入力済みセルは上書きしない`,
  ];

  els.leaderRules.value = [
    "リーダー・スタッフ全体条件に従う",
    ...commonLines,
  ].join("\n");
  els.staffRules.value = [
    "スタッフ条件に従う",
    ...commonLines,
  ].join("\n");
}

function readWorkbook(file, buffer) {
  const isCsv = /\.csv$/i.test(file.name);

  if (isCsv) {
    const text = decodeCsv(buffer);
    return XLSX.read(text, { type: "string", cellDates: true });
  }

  return XLSX.read(buffer, { type: "array", cellDates: true });
}

function decodeCsv(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const utf8Errors = countReplacementCharacters(utf8);

  try {
    const sjis = new TextDecoder("shift_jis").decode(buffer);
    const sjisErrors = countReplacementCharacters(sjis);
    if (sjisErrors < utf8Errors) {
      return sjis;
    }
  } catch (_) {
    return utf8;
  }

  return utf8;
}

function createEmptyHistoryModel() {
  return {
    files: 0,
    totalCells: 0,
    rolePattern: {
      all: { A: 0, B: 0, rest: 0 },
      leader: { A: 0, B: 0, rest: 0 },
      staff: { A: 0, B: 0, rest: 0 },
    },
    memberPattern: {},
    weekdayPattern: Array.from({ length: 7 }, () => ({ A: 0, B: 0, rest: 0 })),
    dayPattern: {},
    monthStart: { A: 0, B: 0, rest: 0 },
    dualAttendanceByDay: {},
    consecutiveRuns: { A: 0, B: 0, mixed: 0 },
    bToAObserved: 0,
    bToAAvoided: 0,
  };
}

function learnFromHistoryRows(rows) {
  const structure = detectRowsStructure(rows);
  if (!structure || structure.dateColumns.length < 2 || structure.roleColIndex < 0 || structure.nameColIndex < 0) {
    return;
  }

  state.historyModel.files += 1;

  for (let rowIndex = structure.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const role = normalizeText(row[structure.roleColIndex]);
    const name = normalizeText(row[structure.nameColIndex]);
    const roleKey = isRoleValue(role, "leader") ? "leader" : isRoleValue(role, "staff") ? "staff" : "";
    if (!roleKey || !name) continue;

    if (!state.historyModel.memberPattern[name]) {
      state.historyModel.memberPattern[name] = { A: 0, B: 0, rest: 0 };
    }

    let previous = "";
    let currentRun = [];

    structure.dateColumns.forEach((dateColumn) => {
      const value = normalizeText(row[dateColumn.index]);
      const pattern = normalizeHistoryPattern(value);
      if (!pattern) return;

      incrementPattern(state.historyModel.rolePattern.all, pattern);
      incrementPattern(state.historyModel.rolePattern[roleKey], pattern);
      incrementPattern(state.historyModel.memberPattern[name], pattern);
      incrementPattern(state.historyModel.weekdayPattern[dateColumn.date.getDay()], pattern);
      if (!state.historyModel.dayPattern[dateColumn.date.getDate()]) {
        state.historyModel.dayPattern[dateColumn.date.getDate()] = { A: 0, B: 0, rest: 0 };
      }
      incrementPattern(state.historyModel.dayPattern[dateColumn.date.getDate()], pattern);
      if (dateColumn.date.getDate() === 1) incrementPattern(state.historyModel.monthStart, pattern);
      state.historyModel.totalCells += 1;

      if (roleKey === "staff" && structure.capabilityColIndex >= 0 && DUAL_BUSINESS_PATTERN.test(normalizeText(row[structure.capabilityColIndex]))) {
        const day = dateColumn.date.getDate();
        if (!state.historyModel.dualAttendanceByDay[day]) state.historyModel.dualAttendanceByDay[day] = 0;
        if (pattern !== "rest") state.historyModel.dualAttendanceByDay[day] += 1;
      }

      if (previous === "B") {
        if (pattern === "A") state.historyModel.bToAObserved += 1;
        if (pattern === "rest") state.historyModel.bToAAvoided += 1;
      }

      if (pattern === "A" || pattern === "B") {
        currentRun.push(pattern);
      } else {
        recordHistoryRun(currentRun);
        currentRun = [];
      }

      previous = pattern;
    });

    recordHistoryRun(currentRun);
  }
}

function detectRowsStructure(rows) {
  const searchRows = Math.min(rows.length, 25);
  let best = null;

  for (let rowIndex = 0; rowIndex < searchRows; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const dateColumns = finalizeDateColumns(collectDateCandidates(row));
    const roleColIndex = findHeaderIndex(row, HEADER_PATTERNS.role);
    const nameColIndex = findHeaderIndex(row, HEADER_PATTERNS.name);
    const affiliationColIndex = findHeaderIndex(row, HEADER_PATTERNS.affiliation);
    const capabilityColIndex = findHeaderIndex(row, HEADER_PATTERNS.capability);
    let score = dateColumns.length * 5;
    if (roleColIndex >= 0) score += 18;
    if (nameColIndex >= 0) score += 18;
    if (capabilityColIndex >= 0) score += 6;

    if (!best || score > best.score) {
      best = {
        score,
        headerRowIndex: rowIndex,
        dateColumns,
        roleColIndex,
        nameColIndex,
        affiliationColIndex,
        capabilityColIndex,
      };
    }
  }

  return best;
}

function normalizeHistoryPattern(value) {
  const type = classifyShiftValue(value);
  if (type === "A" || type === "B") return type;
  if (type === "off") return "rest";
  if (type === "work") return "work";
  return "";
}

function incrementPattern(target, pattern) {
  if (pattern === "A") target.A += 1;
  if (pattern === "B") target.B += 1;
  if (pattern === "rest") target.rest += 1;
}

function recordHistoryRun(run) {
  if (run.length < 4) return;
  const unique = new Set(run);
  if (unique.size === 1) {
    state.historyModel.consecutiveRuns[run[0]] += 1;
  } else {
    state.historyModel.consecutiveRuns.mixed += 1;
  }
}

function analyzeStructure() {
  state.structureWarnings = [];
  state.headerRowIndex = -1;
  state.roleColIndex = -1;
  state.nameColIndex = -1;
  state.affiliationColIndex = -1;
  state.capabilityColIndex = -1;
  state.dateColumns = [];

  if (!state.workingData.length) {
    state.structureWarnings.push({
      level: "error",
      message: "読み込んだファイルにデータがありません。",
    });
    return;
  }

  const searchRows = Math.min(state.workingData.length, 25);
  let best = null;

  for (let rowIndex = 0; rowIndex < searchRows; rowIndex += 1) {
    const row = state.workingData[rowIndex] || [];
    const dateColumns = finalizeDateColumns(collectDateCandidates(row));
    const roleColIndex = findHeaderIndex(row, HEADER_PATTERNS.role);
    const nameColIndex = findHeaderIndex(row, HEADER_PATTERNS.name);
    const affiliationColIndex = findHeaderIndex(row, HEADER_PATTERNS.affiliation);
    const capabilityColIndex = findHeaderIndex(row, HEADER_PATTERNS.capability);

    let score = dateColumns.length * 5;
    if (dateColumns.length >= 2) score += 12;
    if (roleColIndex >= 0) score += 18;
    if (nameColIndex >= 0) score += 18;
    if (affiliationColIndex >= 0) score += 4;
    if (capabilityColIndex >= 0) score += 6;
    if (countNonBlank(row) >= 3) score += 2;

    if (!best || score > best.score) {
      best = {
        rowIndex,
        score,
        dateColumns,
        roleColIndex,
        nameColIndex,
        affiliationColIndex,
        capabilityColIndex,
      };
    }
  }

  if (!best || best.score < 8) {
    best = {
      rowIndex: 0,
      dateColumns: [],
      roleColIndex: -1,
      nameColIndex: -1,
      affiliationColIndex: -1,
      capabilityColIndex: -1,
    };
  }

  state.headerRowIndex = best.rowIndex;
  state.dateColumns = best.dateColumns;
  state.roleColIndex = best.roleColIndex;
  state.nameColIndex = best.nameColIndex;
  state.affiliationColIndex = best.affiliationColIndex;
  state.capabilityColIndex = best.capabilityColIndex;

  if (state.roleColIndex < 0) {
    state.roleColIndex = inferRoleColumn();
  }

  if (state.nameColIndex < 0) {
    state.nameColIndex = inferNameColumn();
  }

  if (state.affiliationColIndex < 0) {
    state.affiliationColIndex = findHeaderIndex(
      state.workingData[state.headerRowIndex] || [],
      HEADER_PATTERNS.affiliation,
    );
  }

  if (state.capabilityColIndex < 0) {
    state.capabilityColIndex = inferCapabilityColumn();
  }

  if (state.dateColumns.length < 2) {
    state.structureWarnings.push({
      level: "error",
      message: "日付列を判定できませんでした。横軸の日付行を確認してください。",
    });
  }

  if (state.roleColIndex < 0) {
    state.structureWarnings.push({
      level: "error",
      message: "役職列を判定できませんでした。列名に「役職」などを入れてください。",
    });
  }

  if (state.nameColIndex < 0) {
    state.structureWarnings.push({
      level: "error",
      message: "名前列を判定できませんでした。列名に「名前」または「氏名」などを入れてください。",
    });
  }

  if (state.dateColumns.some((column) => column.source === "day-only")) {
    const base = state.dateColumns.find((column) => column.source === "day-only")?.date;
    const label = base
      ? `${base.getFullYear()}年${base.getMonth() + 1}月`
      : "現在の年月";
    state.structureWarnings.push({
      level: "warn",
      message: `日付が日だけの列は ${label} として曜日判定しています。`,
    });
  }
}

function collectDateCandidates(row) {
  const candidates = [];

  row.forEach((cell, index) => {
    const parsed = parseDateCell(cell);
    if (parsed) {
      candidates.push({
        index,
        ...parsed,
      });
    }
  });

  return candidates;
}

function finalizeDateColumns(candidates) {
  if (candidates.length < 2) {
    return candidates.filter((candidate) => candidate.date);
  }

  const today = new Date();
  const firstFullDate = candidates.find((candidate) => candidate.date)?.date;
  let year = firstFullDate ? firstFullDate.getFullYear() : today.getFullYear();
  let month = firstFullDate ? firstFullDate.getMonth() : today.getMonth();
  let lastDay = 0;

  return candidates
    .sort((a, b) => a.index - b.index)
    .map((candidate) => {
      if (candidate.date) {
        year = candidate.date.getFullYear();
        month = candidate.date.getMonth();
        lastDay = candidate.date.getDate();
        return normalizeDateColumn(candidate, candidate.date);
      }

      if (lastDay && candidate.day < lastDay - 15) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }

      const inferredDate = new Date(year, month, candidate.day);
      lastDay = candidate.day;

      return normalizeDateColumn(
        {
          ...candidate,
          source: "day-only",
        },
        inferredDate,
      );
    });
}

function normalizeDateColumn(candidate, date) {
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return {
    index: candidate.index,
    label: candidate.label || formatDate(normalizedDate),
    date: normalizedDate,
    isWeekend: normalizedDate.getDay() === 0 || normalizedDate.getDay() === 6,
    source: candidate.source || "date",
  };
}

function parseDateCell(cell) {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return {
      date: cell,
      label: formatDate(cell),
      source: "date",
    };
  }

  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (cell > 25000 && cell < 80000) {
      const parsed = excelSerialToDate(cell);
      return {
        date: parsed,
        label: formatDate(parsed),
        source: "serial",
      };
    }

    if (Number.isInteger(cell) && cell >= 1 && cell <= 31) {
      return {
        day: cell,
        label: `${cell}日`,
        source: "day-only",
      };
    }
  }

  const text = normalizeText(cell);
  if (!text) return null;

  const dateWithYear = text.match(/(20\d{2}|19\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (dateWithYear) {
    const date = new Date(Number(dateWithYear[1]), Number(dateWithYear[2]) - 1, Number(dateWithYear[3]));
    return {
      date,
      label: formatDate(date),
      source: "text",
    };
  }

  const monthDay = text.match(/(^|[^\d])(\d{1,2})[\/月](\d{1,2})(日)?/);
  if (monthDay) {
    const year = new Date().getFullYear();
    const date = new Date(year, Number(monthDay[2]) - 1, Number(monthDay[3]));
    return {
      date,
      label: formatDate(date),
      source: "text",
    };
  }

  const dayOnly = text.match(/^(\d{1,2})日(?:\([月火水木金土日]\))?$/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      return {
        day,
        label: `${day}日`,
        source: "day-only",
      };
    }
  }

  return null;
}

function inferRoleColumn() {
  const maxCol = getSearchColumnLimit();
  let best = { index: -1, score: 0 };

  for (let columnIndex = 0; columnIndex < maxCol; columnIndex += 1) {
    let score = 0;

    for (let rowIndex = state.headerRowIndex + 1; rowIndex < state.workingData.length; rowIndex += 1) {
      const value = normalizeText(state.workingData[rowIndex]?.[columnIndex]);
      if (isRoleValue(value, "leader") || isRoleValue(value, "staff")) {
        score += 1;
      }
    }

    if (score > best.score) {
      best = { index: columnIndex, score };
    }
  }

  return best.score > 0 ? best.index : -1;
}

function inferNameColumn() {
  const maxCol = getSearchColumnLimit();
  let best = { index: -1, score: 0 };

  for (let columnIndex = 0; columnIndex < maxCol; columnIndex += 1) {
    if (columnIndex === state.roleColIndex) continue;

    const values = [];
    let roleLike = 0;

    for (let rowIndex = state.headerRowIndex + 1; rowIndex < state.workingData.length; rowIndex += 1) {
      const value = normalizeText(state.workingData[rowIndex]?.[columnIndex]);
      if (!value) continue;
      values.push(value);
      if (isRoleValue(value, "leader") || isRoleValue(value, "staff")) {
        roleLike += 1;
      }
    }

    const unique = new Set(values).size;
    const score = values.length + unique * 2 - roleLike * 4;

    if (score > best.score) {
      best = { index: columnIndex, score };
    }
  }

  return best.score > 3 ? best.index : -1;
}

function inferCapabilityColumn() {
  const maxCol = getSearchColumnLimit();
  let best = { index: -1, score: 0 };

  for (let columnIndex = 0; columnIndex < maxCol; columnIndex += 1) {
    let score = 0;

    for (let rowIndex = state.headerRowIndex + 1; rowIndex < state.workingData.length; rowIndex += 1) {
      const value = normalizeText(state.workingData[rowIndex]?.[columnIndex]);
      if (!value) continue;
      if (/MCL/i.test(value)) score += 1;
      if (/STL/i.test(value)) score += 1;
      if (DUAL_BUSINESS_PATTERN.test(value)) score += 3;
    }

    if (score > best.score) {
      best = { index: columnIndex, score };
    }
  }

  return best.score > 0 ? best.index : -1;
}

function createShift(roleKey, options = {}) {
  const readiness = getReadinessProblem();
  if (readiness) {
    state.generationWarnings = [
      {
        level: "error",
        message: readiness,
      },
    ];
    renderAll();
    showToast(readiness, "error");
    return;
  }

  const proposalCount = options.proposalCount || getRequestedProposalCount();
  const carriedProposals = options.carryProposals || [];
  const baseRows = cloneRows(state.workingData);
  const baseGeneratedCells = cloneGeneratedCells(state.generatedCells);
  const proposals = [];
  state.generationWarnings = [];
  state.alternativeRun += 1;

  for (let index = 0; index < proposalCount; index += 1) {
    state.workingData = cloneRows(baseRows);
    state.generatedCells = cloneGeneratedCells(baseGeneratedCells);
    clearGeneratedCellsForRole(roleKey);
    state.generationSalt = state.alternativeRun * 997 + index * 131 + proposalCount * 17;
    proposals.push(buildShiftProposal(roleKey, index));
  }

  const sortedProposals = [...carriedProposals, ...proposals]
    .sort(compareProposals)
    .slice(0, 10)
    .map((proposal, index) => ({
      ...proposal,
      label: `案${index + 1}`,
    }));

  state.proposals = sortedProposals;

  if (!state.proposals.length) {
    state.workingData = cloneRows(baseRows);
    state.generatedCells = cloneGeneratedCells(baseGeneratedCells);
    state.roleWarnings[roleKey] = [];
    state.lastRoleKey = roleKey;
    setStatus(`${ROLE_LABELS[roleKey]}の案を作成できませんでした`);
    setActiveStep("create");
    renderAll();
    showToast(`${ROLE_LABELS[roleKey]}の案を作成できませんでした`, "error");
    return;
  }

  applyProposal(0);
  const active = state.proposals[0];
  const scoreText = active.optimizationScore
    ? ` / スコア ${active.optimizationScore.score}/${active.optimizationScore.max}`
    : "";
  setStatus(active.errorCount
    ? `${ROLE_LABELS[roleKey]}は要修正です（エラー${active.errorCount}件 / ${state.proposals.length}案）${scoreText}`
    : `${ROLE_LABELS[roleKey]}を${state.proposals.length}案作成しました${scoreText}`);
  setActiveStep("create");
  state.activeResultTab = "preview";
  renderAll();
  const completedLabel = options.completionLabel || `${ROLE_LABELS[roleKey]}の作成`;
  showToast(
    active.errorCount
      ? `${completedLabel}が完了しました。修正案・警告を確認してください。`
      : `${completedLabel}が完了しました。`,
    active.errorCount ? "warn" : "success",
  );
}

function buildShiftProposal(roleKey, proposalIndex) {
  const rules = parseRules(roleKey);
  const warnings = [...rules.warnings];
  const memberRows = getMemberRows(roleKey);
  let generated = 0;

  if (!memberRows.length) {
    warnings.push({
      level: "error",
      message: `${ROLE_LABELS[roleKey]}の対象メンバーが存在しません。役職列を確認してください。`,
    });
  } else {
    generated = roleKey === "leader"
      ? createLeaderShift(memberRows, rules, warnings)
      : roleKey === "staff"
        ? createStaffShift(memberRows, rules, warnings)
        : createAllShift(memberRows, rules, warnings);

    warnings.push(...runFinalChecks(roleKey, memberRows, rules));

    if (generated === 0 && !warnings.some((warning) => warning.level === "error")) {
      warnings.push({
        level: "warn",
        message: `${ROLE_LABELS[roleKey]}の空欄に追加できるセルがありませんでした。`,
      });
    }
  }

  const errorCount = warnings.filter((warning) => warning.level === "error").length;
  const warnCount = warnings.filter((warning) => warning.level !== "error").length;
  const optimizationScore = state.optimizationScores[roleKey] || {
    score: 0,
    max: Object.values(SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0),
  };
  const preferenceScore = memberRows.length ? calculatePreferenceScore(roleKey, memberRows, rules) : 0;
  const rankScore = optimizationScore.score + preferenceScore - errorCount * 1000 - warnCount * 4;

  return {
    id: `${roleKey}-${state.alternativeRun}-${proposalIndex}`,
    label: `案${proposalIndex + 1}`,
    roleKey,
    generated,
    errorCount,
    warnCount,
    preferenceScore,
    rankScore,
    displayScore: Math.max(0, Math.round(rankScore)),
    warnings: cloneWarnings(warnings),
    optimizationScore: { ...optimizationScore },
    workingData: cloneRows(state.workingData),
    generatedCells: cloneGeneratedCells(state.generatedCells),
  };
}

function createAlternativeShift() {
  if (!state.lastRoleKey) return;
  const carriedProposals = state.proposals
    .filter((proposal) => proposal.roleKey === state.lastRoleKey)
    .map(cloneProposal);
  createShift(state.lastRoleKey, {
    proposalCount: 1,
    carryProposals: carriedProposals,
    completionLabel: "別案の作成",
  });
}

function selectProposal(index) {
  if (!state.proposals[index]) return;
  applyProposal(index);
  const proposal = state.proposals[index];
  setStatus(`${ROLE_LABELS[proposal.roleKey]} ${proposal.label}を表示中（${proposal.displayScore}点）`);
  renderAll();
  showToast(`${proposal.label}に切り替えました`);
}

function applyProposal(index) {
  const proposal = state.proposals[index];
  if (!proposal) return;

  state.workingData = cloneRows(proposal.workingData);
  state.generatedCells = cloneGeneratedCells(proposal.generatedCells);
  if (proposal.roleKey === "all") {
    state.roleWarnings.leader = [];
    state.roleWarnings.staff = [];
  } else {
    state.roleWarnings.all = [];
  }
  state.roleWarnings[proposal.roleKey] = cloneWarnings(proposal.warnings);
  state.optimizationScores[proposal.roleKey] = { ...proposal.optimizationScore };
  state.lastRoleKey = proposal.roleKey;
  state.activeProposalIndex = index;
}

function compareProposals(a, b) {
  if (a.errorCount !== b.errorCount) return a.errorCount - b.errorCount;
  if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
  if (a.warnCount !== b.warnCount) return a.warnCount - b.warnCount;
  return a.id.localeCompare(b.id);
}

function getRequestedProposalCount() {
  const count = Number(els.proposalCountSelect.value);
  return [1, 3, 5, 10].includes(count) ? count : 1;
}

function createLeaderShift(memberRows, rules, warnings) {
  return runRoleOptimizationEngine("leader", memberRows, rules, warnings);
}

function createStaffShift(memberRows, rules, warnings) {
  const dualRows = memberRows.filter(isDualBusinessRow);

  if (dualRows.length < MIN_DUAL_BUSINESS_ATTENDANCE) {
    warnings.push({
      level: "error",
      message: `両事業対応（MCL/STL）のスタッフが${dualRows.length}名です。毎日${MIN_DUAL_BUSINESS_ATTENDANCE}名以上の条件を満たせません。`,
    });
  } else if (state.capabilityColIndex < 0) {
    warnings.push({
      level: "warn",
      message: "対応欄を特定できなかったため、所属列からMCL/STLを判定しています。",
    });
  }

  return runRoleOptimizationEngine("staff", memberRows, rules, warnings);
}

function createAllShift(memberRows, rules, warnings) {
  const dualRows = memberRows.filter(isDualBusinessRow);

  if (memberRows.length < MIN_DAILY_ATTENDANCE) {
    warnings.push({
      level: "error",
      message: `全体作成の対象メンバーが${memberRows.length}名です。毎日${MIN_DAILY_ATTENDANCE}名以上の条件を満たせません。`,
    });
  }

  if (dualRows.length < MIN_DUAL_BUSINESS_ATTENDANCE) {
    warnings.push({
      level: "error",
      message: `MCL/STLの対象メンバーが${dualRows.length}名です。毎日${MIN_DUAL_BUSINESS_ATTENDANCE}名以上の条件を満たせません。`,
    });
  }

  return runRoleOptimizationEngine("all", memberRows, rules, warnings);
}

function runRoleOptimizationEngine(roleKey, memberRows, rules, warnings) {
  const beforeCount = countGeneratedCellsForRole(roleKey);
  const transientWarnings = [];

  // STEP1: fixed/protected cells are represented by original nonblank cells and never edited.
  // STEP2: secure monthly public rest before assigning ordinary work.
  ensureMonthlyRestTarget(roleKey, memberRows, rules, transientWarnings);

  // STEP3: total daily attendance minimum from the Python condition set.
  if (usesDailyAttendanceRule(roleKey, memberRows)) {
    ensureDailyAttendance(roleKey, memberRows, rules, transientWarnings);
  }

  // STEP4: MCL/STL attendance and A/B ideals.
  if (usesDualBusinessRule(roleKey)) {
    ensureStaffDualBusiness(memberRows, rules, transientWarnings);
  }

  fillRemainingEditableCells(roleKey, memberRows, rules);

  // STEP5: remove B->A where generated cells can be repaired.
  optimizeBToA(roleKey, memberRows, rules);

  // STEP6: balance A/B by local scoring.
  optimizeABBalance(roleKey, memberRows, rules);

  // STEP7: repair 5+ consecutive work.
  optimizeLongConsecutiveWork(roleKey, memberRows, rules);

  // Optimization can move A/B counts, so repair Must constraints once more.
  for (let iteration = 0; iteration < 8; iteration += 1) {
    if (usesDailyAttendanceRule(roleKey, memberRows)) ensureDailyAttendance(roleKey, memberRows, rules, transientWarnings);
    if (usesDualBusinessRule(roleKey)) ensureStaffDualBusiness(memberRows, rules, transientWarnings);
    optimizeBToA(roleKey, memberRows, rules);
    optimizeLongConsecutiveWork(roleKey, memberRows, rules);
  }

  if (usesDailyAttendanceRule(roleKey, memberRows)) ensureDailyAttendance(roleKey, memberRows, rules, transientWarnings);
  if (usesDualBusinessRule(roleKey)) ensureStaffDualBusiness(memberRows, rules, transientWarnings);
  optimizeBToA(roleKey, memberRows, rules);

  // STEP8: monthly rest repair after work assignments.
  ensureMonthlyRestTarget(roleKey, memberRows, rules, transientWarnings);
  reduceMonthlyRestOverflow(roleKey, memberRows, rules);
  if (usesDailyAttendanceRule(roleKey, memberRows)) ensureDailyAttendance(roleKey, memberRows, rules, transientWarnings);
  if (usesDualBusinessRule(roleKey)) ensureStaffDualBusiness(memberRows, rules, transientWarnings);
  optimizeBToA(roleKey, memberRows, rules);
  optimizeLongConsecutiveWork(roleKey, memberRows, rules);
  reduceMonthlyRestOverflow(roleKey, memberRows, rules);
  optimizeBToA(roleKey, memberRows, rules);

  // STEP11: final score is calculated from validation state.
  state.optimizationScores[roleKey] = calculateShiftScore(roleKey, memberRows, rules);

  return countGeneratedCellsForRole(roleKey) - beforeCount;
}

function fillGeneratedCell(rowIndex, colIndex, pattern, roleKey, valueType) {
  if (!isEditableCell(rowIndex, colIndex)) return false;
  ensureCell(state.workingData, rowIndex, colIndex);
  state.workingData[rowIndex][colIndex] = pattern;
  state.generatedCells.set(cellKey(rowIndex, colIndex), {
    roleKey,
    rowIndex,
    colIndex,
    valueType,
  });
  return true;
}

function countGeneratedCellsForRole(roleKey) {
  return [...state.generatedCells.values()].filter((cell) => cell.roleKey === roleKey).length;
}

function usesDailyAttendanceRule(roleKey, memberRows) {
  return roleKey === "all" || (roleKey === "staff" && memberRows.length >= MIN_DAILY_ATTENDANCE);
}

function usesDualBusinessRule(roleKey) {
  return roleKey === "staff" || roleKey === "all";
}

function isEditableCell(rowIndex, colIndex) {
  return isBlank(state.originalData[rowIndex]?.[colIndex]);
}

function addWarningOnce(warnings, warning) {
  if (warnings.some((item) => item.level === warning.level && item.message === warning.message)) {
    return;
  }

  warnings.push(warning);
}

function ensureMonthlyRestTarget(roleKey, memberRows, rules, warnings) {
  memberRows.forEach((rowIndex) => {
    let restCount = countMonthlyRest(rowIndex, rules.restPattern);

    if (restCount > MONTHLY_REST_TARGET) {
      addWarningOnce(warnings, {
        level: "error",
        message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は公休が${restCount}日あります。既存公休を含めて月8日を超えています。`,
      });
      return;
    }

    while (restCount < MONTHLY_REST_TARGET) {
      const candidate = pickBestRestColumn(roleKey, rowIndex, memberRows, rules);

      if (!candidate) {
        addWarningOnce(warnings, {
          level: "error",
          message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は公休8日を確保できません。追加可能な空欄が不足しています。`,
        });
        return;
      }

      fillGeneratedCell(rowIndex, candidate.index, rules.restPattern, roleKey, "rest");
      restCount += 1;
    }
  });
}

function countMonthlyRest(rowIndex, restPattern = DEFAULT_REST_PATTERN) {
  return state.dateColumns.filter((dateColumn) => {
    return normalizeText(state.workingData[rowIndex]?.[dateColumn.index]).includes(restPattern);
  }).length;
}

function pickBestRestColumn(roleKey, rowIndex, memberRows, rules) {
  const candidates = state.dateColumns.filter((dateColumn) => {
    if (!isEditableCell(rowIndex, dateColumn.index)) return false;
    if (isAttendanceCell(state.workingData[rowIndex]?.[dateColumn.index]) &&
      !isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey)) return false;
    if (normalizeText(state.workingData[rowIndex]?.[dateColumn.index]) === rules.restPattern) return false;
    return canPlaceRestWithoutBreakingMust(roleKey, rowIndex, dateColumn, memberRows, rules);
  });

  if (!candidates.length) return null;

  return candidates
    .slice()
    .sort((a, b) => scoreRestCandidate(roleKey, rowIndex, a, memberRows, rules) - scoreRestCandidate(roleKey, rowIndex, b, memberRows, rules))[0];
}

function scoreRestCandidate(roleKey, rowIndex, dateColumn, memberRows, rules) {
  let score = 0;
  const weekColumns = getWeekColumns(dateColumn);
  const weekRestCount = weekColumns.filter((column) => {
    return normalizeText(state.workingData[rowIndex]?.[column.index]) === rules.restPattern;
  }).length;

  if (weekRestCount < 2) score -= 20;
  if (createsBRestA(rowIndex, dateColumn.index, "A")) score += 15;
  score += countDateRests(memberRows, dateColumn.index) * 2;
  score += getHistoryRestScore(rowIndex, dateColumn, roleKey);
  score += getFeedbackRestScore(rowIndex, dateColumn, memberRows, rules);
  score += seededNoise(rowIndex, dateColumn.index, "rest") * 7;

  return score;
}

function canPlaceRestWithoutBreakingMust(roleKey, rowIndex, dateColumn, memberRows, rules) {
  const current = state.workingData[rowIndex]?.[dateColumn.index];
  const currentIsWork = isAttendanceCell(current);

  if (usesDailyAttendanceRule(roleKey, memberRows) && currentIsWork) {
    const attendanceAfterRest = countAttendance(memberRows, dateColumn.index) - 1;
    if (attendanceAfterRest < MIN_DAILY_ATTENDANCE) return false;
  }

  if (usesDualBusinessRule(roleKey) && isDualBusinessRow(rowIndex) && currentIsWork) {
    const dualRows = memberRows.filter(isDualBusinessRow);
    const dualAttendanceAfterRest = countDualAttendance(dualRows, dateColumn.index) - 1;
    if (dualAttendanceAfterRest < MIN_DUAL_BUSINESS_ATTENDANCE) return false;
  }

  return true;
}

function ensureLeaderAllWorkDates(memberRows, rules, warnings) {
  state.dateColumns.filter(isLeaderAllWorkDate).forEach((dateColumn) => {
    memberRows.forEach((rowIndex) => {
      const value = state.workingData[rowIndex]?.[dateColumn.index];

      if (isAttendanceCell(value)) return;

      if (!isEditableCell(rowIndex, dateColumn.index)) {
        addWarningOnce(warnings, {
          level: "error",
          colIndex: dateColumn.index,
          message: `${dateColumn.label} はCS定例のため ${getMemberName(rowIndex)} を出勤にする必要がありますが、既存入力を変更できません。`,
        });
        return;
      }

      const pattern = chooseBestWorkPattern(rowIndex, dateColumn.index, rules);
      fillGeneratedCell(rowIndex, dateColumn.index, pattern, "leader", "work");
    });
  });
}

function ensureLeaderDailyAB(memberRows, rules, warnings) {
  state.dateColumns.forEach((dateColumn) => {
    ["A", "B"].forEach((pattern) => {
      let counts = countDatePatterns(memberRows, dateColumn.index);
      if (counts[pattern] >= 1) return;

      const rowIndex = pickBestWorkRow(memberRows, dateColumn.index, pattern, rules, { allowRestOverride: true });

      if (rowIndex === null) {
        if (pattern === "B" && placeCascadingB(memberRows, dateColumn, rules, "leader")) {
          return;
        }

        addWarningOnce(warnings, {
          level: "error",
          colIndex: dateColumn.index,
          message: `${dateColumn.label} はリーダー${pattern}を1名以上配置できません。`,
        });
        return;
      }

      fillGeneratedCell(rowIndex, dateColumn.index, pattern, "leader", "work");
      counts = countDatePatterns(memberRows, dateColumn.index);
    });
  });
}

function placeCascadingB(memberRows, dateColumn, rules, roleKey) {
  const dateIndex = state.dateColumns.findIndex((column) => column.index === dateColumn.index);
  if (dateIndex < 0 || dateIndex >= state.dateColumns.length - 1) return false;

  const nextColumn = state.dateColumns[dateIndex + 1];
  const rowIndex = memberRows.find((memberRow) => {
    const current = classifyShiftValue(state.workingData[memberRow]?.[dateColumn.index]);
    const next = classifyShiftValue(state.workingData[memberRow]?.[nextColumn.index]);

    return current === "A" &&
      next === "A" &&
      isGeneratedCellForRole(memberRow, dateColumn.index, roleKey) &&
      isGeneratedCellForRole(memberRow, nextColumn.index, roleKey);
  });

  if (rowIndex === undefined) return false;

  fillGeneratedCell(rowIndex, dateColumn.index, "B", roleKey, "work");
  fillGeneratedCell(rowIndex, nextColumn.index, "B", roleKey, "work");
  return true;
}

function ensureDailyAttendance(roleKey, memberRows, rules, warnings) {
  state.dateColumns.forEach((dateColumn) => {
    let attendance = countAttendance(memberRows, dateColumn.index);

    while (attendance < MIN_DAILY_ATTENDANCE) {
      const preferredPattern = chooseDailyPreferredPattern(memberRows, dateColumn.index);
      const rowIndex = pickBestWorkRow(memberRows, dateColumn.index, preferredPattern, rules, { allowRestOverride: true });

      if (rowIndex === null) {
        addWarningOnce(warnings, {
          level: "error",
          colIndex: dateColumn.index,
          message: `${dateColumn.label} は出勤${attendance}名です。最低${MIN_DAILY_ATTENDANCE}名を配置できません。`,
        });
        return;
      }

      const pattern = chooseBestWorkPattern(rowIndex, dateColumn.index, rules, { targetPattern: preferredPattern });
      fillGeneratedCell(rowIndex, dateColumn.index, pattern, roleKey, "work");
      attendance = countAttendance(memberRows, dateColumn.index);
    }
  });
}

function chooseDailyPreferredPattern(memberRows, colIndex) {
  const counts = countDatePatterns(memberRows, colIndex);
  return counts.A <= counts.B ? "A" : "B";
}

function ensureStaffDualBusiness(memberRows, rules, warnings) {
  const dualRows = memberRows.filter(isDualBusinessRow);

  state.dateColumns.forEach((dateColumn) => {
    let count = countDualAttendance(dualRows, dateColumn.index);

    while (count < MIN_DUAL_BUSINESS_ATTENDANCE) {
      const rowIndex = pickBestWorkRow(dualRows, dateColumn.index, chooseDatePreferredPattern(dateColumn), rules, { allowRestOverride: true });

      if (rowIndex === null) {
        addWarningOnce(warnings, {
          level: "error",
          colIndex: dateColumn.index,
          message: `${dateColumn.label} はMCL/STLを最低${MIN_DUAL_BUSINESS_ATTENDANCE}名配置できません。`,
        });
        break;
      }

      const pattern = chooseBestWorkPattern(rowIndex, dateColumn.index, rules);
      fillGeneratedCell(rowIndex, dateColumn.index, pattern, "staff", "work");
      count = countDualAttendance(dualRows, dateColumn.index);
    }

    ensureDualBusinessPattern(dateColumn, dualRows, rules, "A", IDEAL_DUAL_BUSINESS_A);
    ensureDualBusinessPattern(dateColumn, dualRows, rules, "B", IDEAL_DUAL_BUSINESS_B);
  });
}

function ensureDualBusinessPattern(dateColumn, dualRows, rules, pattern, targetCount) {
  let counts = countDatePatterns(dualRows, dateColumn.index);

  while (counts[pattern] < targetCount) {
    const rowIndex = pickBestWorkRow(dualRows, dateColumn.index, pattern, rules, {
      allowRestOverride: true,
      allowPatternChange: true,
      excludeCurrentPattern: true,
    });

    if (rowIndex === null) return;
    fillGeneratedCell(rowIndex, dateColumn.index, pattern, rules.roleKey, "work");
    counts = countDatePatterns(dualRows, dateColumn.index);
  }
}

function reinforceMonthStartA(roleKey, memberRows, rules) {
  state.dateColumns.filter(isMonthStart).forEach((dateColumn) => {
    const currentA = countDatePatterns(memberRows, dateColumn.index).A;
    const targetA = roleKey === "leader" ? 2 : Math.min(4, memberRows.length);
    let needed = Math.max(0, targetA - currentA);

    while (needed > 0) {
      const rowIndex = pickBestWorkRow(memberRows, dateColumn.index, "A", rules, { allowRestOverride: false });
      if (rowIndex === null) return;
      fillGeneratedCell(rowIndex, dateColumn.index, "A", roleKey, "work");
      needed -= 1;
    }
  });
}

function fillRemainingEditableCells(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    state.dateColumns.forEach((dateColumn) => {
      if (!isEditableCell(rowIndex, dateColumn.index)) return;
      if (!isBlank(state.workingData[rowIndex]?.[dateColumn.index])) return;

      const restCount = countMonthlyRest(rowIndex, rules.restPattern);
      if (restCount < MONTHLY_REST_TARGET && canPlaceRestWithoutBreakingMust(roleKey, rowIndex, dateColumn, memberRows, rules)) {
        fillGeneratedCell(rowIndex, dateColumn.index, rules.restPattern, roleKey, "rest");
        return;
      }

      const pattern = chooseBestWorkPattern(rowIndex, dateColumn.index, rules);
      fillGeneratedCell(rowIndex, dateColumn.index, pattern, roleKey, "work");
    });
  });
}

function pickBestWorkRow(rows, colIndex, targetPattern, rules, options = {}) {
  const candidates = rows.filter((rowIndex) => {
    const currentPattern = classifyShiftValue(state.workingData[rowIndex]?.[colIndex]);
    if (!isEditableCell(rowIndex, colIndex)) return false;
    if (options.excludeCurrentPattern && currentPattern === targetPattern) return false;
    if (!options.allowPatternChange && isAttendanceCell(state.workingData[rowIndex]?.[colIndex])) return false;
    if (!options.allowRestOverride && normalizeText(state.workingData[rowIndex]?.[colIndex]) === rules.restPattern) return false;
    return canPlaceWorkPattern(rowIndex, colIndex, targetPattern);
  });

  if (!candidates.length) return null;

  return candidates
    .slice()
    .sort((a, b) => scoreWorkCandidate(a, colIndex, targetPattern, rules, options) - scoreWorkCandidate(b, colIndex, targetPattern, rules, options))[0];
}

function chooseBestWorkPattern(rowIndex, colIndex, rules, options = {}) {
  const patterns = getABPatterns(rules);
  const ordered = patterns
    .filter((pattern) => canPlaceWorkPattern(rowIndex, colIndex, pattern))
    .sort((a, b) => scoreWorkCandidate(rowIndex, colIndex, a, rules, options) - scoreWorkCandidate(rowIndex, colIndex, b, rules, options));

  if (ordered.length) return ordered[0];

  const fallback = patterns.find((pattern) => !createsBToA(rowIndex, colIndex, pattern));
  return fallback || patterns[0] || "A";
}

function chooseDatePreferredPattern(dateColumn) {
  return isMonthStart(dateColumn) ? "A" : "A";
}

function scoreWorkCandidate(rowIndex, colIndex, pattern, rules, options = {}) {
  const counts = countRowPatterns(rowIndex);
  const otherPattern = pattern === "A" ? "B" : "A";
  let score = (counts[pattern] || 0) * 6 - (counts[otherPattern] || 0) * 4;

  if (options.preferA && pattern === "A") score -= 10;
  if (options.targetPattern && pattern === options.targetPattern) score -= 8;
  if (normalizeText(state.workingData[rowIndex]?.[colIndex]) === rules.restPattern) score += 18;
  if (createsBToA(rowIndex, colIndex, pattern)) score += 10000;
  if (createsLongConsecutiveWork(rowIndex, colIndex, pattern)) score += 5000;
  if (wouldCreateSixthConsecutive(rowIndex, colIndex)) score += 12;
  score += getHistoryWorkScore(rowIndex, colIndex, pattern, rules.roleKey);
  score += getFeedbackWorkScore(rowIndex, colIndex, pattern, rules.roleKey);
  score += seededNoise(rowIndex, colIndex, pattern) * 7;

  return score;
}

function getHistoryWorkScore(rowIndex, colIndex, pattern, roleKey) {
  if (!state.historyModel.totalCells) return 0;

  const dateColumn = getDateColumnByIndex(colIndex);
  const name = getMemberName(rowIndex);
  let score = 0;

  score -= patternRatio(state.historyModel.memberPattern[name], pattern) * 10;
  score -= patternRatio(state.historyModel.rolePattern[roleKey], pattern) * 7;

  if (dateColumn) {
    score -= patternRatio(state.historyModel.weekdayPattern[dateColumn.date.getDay()], pattern) * 5;
    score -= patternRatio(state.historyModel.dayPattern[dateColumn.date.getDate()], pattern) * 4;
    if (isMonthStart(dateColumn) && pattern === "A") {
      score -= patternRatio(state.historyModel.monthStart, "A") * 8;
    }
  }

  return score;
}

function getHistoryRestScore(rowIndex, dateColumn, roleKey) {
  if (!state.historyModel.totalCells) return 0;

  const name = getMemberName(rowIndex);
  let score = 0;

  score -= patternRatio(state.historyModel.memberPattern[name], "rest") * 9;
  score -= patternRatio(state.historyModel.rolePattern[roleKey], "rest") * 5;
  score -= patternRatio(state.historyModel.weekdayPattern[dateColumn.date.getDay()], "rest") * 6;
  score -= patternRatio(state.historyModel.dayPattern[dateColumn.date.getDate()], "rest") * 4;

  return score;
}

function getFeedbackWorkScore(rowIndex, colIndex, pattern, roleKey) {
  const feedback = getFeedbackText();
  if (!feedback) return 0;

  let score = 0;

  if (mentionsAHeavy(feedback) && pattern === "A") score += 16;
  if (mentionsBHeavy(feedback) && pattern === "B") score += 16;
  if (mentionsAHeavy(feedback) && pattern === "B") score -= 5;
  if (mentionsBHeavy(feedback) && pattern === "A") score -= 5;
  if (/連勤|続き|続いて/.test(feedback) && wouldCreateSixthConsecutive(rowIndex, colIndex)) score += 24;
  if (/リーダー/.test(feedback) && roleKey === "leader") score += seededNoise(rowIndex, colIndex, `leader-${pattern}`) * 5;

  return score;
}

function getFeedbackRestScore(rowIndex, dateColumn, memberRows, rules) {
  const feedback = getFeedbackText();
  if (!feedback) return 0;

  let score = 0;

  if (/公休|休み|休日/.test(feedback) && /偏|固ま|集中|多/.test(feedback)) {
    const weekRestCount = getWeekColumns(dateColumn).filter((column) => {
      return normalizeText(state.workingData[rowIndex]?.[column.index]) === rules.restPattern;
    }).length;
    score += weekRestCount >= 2 ? 18 : -8;
    score += countDateRests(memberRows, dateColumn.index) * 3;
  }

  return score;
}

function getFeedbackText() {
  return normalizeText(els.feedbackInput.value);
}

function mentionsAHeavy(feedback) {
  return /Aが多|A多|Ａが多|Ａ多|早番.*多/.test(feedback);
}

function mentionsBHeavy(feedback) {
  return /Bが多|B多|Ｂが多|Ｂ多|遅番.*多/.test(feedback);
}

function patternRatio(bucket, pattern) {
  if (!bucket) return 0;
  const total = (bucket.A || 0) + (bucket.B || 0) + (bucket.rest || 0);
  if (!total) return 0;
  return (bucket[pattern] || 0) / total;
}

function getDateColumnByIndex(colIndex) {
  return state.dateColumns.find((dateColumn) => dateColumn.index === colIndex) || null;
}

function seededNoise(rowIndex, colIndex, token) {
  const text = `${rowIndex}:${colIndex}:${token}:${state.generationSalt}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000 - 0.5;
}

function canPlaceWorkPattern(rowIndex, colIndex, pattern) {
  if (!isEditableCell(rowIndex, colIndex)) return false;
  if (createsBToA(rowIndex, colIndex, pattern)) return false;
  if (createsLongConsecutiveWork(rowIndex, colIndex, pattern)) return false;
  return true;
}

function countDualAttendance(dualRows, colIndex) {
  return dualRows.filter((rowIndex) => isAttendanceCell(state.workingData[rowIndex]?.[colIndex])).length;
}

function countAttendance(rows, colIndex) {
  return rows.filter((rowIndex) => isAttendanceCell(state.workingData[rowIndex]?.[colIndex])).length;
}

function getBlankRows(rows, colIndex) {
  return rows.filter((rowIndex) => isBlank(state.workingData[rowIndex]?.[colIndex]));
}

function sortRowsForAssignment(rows, targetPattern, colIndex) {
  return rows.slice().sort((a, b) => {
    const aScore = scoreRowForAssignment(a, targetPattern, colIndex);
    const bScore = scoreRowForAssignment(b, targetPattern, colIndex);
    if (aScore !== bScore) return aScore - bScore;
    return a - b;
  });
}

function pickBestRow(rows, targetPattern, colIndex) {
  if (!rows.length) return null;
  return sortRowsForAssignment(rows, targetPattern, colIndex)[0];
}

function scoreRowForAssignment(rowIndex, targetPattern, colIndex) {
  const counts = countRowPatterns(rowIndex);
  const targetCount = counts[targetPattern] || 0;
  const otherPattern = targetPattern === "A" ? "B" : "A";
  const otherCount = counts[otherPattern] || 0;
  let score = targetCount * 3 - otherCount;

  if (createsBRestA(rowIndex, colIndex, targetPattern)) score += 20;
  if (wouldCreateSixthConsecutive(rowIndex, colIndex)) score += 8;

  return score;
}

function chooseBalancedPattern(rowIndex, colIndex, rules, options = {}) {
  const patterns = getABPatterns(rules);

  if (options.preferA && patterns.includes("A")) {
    return "A";
  }

  return patterns
    .slice()
    .sort((a, b) => scoreRowForAssignment(rowIndex, a, colIndex) - scoreRowForAssignment(rowIndex, b, colIndex))[0];
}

function getABPatterns(rules) {
  const patterns = rules.workPatterns.filter((pattern) => pattern === "A" || pattern === "B");

  if (patterns.includes("A") && patterns.includes("B")) {
    return ["A", "B"];
  }

  return DEFAULT_WORK_PATTERNS;
}

function countRowPatterns(rowIndex) {
  return state.dateColumns.reduce(
    (counts, dateColumn) => {
      const value = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);
      if (value === "A") counts.A += 1;
      if (value === "B") counts.B += 1;
      return counts;
    },
    { A: 0, B: 0 },
  );
}

function countDatePatterns(rows, colIndex) {
  return rows.reduce(
    (counts, rowIndex) => {
      const value = classifyShiftValue(state.workingData[rowIndex]?.[colIndex]);
      if (value === "A") counts.A += 1;
      if (value === "B") counts.B += 1;
      if (value === "A" || value === "B" || value === "work") counts.attendance += 1;
      return counts;
    },
    { A: 0, B: 0, attendance: 0 },
  );
}

function isLeaderAllWorkDate(dateColumn) {
  return LEADER_ALL_WORK_DATES.some((target) => {
    return dateColumn.date.getMonth() + 1 === target.month && dateColumn.date.getDate() === target.day;
  });
}

function isMonthStart(dateColumn) {
  return dateColumn.date.getDate() === 1;
}

function isDualBusinessRow(rowIndex) {
  const colIndex = state.capabilityColIndex >= 0 ? state.capabilityColIndex : state.affiliationColIndex;
  const value = normalizeText(state.workingData[rowIndex]?.[colIndex]);
  return DUAL_BUSINESS_PATTERN.test(value);
}

function runFinalChecks(roleKey, memberRows, rules) {
  const warnings = [];

  warnings.push(...checkOverwriteViolations(roleKey, memberRows));
  warnings.push(...checkMonthlyRest(roleKey, memberRows, rules.restPattern));
  warnings.push(...checkBToAViolations(roleKey, memberRows));

  if (usesDailyAttendanceRule(roleKey, memberRows)) {
    warnings.push(...checkDailyAttendanceRules(roleKey, memberRows));
  }

  if (usesDualBusinessRule(roleKey)) {
    warnings.push(...checkStaffDualBusinessRules(memberRows));
  }

  warnings.push(...checkMemberBalance(roleKey, memberRows));
  warnings.push(...checkDailyABBalance(roleKey, memberRows));
  warnings.push(...checkConsecutiveWork(roleKey, memberRows));
  warnings.push(...checkConsecutiveOff(roleKey, memberRows));
  warnings.push(...checkBRestA(roleKey, memberRows, rules.restPattern));
  warnings.push(...checkMonthBoundarySwitch(roleKey, memberRows));

  return warnings;
}

function checkLeaderDailyRules(memberRows) {
  const warnings = [];

  state.dateColumns.forEach((dateColumn) => {
    const counts = countDatePatterns(memberRows, dateColumn.index);

    if (counts.A < 1) {
      warnings.push({
        level: "error",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} はリーダーAが1名未満です。`,
      });
    }

    if (counts.B < 1) {
      warnings.push({
        level: "error",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} はリーダーBが1名未満です。`,
      });
    }

    if (isLeaderAllWorkDate(dateColumn)) {
      const offRows = memberRows.filter((rowIndex) => !isAttendanceCell(state.workingData[rowIndex]?.[dateColumn.index]));
      if (offRows.length) {
        warnings.push({
          level: "error",
          colIndex: dateColumn.index,
          message: `${dateColumn.label} はCS定例のためリーダー全員出勤ですが、${offRows.map(getMemberName).join("、")} が出勤扱いではありません。`,
        });
      }
    }
  });

  return warnings;
}

function checkStaffDualBusinessRules(memberRows) {
  const warnings = [];
  const dualRows = memberRows.filter(isDualBusinessRow);

  state.dateColumns.forEach((dateColumn) => {
    const count = countDualAttendance(dualRows, dateColumn.index);
    const counts = countDatePatterns(dualRows, dateColumn.index);

    if (count < MIN_DUAL_BUSINESS_ATTENDANCE) {
      warnings.push({
        level: "error",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} はMCL/STLが${count}名です。最低${MIN_DUAL_BUSINESS_ATTENDANCE}名必要です。`,
      });
    } else if (counts.A < IDEAL_DUAL_BUSINESS_A || counts.B < IDEAL_DUAL_BUSINESS_B) {
      warnings.push({
        level: "warn",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} はMCL/STLがA:${counts.A}、B:${counts.B}です。理想はA${IDEAL_DUAL_BUSINESS_A}名・B${IDEAL_DUAL_BUSINESS_B}名です。`,
      });
    }
  });

  return warnings;
}

function checkDailyAttendanceRules(roleKey, memberRows) {
  const warnings = [];

  state.dateColumns.forEach((dateColumn) => {
    const attendance = countAttendance(memberRows, dateColumn.index);

    if (attendance < MIN_DAILY_ATTENDANCE) {
      warnings.push({
        level: "error",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} は${ROLE_LABELS[roleKey]}の出勤が${attendance}名です。最低${MIN_DAILY_ATTENDANCE}名必要です。`,
      });
    } else if (attendance > MAX_DAILY_ATTENDANCE_SOFT) {
      warnings.push({
        level: "warn",
        colIndex: dateColumn.index,
        message: `${dateColumn.label} は${ROLE_LABELS[roleKey]}の出勤が${attendance}名です。目安は${MAX_DAILY_ATTENDANCE_SOFT}名以内です。`,
      });
    }
  });

  return warnings;
}

function checkDailyABBalance(roleKey, memberRows) {
  const warnings = [];

  state.dateColumns.forEach((dateColumn) => {
    const counts = countDatePatterns(memberRows, dateColumn.index);
    const diff = Math.abs(counts.A - counts.B);
    if (counts.A + counts.B < 2 || diff <= 3) return;

    warnings.push({
      level: "warn",
      colIndex: dateColumn.index,
      message: `${dateColumn.label} は${ROLE_LABELS[roleKey]}のA/B日別バランスに偏りがあります（A:${counts.A}、B:${counts.B}）。`,
    });
  });

  return warnings;
}

function checkMemberBalance(roleKey, memberRows) {
  return memberRows.flatMap((rowIndex) => {
    const counts = countRowPatterns(rowIndex);
    const diff = Math.abs(counts.A - counts.B);

    if (counts.A + counts.B < 4 || diff <= 3) return [];

    const weeklyText = buildWeeklyBalanceText(rowIndex);

    return [{
      level: "warn",
      message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は${weeklyText}にA/Bの偏りがあります（月間 A:${counts.A}、B:${counts.B}）。`,
    }];
  });
}

function buildWeeklyBalanceText(rowIndex) {
  const weeks = groupDateColumnsByWeek();
  const details = weeks
    .map((weekColumns) => {
      const counts = countRowPatternsInColumns(rowIndex, weekColumns);
      return {
        label: formatWeekLabel(weekColumns),
        counts,
        diff: Math.abs(counts.A - counts.B),
        workCount: counts.A + counts.B,
      };
    })
    .filter((detail) => detail.workCount > 0)
    .sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.workCount - a.workCount;
    });

  const imbalanced = details.filter((detail) => detail.workCount >= 2 && detail.diff >= 2);
  const picked = (imbalanced.length ? imbalanced : details).slice(0, 3);

  if (!picked.length) return "月間";

  const suffix = imbalanced.length > picked.length
    ? ` ほか${imbalanced.length - picked.length}週`
    : "";

  return picked
    .map((detail) => `${detail.label} A:${detail.counts.A}、B:${detail.counts.B}`)
    .join(" / ") + suffix;
}

function countRowPatternsInColumns(rowIndex, dateColumns) {
  return dateColumns.reduce(
    (counts, dateColumn) => {
      const value = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);
      if (value === "A") counts.A += 1;
      if (value === "B") counts.B += 1;
      return counts;
    },
    { A: 0, B: 0 },
  );
}

function formatWeekLabel(weekColumns) {
  const firstDate = weekColumns[0]?.date;
  if (!firstDate) return "対象週";
  return `${firstDate.getMonth() + 1}/${firstDate.getDate()}週`;
}

function checkWeeklyRest(roleKey, memberRows, restPattern) {
  const warnings = [];
  const weeks = groupDateColumnsByWeek();

  memberRows.forEach((rowIndex) => {
    weeks.forEach((weekColumns) => {
      if (weekColumns.length < 5) return;

      const restCount = weekColumns.filter((dateColumn) => {
        return normalizeText(state.workingData[rowIndex]?.[dateColumn.index]) === restPattern;
      }).length;

      if (restCount < 2) {
        warnings.push({
          level: "warn",
          colIndex: weekColumns[0].index,
          message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は ${weekColumns[0].label} 週の公休が${restCount}日です。できれば週2日にしてください。`,
        });
      }
    });
  });

  return warnings;
}

function checkConsecutiveWork(roleKey, memberRows) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    let streak = [];

    state.dateColumns.forEach((dateColumn) => {
      const value = state.workingData[rowIndex]?.[dateColumn.index];

      if (isAttendanceCell(value)) {
        streak.push(dateColumn);
        return;
      }

      if (streak.length > MAX_CONSECUTIVE_WORK) {
        warnings.push(buildConsecutiveWarning(roleKey, rowIndex, streak));
      }
      streak = [];
    });

    if (streak.length > MAX_CONSECUTIVE_WORK) {
      warnings.push(buildConsecutiveWarning(roleKey, rowIndex, streak));
    }
  });

  return warnings;
}

function buildConsecutiveWarning(roleKey, rowIndex, streak) {
  return {
    level: "error",
    colIndex: streak[0].index,
    message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は${streak[0].label}から${streak.length}連勤です。${MAX_CONSECUTIVE_WORK}連勤以内にしてください。`,
  };
}

function hasSameShiftWindow(values, pattern, size) {
  let streak = 0;

  for (const value of values) {
    if (value === pattern) {
      streak += 1;
      if (streak >= size) return true;
    } else {
      streak = 0;
    }
  }

  return false;
}

function checkConsecutiveOff(roleKey, memberRows) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    let streak = [];

    state.dateColumns.forEach((dateColumn) => {
      const value = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);

      if (value === "off") {
        streak.push(dateColumn);
        return;
      }

      if (streak.length > MAX_CONSECUTIVE_OFF_SOFT) {
        warnings.push(buildConsecutiveOffWarning(roleKey, rowIndex, streak));
      }
      streak = [];
    });

    if (streak.length > MAX_CONSECUTIVE_OFF_SOFT) {
      warnings.push(buildConsecutiveOffWarning(roleKey, rowIndex, streak));
    }
  });

  return warnings;
}

function buildConsecutiveOffWarning(roleKey, rowIndex, streak) {
  return {
    level: "warn",
    colIndex: streak[0].index,
    message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は${streak[0].label}から休みが${streak.length}日連続しています。目安は${MAX_CONSECUTIVE_OFF_SOFT}日以内です。`,
  };
}

function checkMonthlyRest(roleKey, memberRows, restPattern) {
  return memberRows.flatMap((rowIndex) => {
    const restCount = countMonthlyRest(rowIndex, restPattern);
    if (restCount === MONTHLY_REST_TARGET) return [];

    return [{
      level: "error",
      message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} の公休は${restCount}日です。月間${MONTHLY_REST_TARGET}日にしてください。`,
    }];
  });
}

function checkBToAViolations(roleKey, memberRows) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    for (let index = 1; index < state.dateColumns.length; index += 1) {
      const previousColumn = state.dateColumns[index - 1];
      const currentColumn = state.dateColumns[index];
      const previous = classifyShiftValue(state.workingData[rowIndex]?.[previousColumn.index]);
      const current = classifyShiftValue(state.workingData[rowIndex]?.[currentColumn.index]);

      if (previous === "B" && current === "A") {
        warnings.push({
          level: "error",
          colIndex: currentColumn.index,
          message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は${previousColumn.label}→${currentColumn.label}でB→A違反です。`,
        });
      }
    }
  });

  return warnings;
}

function checkOverwriteViolations(roleKey, memberRows) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    state.dateColumns.forEach((dateColumn) => {
      const original = state.originalData[rowIndex]?.[dateColumn.index];
      if (isBlank(original)) return;

      const current = state.workingData[rowIndex]?.[dateColumn.index];
      if (normalizeText(original) !== normalizeText(current)) {
        warnings.push({
          level: "error",
          colIndex: dateColumn.index,
          message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} の${dateColumn.label}で既存入力セルが変更されています。`,
        });
      }
    });
  });

  return warnings;
}

function checkBRestA(roleKey, memberRows, restPattern) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    let count = 0;

    for (let index = 1; index < state.dateColumns.length - 1; index += 1) {
      const previous = normalizeText(state.workingData[rowIndex]?.[state.dateColumns[index - 1].index]);
      const current = normalizeText(state.workingData[rowIndex]?.[state.dateColumns[index].index]);
      const next = normalizeText(state.workingData[rowIndex]?.[state.dateColumns[index + 1].index]);

      if (classifyShiftValue(previous) === "B" && classifyShiftValue(current) === "off" && classifyShiftValue(next) === "A") {
        count += 1;
      }
    }

    if (count > 0) {
      warnings.push({
        level: "warn",
        message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} にB⇒休み⇒Aが${count}回あります。目安は3回以内です。`,
      });
    }
  });

  return warnings;
}

function checkMonthBoundarySwitch(roleKey, memberRows) {
  const warnings = [];

  memberRows.forEach((rowIndex) => {
    for (let index = 1; index < state.dateColumns.length; index += 1) {
      const previousColumn = state.dateColumns[index - 1];
      const currentColumn = state.dateColumns[index];

      if (previousColumn.date.getMonth() === currentColumn.date.getMonth()) continue;

      const previous = classifyShiftValue(state.workingData[rowIndex]?.[previousColumn.index]);
      const current = classifyShiftValue(state.workingData[rowIndex]?.[currentColumn.index]);

      if (previous === "B" && current === "A") {
        warnings.push({
          level: "warn",
          colIndex: currentColumn.index,
          message: `${ROLE_LABELS[roleKey]} ${getMemberName(rowIndex)} は月跨ぎでB→Aになっています。`,
        });
      }
    }
  });

  return warnings;
}

function groupDateColumnsByWeek() {
  const weeks = new Map();

  state.dateColumns.forEach((dateColumn) => {
    const date = dateColumn.date;
    const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);

    if (!weeks.has(key)) {
      weeks.set(key, []);
    }

    weeks.get(key).push(dateColumn);
  });

  return [...weeks.values()];
}

function createsBRestA(rowIndex, colIndex, pattern) {
  if (pattern !== "A") return false;

  const dateIndex = state.dateColumns.findIndex((dateColumn) => dateColumn.index === colIndex);
  if (dateIndex < 2) return false;

  const twoDaysAgo = classifyShiftValue(state.workingData[rowIndex]?.[state.dateColumns[dateIndex - 2].index]);
  const yesterday = classifyShiftValue(state.workingData[rowIndex]?.[state.dateColumns[dateIndex - 1].index]);

  return twoDaysAgo === "B" && yesterday === "off";
}

function wouldCreateSixthConsecutive(rowIndex, colIndex) {
  const dateIndex = state.dateColumns.findIndex((dateColumn) => dateColumn.index === colIndex);
  if (dateIndex < 0) return false;

  let previousWorkDays = 0;
  for (let index = dateIndex - 1; index >= 0; index -= 1) {
    const value = state.workingData[rowIndex]?.[state.dateColumns[index].index];
    if (!isAttendanceCell(value)) break;
    previousWorkDays += 1;
  }

  return previousWorkDays >= MAX_CONSECUTIVE_WORK;
}

function removeFromArray(rows, rowIndex) {
  const index = rows.indexOf(rowIndex);
  if (index >= 0) {
    rows.splice(index, 1);
  }
}

function optimizeBToA(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    for (let index = 1; index < state.dateColumns.length; index += 1) {
      const previousColumn = state.dateColumns[index - 1];
      const currentColumn = state.dateColumns[index];
      const previous = classifyShiftValue(state.workingData[rowIndex]?.[previousColumn.index]);
      const current = classifyShiftValue(state.workingData[rowIndex]?.[currentColumn.index]);

      if (previous !== "B" || current !== "A") continue;

      if (isGeneratedCellForRole(rowIndex, currentColumn.index, roleKey)) {
        fillGeneratedCell(rowIndex, currentColumn.index, "B", roleKey, "work");
        continue;
      }

      if (isGeneratedCellForRole(rowIndex, previousColumn.index, roleKey) && !createsBToA(rowIndex, previousColumn.index, "A")) {
        fillGeneratedCell(rowIndex, previousColumn.index, "A", roleKey, "work");
      }
    }
  });
}

function optimizeABBalance(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const counts = countRowPatterns(rowIndex);
      const diff = counts.A - counts.B;
      if (Math.abs(diff) <= 1) return;

      const fromPattern = diff > 1 ? "A" : "B";
      const toPattern = diff > 1 ? "B" : "A";
      const candidate = state.dateColumns.find((dateColumn) => {
        const value = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);
        return value === fromPattern &&
          isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey) &&
          canPlaceWorkPattern(rowIndex, dateColumn.index, toPattern) &&
          keepsDailyMustAfterChange(roleKey, rowIndex, dateColumn.index, fromPattern, toPattern);
      });

      if (!candidate) return;
      fillGeneratedCell(rowIndex, candidate.index, toPattern, roleKey, "work");
    }
  });
}

function optimizeFiveConsecutiveSameShift(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    ["A", "B"].forEach((pattern) => {
      const opposite = pattern === "A" ? "B" : "A";

      getSameShiftRuns(rowIndex, pattern).forEach((run) => {
        if (run.length < 5) return;

        const shiftCandidate = run.find((dateColumn) => {
          return isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey) &&
            canPlaceWorkPattern(rowIndex, dateColumn.index, opposite) &&
            keepsDailyMustAfterChange(roleKey, rowIndex, dateColumn.index, pattern, opposite);
        });

        if (shiftCandidate) {
          fillGeneratedCell(rowIndex, shiftCandidate.index, opposite, roleKey, "work");
          return;
        }

        const restCandidate = run.find((dateColumn, index) => {
          return index >= 3 &&
            isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey) &&
            canPlaceRestForConsecutiveRepair(roleKey, rowIndex, dateColumn, memberRows);
        });

        if (restCandidate) {
          fillGeneratedCell(rowIndex, restCandidate.index, rules.restPattern, roleKey, "rest");
          restoreRestTargetAfterInsertedRest(roleKey, rowIndex, rules, restCandidate.index);
        }
      });
    });
  });
}

function optimizeLongConsecutiveWork(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const run = getWorkRuns(rowIndex).find((item) => item.length > MAX_CONSECUTIVE_WORK);
      if (!run) return;

      const restCandidate = run.find((dateColumn, index) => {
        return index >= MAX_CONSECUTIVE_WORK - 1 &&
          isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey) &&
          canPlaceRestForConsecutiveRepair(roleKey, rowIndex, dateColumn, memberRows);
      });

      if (restCandidate) {
        fillGeneratedCell(rowIndex, restCandidate.index, rules.restPattern, roleKey, "rest");
        restoreRestTargetAfterInsertedRest(roleKey, rowIndex, rules, restCandidate.index);
        continue;
      }

      const shiftCandidate = run.find((dateColumn) => {
        const current = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);
        const opposite = current === "A" ? "B" : "A";
        return (current === "A" || current === "B") &&
          isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey) &&
          canPlaceWorkPattern(rowIndex, dateColumn.index, opposite) &&
          keepsDailyMustAfterChange(roleKey, rowIndex, dateColumn.index, current, opposite);
      });

      if (!shiftCandidate) return;

      const current = classifyShiftValue(state.workingData[rowIndex]?.[shiftCandidate.index]);
      fillGeneratedCell(rowIndex, shiftCandidate.index, current === "A" ? "B" : "A", roleKey, "work");
    }
  });
}

function canPlaceRestForConsecutiveRepair(roleKey, rowIndex, dateColumn, memberRows) {
  if (usesDailyAttendanceRule(roleKey, memberRows) && isAttendanceCell(state.workingData[rowIndex]?.[dateColumn.index])) {
    if (countAttendance(memberRows, dateColumn.index) - 1 < MIN_DAILY_ATTENDANCE) return false;
  }

  if (usesDualBusinessRule(roleKey) && isDualBusinessRow(rowIndex)) {
    const dualRows = memberRows.filter(isDualBusinessRow);
    const countAfterRest = dualRows.filter((memberRow) => {
      if (memberRow === rowIndex) return false;
      return isAttendanceCell(state.workingData[memberRow]?.[dateColumn.index]);
    }).length;

    return countAfterRest >= MIN_DUAL_BUSINESS_ATTENDANCE;
  }

  return true;
}

function restoreRestTargetAfterInsertedRest(roleKey, rowIndex, rules, excludedColIndex) {
  while (countMonthlyRest(rowIndex, rules.restPattern) > MONTHLY_REST_TARGET) {
    const candidate = state.dateColumns.find((dateColumn) => {
      if (dateColumn.index === excludedColIndex) return false;
      if (!isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey)) return false;
      if (normalizeText(state.workingData[rowIndex]?.[dateColumn.index]) !== rules.restPattern) return false;
      return getABPatterns(rules).some((pattern) => canPlaceWorkPattern(rowIndex, dateColumn.index, pattern));
    });

    if (!candidate) return;

    const pattern = chooseBestWorkPattern(rowIndex, candidate.index, rules);
    fillGeneratedCell(rowIndex, candidate.index, pattern, roleKey, "work");
  }
}

function reduceMonthlyRestOverflow(roleKey, memberRows, rules) {
  memberRows.forEach((rowIndex) => {
    for (let iteration = 0; iteration < 12 && countMonthlyRest(rowIndex, rules.restPattern) > MONTHLY_REST_TARGET; iteration += 1) {
      const candidate = pickRestOverflowWorkCandidate(roleKey, rowIndex, rules);
      if (!candidate) return;
      fillGeneratedCell(rowIndex, candidate.dateColumn.index, candidate.pattern, roleKey, "work");
    }
  });
}

function pickRestOverflowWorkCandidate(roleKey, rowIndex, rules) {
  const candidates = [];

  state.dateColumns.forEach((dateColumn) => {
    if (!isGeneratedCellForRole(rowIndex, dateColumn.index, roleKey)) return;
    if (!normalizeText(state.workingData[rowIndex]?.[dateColumn.index]).includes(rules.restPattern)) return;

    getABPatterns(rules).forEach((pattern) => {
      if (createsBToA(rowIndex, dateColumn.index, pattern)) return;
      candidates.push({
        dateColumn,
        pattern,
        hardOk: !createsLongConsecutiveWork(rowIndex, dateColumn.index, pattern),
        score: scoreWorkCandidate(rowIndex, dateColumn.index, pattern, rules),
      });
    });
  });

  if (!candidates.length) return null;

  return candidates
    .sort((a, b) => {
      if (a.hardOk !== b.hardOk) return a.hardOk ? -1 : 1;
      return a.score - b.score;
    })[0];
}

function optimizeWeeklyRest(roleKey, memberRows, rules) {
  const weeks = groupDateColumnsByWeek();

  memberRows.forEach((rowIndex) => {
    weeks.forEach((weekColumns) => {
      const restCount = weekColumns.filter((dateColumn) => {
        return normalizeText(state.workingData[rowIndex]?.[dateColumn.index]) === rules.restPattern;
      }).length;

      if (restCount >= 2 || countMonthlyRest(rowIndex, rules.restPattern) >= MONTHLY_REST_TARGET) return;

      const candidate = weekColumns.find((dateColumn) => {
        return isEditableCell(rowIndex, dateColumn.index) &&
          isBlank(state.workingData[rowIndex]?.[dateColumn.index]) &&
          canPlaceRestWithoutBreakingMust(roleKey, rowIndex, dateColumn, memberRows, rules);
      });

      if (candidate) {
        fillGeneratedCell(rowIndex, candidate.index, rules.restPattern, roleKey, "rest");
      }
    });
  });
}

function keepsDailyMustAfterChange(roleKey, rowIndex, colIndex, fromPattern, toPattern) {
  const rows = getMemberRows(roleKey);

  if (usesDualBusinessRule(roleKey) && isDualBusinessRow(rowIndex)) {
    const dualRows = rows.filter(isDualBusinessRow);
    return countDualAttendance(dualRows, colIndex) >= MIN_DUAL_BUSINESS_ATTENDANCE;
  }

  return true;
}

function isGeneratedCellForRole(rowIndex, colIndex, roleKey) {
  const generated = state.generatedCells.get(cellKey(rowIndex, colIndex));
  return generated?.roleKey === roleKey;
}

function createsBToA(rowIndex, colIndex, pattern) {
  const dateIndex = state.dateColumns.findIndex((dateColumn) => dateColumn.index === colIndex);
  if (dateIndex < 0) return false;

  const previous = dateIndex > 0
    ? classifyShiftValue(state.workingData[rowIndex]?.[state.dateColumns[dateIndex - 1].index])
    : "";
  const next = dateIndex < state.dateColumns.length - 1
    ? classifyShiftValue(state.workingData[rowIndex]?.[state.dateColumns[dateIndex + 1].index])
    : "";

  return (previous === "B" && pattern === "A") || (pattern === "B" && next === "A");
}

function createsLongConsecutiveWork(rowIndex, colIndex, pattern) {
  const values = state.dateColumns.map((dateColumn) => {
    if (dateColumn.index === colIndex) return pattern;
    return state.workingData[rowIndex]?.[dateColumn.index];
  });

  let streak = 0;

  for (const value of values) {
    if (isAttendanceCell(value)) {
      streak += 1;
      if (streak > MAX_CONSECUTIVE_WORK) return true;
    } else {
      streak = 0;
    }
  }

  return false;
}

function createsFiveSameShift(rowIndex, colIndex, pattern) {
  const values = state.dateColumns.map((dateColumn) => {
    if (dateColumn.index === colIndex) return pattern;
    return classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);
  });

  let streak = 0;

  for (const value of values) {
    if (value === pattern) {
      streak += 1;
      if (streak >= 5) return true;
    } else {
      streak = 0;
    }
  }

  return false;
}

function getSameShiftRuns(rowIndex, pattern) {
  const runs = [];
  let run = [];

  state.dateColumns.forEach((dateColumn) => {
    const value = classifyShiftValue(state.workingData[rowIndex]?.[dateColumn.index]);

    if (value === pattern) {
      run.push(dateColumn);
      return;
    }

    if (run.length) runs.push(run);
    run = [];
  });

  if (run.length) runs.push(run);
  return runs;
}

function getWorkRuns(rowIndex) {
  const runs = [];
  let run = [];

  state.dateColumns.forEach((dateColumn) => {
    const value = state.workingData[rowIndex]?.[dateColumn.index];

    if (isAttendanceCell(value)) {
      run.push(dateColumn);
      return;
    }

    if (run.length) runs.push(run);
    run = [];
  });

  if (run.length) runs.push(run);
  return runs;
}

function countDateRests(rows, colIndex) {
  return rows.filter((rowIndex) => normalizeText(state.workingData[rowIndex]?.[colIndex]).includes(DEFAULT_REST_PATTERN)).length;
}

function getWeekColumns(dateColumn) {
  const date = dateColumn.date;
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  const key = weekStart.toISOString().slice(0, 10);

  return state.dateColumns.filter((column) => {
    const columnStart = new Date(column.date.getFullYear(), column.date.getMonth(), column.date.getDate() - column.date.getDay());
    return columnStart.toISOString().slice(0, 10) === key;
  });
}

function calculateShiftScore(roleKey, memberRows, rules) {
  let score = 0;

  if (!usesDailyAttendanceRule(roleKey, memberRows) || checkDailyAttendanceRules(roleKey, memberRows).every((warning) => warning.level !== "error")) score += SCORE_WEIGHTS.dailyAttendance;
  if (!usesDualBusinessRule(roleKey) || checkStaffDualBusinessRules(memberRows).every((warning) => warning.level !== "error")) score += SCORE_WEIGHTS.dualBusinessMin;
  if (!usesDualBusinessRule(roleKey) || checkStaffDualBusinessRules(memberRows).length === 0) score += SCORE_WEIGHTS.dualBusinessAB;
  if (checkBToAViolations(roleKey, memberRows).length === 0) score += SCORE_WEIGHTS.noBToA;
  if (checkMonthlyRest(roleKey, memberRows, rules.restPattern).length === 0) score += SCORE_WEIGHTS.monthlyRest;
  if (checkMemberBalance(roleKey, memberRows).length === 0) score += SCORE_WEIGHTS.abBalance;
  if (checkDailyABBalance(roleKey, memberRows).length === 0) score += SCORE_WEIGHTS.dailyABBalance;
  if (checkConsecutiveWork(roleKey, memberRows).every((warning) => warning.level !== "error")) score += SCORE_WEIGHTS.noLongWorkRun;

  return {
    score,
    max: Object.values(SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0),
  };
}

function calculatePreferenceScore(roleKey, memberRows, rules) {
  let score = 0;
  const feedback = getFeedbackText();

  memberRows.forEach((rowIndex) => {
    state.dateColumns.forEach((dateColumn) => {
      const value = normalizeText(state.workingData[rowIndex]?.[dateColumn.index]);
      const historyPattern = normalizeHistoryPattern(value);
      if (!historyPattern || historyPattern === "work") return;

      const name = getMemberName(rowIndex);
      score += patternRatio(state.historyModel.memberPattern[name], historyPattern) * 4;
      score += patternRatio(state.historyModel.rolePattern[roleKey], historyPattern) * 3;
      score += patternRatio(state.historyModel.weekdayPattern[dateColumn.date.getDay()], historyPattern) * 2;

      if (isMonthStart(dateColumn) && value === "A") score += 3;
      if (mentionsAHeavy(feedback) && value === "A") score -= 2;
      if (mentionsBHeavy(feedback) && value === "B") score -= 2;
      if (/公休|休み|休日/.test(feedback) && /偏|固ま|集中|多/.test(feedback) && value === rules.restPattern) {
        score -= countDateRests(memberRows, dateColumn.index) * 0.6;
      }
    });
  });

  return Math.round(score);
}

function parseRules(roleKey) {
  const text = roleKey === "leader"
    ? els.leaderRules.value
    : roleKey === "staff"
      ? els.staffRules.value
      : `${els.leaderRules.value}\n${els.staffRules.value}`;
  const normalized = normalizeText(text);
  const settings = getBasicSettings();
  const halfDayPatterns = extractHalfDayPatterns(normalized);
  const fragments = normalized
    .split(/[\n。；;、,]+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);

  const rules = {
    roleKey,
    weekdayRequired: null,
    weekendRequired: null,
    dailyRequired: null,
    workPatterns: halfDayPatterns.length ? halfDayPatterns : settings.workPatterns,
    restPattern: settings.restPattern,
    warnings: [...settings.warnings],
  };

  if (!normalized) {
    rules.warnings.push({
      level: "warn",
      message: `${ROLE_LABELS[roleKey]}用ルールが空です。`,
    });
  }

  fragments.forEach((fragment) => {
    const required = extractRequiredNumber(fragment);
    if (required === null) return;

    if (/(土日|土曜|日曜|週末|土・日|土\/日)/.test(fragment)) {
      rules.weekendRequired = required;
      return;
    }

    if (/(平日|月.?金|月曜.*金曜)/.test(fragment)) {
      rules.weekdayRequired = required;
      return;
    }

    if (/(毎日|全日|各日|日別|配置|必要|以上)/.test(fragment)) {
      rules.dailyRequired = required;
    }
  });

  if (rules.weekdayRequired === null && rules.dailyRequired !== null) {
    rules.weekdayRequired = rules.dailyRequired;
  }

  if (rules.weekendRequired === null && rules.dailyRequired !== null) {
    rules.weekendRequired = rules.dailyRequired;
  }

  if (rules.weekdayRequired === null && rules.weekendRequired === null) {
    rules.warnings.push({
      level: "warn",
      message: `${ROLE_LABELS[roleKey]}用ルールから必要人数を読み取れませんでした。例: 平日は5名以上、土日は7名以上。`,
    });
  }

  if (!rules.workPatterns.length) {
    rules.workPatterns = DEFAULT_WORK_PATTERNS;
    rules.warnings.push({
      level: "warn",
      message: `${ROLE_LABELS[roleKey]}の勤務記号が空のため、A、Bを使用します。`,
    });
  }

  return rules;
}

function extractRequiredNumber(fragment) {
  const digitMatch = fragment.match(/(\d+)\s*(?:名|人)/) || fragment.match(/(\d+)\s*以上/);
  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  const kanjiMatch = fragment.match(/([一二三四五六七八九十]+)\s*(?:名|人|以上)/);
  if (kanjiMatch) {
    return kanjiNumberToInteger(kanjiMatch[1]);
  }

  return null;
}

function extractHalfDayPatterns(text) {
  const patterns = new Set();
  const normalized = normalizeAscii(text).replace(/[－ー−–〜～~]/g, "-");
  const rangeRegex = /(^|[^\d])(\d{1,2}:\d{2}|\d{3,4}|\d{1,2})\s*-\s*(\d{1,2}:\d{2}|\d{3,4}|\d{1,2})(?=$|[^\d])/g;
  let match;

  while ((match = rangeRegex.exec(normalized)) !== null) {
    const start = parseTimeToMinutes(match[2]);
    const end = parseTimeToMinutes(match[3]);
    const duration = end === null || start === null ? null : end - start;

    if (duration !== null && duration > 0 && duration <= 360) {
      patterns.add(`${match[2]}-${match[3]}`);
    }
  }

  return [...patterns];
}

function parseTimeToMinutes(value) {
  const text = String(value).replace(":", "").trim();

  if (!/^\d{1,4}$/.test(text)) return null;

  if (text.length <= 2) {
    return Number(text) * 60;
  }

  const hour = Number(text.slice(0, -2));
  const minute = Number(text.slice(-2));

  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function getRequiredCount(rules, dateColumn) {
  if (dateColumn.isWeekend) {
    return rules.weekendRequired ?? rules.dailyRequired ?? rules.weekdayRequired;
  }

  return rules.weekdayRequired ?? rules.dailyRequired ?? rules.weekendRequired;
}

function getBasicSettings() {
  const workPatterns = parsePatternList(els.workPatternInput.value);
  const restPattern = normalizeText(els.restPatternInput.value) || DEFAULT_REST_PATTERN;
  const warnings = [];

  if (!workPatterns.length) {
    warnings.push({
      level: "warn",
      message: "基本設定の勤務記号が空のため、A、Bを使用します。",
    });
  }

  return {
    workPatterns: workPatterns.length ? workPatterns : DEFAULT_WORK_PATTERNS,
    restPattern,
    warnings,
  };
}

function parsePatternList(value) {
  return normalizeAscii(value)
    .split(/[\s,、/／]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

function getMemberRows(roleKey) {
  if (state.roleColIndex < 0 || state.nameColIndex < 0) return [];

  const rows = [];

  for (let rowIndex = state.headerRowIndex + 1; rowIndex < state.workingData.length; rowIndex += 1) {
    const row = state.workingData[rowIndex] || [];
    const role = normalizeText(row[state.roleColIndex]);
    const name = normalizeText(row[state.nameColIndex]);

    if (name && (roleKey === "all"
      ? isRoleValue(role, "leader") || isRoleValue(role, "staff")
      : isRoleValue(role, roleKey))) {
      rows.push(rowIndex);
    }
  }

  return rows;
}

function getExcludedRows() {
  if (state.roleColIndex < 0 || state.nameColIndex < 0) return [];

  const rows = [];

  for (let rowIndex = state.headerRowIndex + 1; rowIndex < state.workingData.length; rowIndex += 1) {
    const row = state.workingData[rowIndex] || [];
    const role = normalizeText(row[state.roleColIndex]);
    const name = normalizeText(row[state.nameColIndex]);

    if (name && !isRoleValue(role, "leader") && !isRoleValue(role, "staff")) {
      rows.push(rowIndex);
    }
  }

  return rows;
}

function clearGeneratedCellsForRole(roleKey) {
  const targetRows = new Set(getMemberRows(roleKey));

  for (const [key, generated] of [...state.generatedCells.entries()]) {
    if (!targetRows.has(generated.rowIndex)) continue;
    ensureCell(state.workingData, generated.rowIndex, generated.colIndex);
    state.workingData[generated.rowIndex][generated.colIndex] =
      state.originalData[generated.rowIndex]?.[generated.colIndex] ?? "";
    state.generatedCells.delete(key);
  }
}

function countAssignments(rowIndex) {
  return state.dateColumns.reduce((count, dateColumn) => {
    return count + (isAttendanceCell(state.workingData[rowIndex]?.[dateColumn.index]) ? 1 : 0);
  }, 0);
}

async function applyGoogleSheet() {
  if (!state.googleSpreadsheetId || !Number.isInteger(state.googleSheetId)) {
    showToast("先にGoogleスプレッドシートを読み込んでください", "error");
    return;
  }
  if (!state.generatedCells.size) {
    showToast("作成結果がないため反映できません", "warn");
    return;
  }

  try {
    setStatus("作成結果を新しいタブへ反映中です");
    els.applyGoogleSheetsBtn.disabled = true;

    const accessToken = await getGoogleSheetsAccessToken();
    const duplicated = await duplicateSourceGoogleSheet(accessToken);
    await writeGeneratedCellsToGoogleSheet(
      state.googleSpreadsheetId,
      duplicated.properties.title,
      accessToken,
    );

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${state.googleSpreadsheetId}/edit#gid=${duplicated.properties.sheetId}`;
    setActiveStep("export");
    setStatus("新しいタブへ作成結果を反映しました");
    showToast("新しい作成結果タブを追加しました", "success", {
      label: "開く",
      href: sheetUrl,
    });
  } catch (error) {
    const message = error.message || "スプレッドシートへの反映に失敗しました。";
    pushRuntimeWarning("error", `スプレッドシートへの反映に失敗しました。${message}`);
    setStatus("スプレッドシートへの反映に失敗しました");
    showToast(message, "error");
  } finally {
    renderAll();
  }
}

function requestGoogleSheetsAccessToken({ prompt = "consent" } = {}) {
  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google認証を読み込めませんでした。ページを再読み込みしてください。"));
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: AUTH_CONFIG.googleClientId,
      scope: GOOGLE_SHEETS_CONFIG.scopes,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("Googleスプレッドシートへのアクセスが許可されませんでした。"));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
        });
      },
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

async function duplicateSourceGoogleSheet(accessToken) {
  const newSheetName = createAppliedSheetName();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(state.googleSpreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: state.googleSheetId,
              newSheetName,
            },
          },
        ],
      }),
    },
  );
  if (!response.ok) throw await readGoogleApiError(response, "作成結果用の新しいタブを作成できませんでした。");

  const data = await response.json();
  const properties = data.replies?.[0]?.duplicateSheet?.properties;
  if (!properties?.title || !Number.isInteger(properties.sheetId)) {
    throw new Error("作成結果用タブの情報を取得できませんでした。");
  }
  return { properties };
}

async function writeGeneratedCellsToGoogleSheet(spreadsheetId, sheetTitle, accessToken) {
  const data = [...state.generatedCells.values()]
    .sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex)
    .map((cell) => ({
      range: `${quoteSheetTitle(sheetTitle)}!${columnIndexToA1(cell.colIndex)}${cell.rowIndex + 1}`,
      values: [[formatCell(state.workingData[cell.rowIndex]?.[cell.colIndex])]],
    }));

  if (!data.length) return;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data,
      }),
    },
  );
  if (!response.ok) throw await readGoogleApiError(response, "作成したシフトを反映できませんでした。");
}

function createAppliedSheetName() {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const suffix = `_作成結果_${datePart}_${timePart}`;
  const source = String(state.sheetName || "シフト").replace(/[\\/?*[\]:]/g, "_");
  return `${source.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
}

async function readGoogleApiError(response, fallback) {
  try {
    const error = await response.json();
    return new Error(error?.error?.message || fallback);
  } catch (_) {
    return new Error(fallback);
  }
}

function renderAll() {
  const canUse = !getReadinessProblem();
  const hasData = state.workingData.length > 0;
  const leaderRows = getMemberRows("leader");
  const staffRows = getMemberRows("staff");
  const excludedRows = getExcludedRows();

  els.createLeaderBtn.disabled = !canUse;
  els.createStaffBtn.disabled = !canUse;
  els.createAllBtn.disabled = !canUse;
  els.createAlternativeBtn.disabled = !canUse || !state.lastRoleKey;
  els.applyGoogleSheetsBtn.disabled = !hasData || !state.googleSpreadsheetId || !state.generatedCells.size;
  els.fileBadge.textContent = hasData ? "読込済" : "未読込";
  els.generatedBadge.textContent = `${state.generatedCells.size}件`;
  els.leaderCount.textContent = String(leaderRows.length);
  els.staffCount.textContent = String(staffRows.length);
  els.excludedCount.textContent = String(excludedRows.length);
  els.generatedCount.textContent = String(state.generatedCells.size);

  renderSettingSummary();
  renderImportMeta();
  renderHistoryMeta();
  renderRuleImportMeta();
  renderAccessSettings();
  renderProposals();
  renderAlerts();
  renderResultTabs();
  renderPreview();
  refreshIcons();
}

function renderImportMeta() {
  const dateText = state.dateColumns.length
    ? `${state.dateColumns.length}列`
    : "-";
  const items = [
    ["スプレッドシート", state.googleSpreadsheetTitle || state.workbookName || "-"],
    ["シート", state.sheetName || "-"],
    ["日付列", dateText],
  ];

  els.importMeta.innerHTML = items
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join("");
}

function renderHistoryMeta() {
  const model = state.historyModel;
  const totalA = model.rolePattern.leader.A + model.rolePattern.staff.A;
  const totalB = model.rolePattern.leader.B + model.rolePattern.staff.B;
  const totalRest = model.rolePattern.leader.rest + model.rolePattern.staff.rest;
  const avoidanceTotal = model.bToAObserved + model.bToAAvoided;
  const avoidanceRate = avoidanceTotal
    ? `${Math.round((model.bToAAvoided / avoidanceTotal) * 100)}%`
    : "-";

  els.historyBadge.textContent = `${model.files}件`;
  els.historyMeta.innerHTML = [
    ["学習月", model.files ? `${model.files}件` : "-"],
    ["A/B傾向", model.totalCells ? `A:${totalA} / B:${totalB}` : "-"],
    ["公休傾向", model.totalCells ? `${totalRest}件` : "-"],
    ["B→A回避", avoidanceRate],
  ]
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join("");
}

function renderRuleImportMeta() {
  if (!els.ruleImportMeta) return;

  const conditionText = [
    `公休${MONTHLY_REST_TARGET}日`,
    `出勤${MIN_DAILY_ATTENDANCE}名`,
    `MCL/STL${MIN_DUAL_BUSINESS_ATTENDANCE}名`,
    `A${IDEAL_DUAL_BUSINESS_A}/B${IDEAL_DUAL_BUSINESS_B}`,
    `${MAX_CONSECUTIVE_WORK}連勤以内`,
  ].join(" / ");

  const items = [
    ["条件", conditionText],
    ["読込", state.ruleSourceName || "-"],
    ["反映", state.ruleImportSummary.length ? state.ruleImportSummary.join("、") : "標準条件"],
  ];

  els.ruleImportMeta.innerHTML = items
    .map(([label, value]) => `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd title="${escapeHtml(value)}">${escapeHtml(value)}</dd>
      </div>
    `)
    .join("");
}

function setResultTab(tabName) {
  state.activeResultTab = tabName === "issues" ? "issues" : "preview";
  renderResultTabs();
  refreshIcons();
}

function renderResultTabs() {
  const issueCount = getIssueCount();

  if (els.issueBadge) {
    els.issueBadge.textContent = String(issueCount);
  }

  els.resultTabButtons.forEach((button) => {
    const isActive = button.dataset.resultTab === state.activeResultTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  els.resultTabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.resultPanel === state.activeResultTab);
  });
}

function getIssueCount() {
  return getAllWarnings().filter((warning) => warning.level !== "info").length;
}

function renderProposals() {
  if (!state.proposals.length) {
    els.proposalPanel.hidden = true;
    els.proposalList.innerHTML = "";
    els.proposalSummary.textContent = "-";
    els.comparisonPanel.innerHTML = "";
    return;
  }

  const active = state.proposals[state.activeProposalIndex] || state.proposals[0];
  els.proposalPanel.hidden = false;
  els.proposalSummary.textContent =
    `${state.proposals.length}案 / 選択中: ${active.label} ${active.displayScore}点`;
  els.proposalList.innerHTML = state.proposals
    .map((proposal, index) => {
      const activeClass = index === state.activeProposalIndex ? " active" : "";
      const errorClass = proposal.errorCount ? " has-error" : "";
      const warningText = proposal.errorCount
        ? `エラー${proposal.errorCount}件`
        : proposal.warnCount
          ? `警告${proposal.warnCount}件`
          : "OK";

      return `
        <button class="proposal-card${activeClass}${errorClass}" type="button" data-proposal-index="${index}">
          <strong>${escapeHtml(proposal.label)}</strong>
          <span>${proposal.displayScore}点</span>
          <small>${escapeHtml(warningText)}</small>
        </button>
      `;
    })
    .join("");

  renderComparison(active);
}

function renderComparison(active) {
  if (state.proposals.length < 2) {
    els.comparisonPanel.innerHTML = "";
    return;
  }

  const compareIndex = state.activeProposalIndex === 0 ? 1 : 0;
  const source = state.proposals[compareIndex];
  const diffs = buildProposalDiff(source, active);
  const heading = `<strong>${escapeHtml(source.label)} → ${escapeHtml(active.label)} の差分</strong>`;

  if (!diffs.length) {
    els.comparisonPanel.innerHTML = `${heading}<div>表示範囲内の差分はありません。</div>`;
    return;
  }

  els.comparisonPanel.innerHTML = [
    heading,
    renderMemberIssueGroups(diffs.map((diff) => ({
      ...diff,
      level: "info",
      message: `${diff.date}: ${diff.before} → ${diff.after}`,
    })), "差分"),
  ].join("");
}

function buildProposalDiff(source, target) {
  if (!source || !target) return [];

  const diffs = [];
  const sourceRows = source.workingData;
  const targetRows = target.workingData;

  for (let rowIndex = state.headerRowIndex + 1; rowIndex < targetRows.length; rowIndex += 1) {
    const sourceName = sourceRows[rowIndex]?.[state.nameColIndex];
    const targetName = targetRows[rowIndex]?.[state.nameColIndex];
    const name = normalizeText(targetName) || normalizeText(sourceName) || `行${rowIndex + 1}`;
    const role = normalizeText(targetRows[rowIndex]?.[state.roleColIndex]) || normalizeText(sourceRows[rowIndex]?.[state.roleColIndex]);

    state.dateColumns.forEach((dateColumn) => {
      const before = normalizeText(sourceRows[rowIndex]?.[dateColumn.index]);
      const after = normalizeText(targetRows[rowIndex]?.[dateColumn.index]);
      if (before === after) return;
      diffs.push({
        name,
        role,
        date: dateColumn.label,
        before: before || "空欄",
        after: after || "空欄",
      });
    });
  }

  return diffs;
}

function renderSettingSummary() {
  const settings = getBasicSettings();
  const labels = [...settings.workPatterns, settings.restPattern];
  els.settingSummary.innerHTML = labels
    .map((label) => `<span>${escapeHtml(label)}</span>`)
    .join("");
}

function renderAlerts() {
  const warnings = getDisplayWarnings();

  if (!warnings.length) {
    els.alerts.innerHTML = `
      <div class="empty-issues">
        <i data-lucide="circle-check"></i>
        <strong>修正事項はありません</strong>
      </div>
    `;
    return;
  }

  els.alerts.innerHTML = renderMemberIssueGroups(warnings, "警告");
}

function renderMemberIssueGroups(items, itemLabel) {
  const groups = groupIssuesByMember(items);
  return groups.map((group) => {
    const errorCount = group.items.filter((item) => item.level === "error").length;
    const warningCount = group.items.filter((item) => item.level === "warn").length;
    const isOpen = errorCount > 0 || group.name === "全体";
    const badges = [
      errorCount ? `<span class="issue-pill error">エラー${errorCount}件</span>` : "",
      warningCount ? `<span class="issue-pill warn">警告${warningCount}件</span>` : "",
      !errorCount && !warningCount ? `<span class="issue-pill">${group.items.length}件</span>` : "",
    ].join("");

    return `
      <details class="issue-member"${isOpen ? " open" : ""}>
        <summary>
          <span class="issue-member-heading">${escapeHtml(group.role)} / ${escapeHtml(group.name)}</span>
          <span class="issue-pills">${badges}</span>
        </summary>
        <ul class="issue-list" aria-label="${escapeHtml(group.name)}の${escapeHtml(itemLabel)}">
          ${group.items.map((item) => `
            <li class="issue-line ${escapeHtml(item.level || "info")}">${escapeHtml(item.message)}</li>
          `).join("")}
        </ul>
      </details>
    `;
  }).join("");
}

function groupIssuesByMember(items) {
  const members = ["leader", "staff"].flatMap((roleKey) => getMemberRows(roleKey).map((rowIndex) => ({
    role: ROLE_LABELS[roleKey],
    name: getMemberName(rowIndex),
  }))).sort((a, b) => b.name.length - a.name.length);
  const grouped = new Map();

  items.forEach((item) => {
    const match = members.find((member) => item.name === member.name || normalizeText(item.message).includes(member.name));
    const role = normalizeText(item.role) || match?.role || inferIssueRole(item.message);
    const name = normalizeText(item.name) || match?.name || "全体";
    const key = `${role}:${name}`;
    if (!grouped.has(key)) grouped.set(key, { role, name, items: [] });
    grouped.get(key).items.push(item);
  });

  return [...grouped.values()].sort((a, b) => {
    if (a.name === "全体") return -1;
    if (b.name === "全体") return 1;
    return a.role.localeCompare(b.role, "ja") || a.name.localeCompare(b.name, "ja");
  });
}

function inferIssueRole(message) {
  const text = normalizeText(message);
  if (text.includes("リーダー")) return "リーダー";
  if (text.includes("スタッフ")) return "スタッフ";
  return "全体";
}

function getDisplayWarnings() {
  const warnings = getAllWarnings();
  const score = state.lastRoleKey ? state.optimizationScores[state.lastRoleKey] : null;

  if (!score) return warnings;

  return [
    {
      level: "info",
      message: `${ROLE_LABELS[state.lastRoleKey]} 最適化スコア: ${score.score}/${score.max}`,
    },
    ...warnings,
  ];
}

function renderPreview() {
  if (!state.workingData.length) {
    els.previewSubtext.textContent = "読み込み後にシフト表を表示します";
    els.tableFrame.innerHTML = `
      <div class="empty-state">
        <i data-lucide="table"></i>
        <strong>プレビュー待ち</strong>
      </div>
    `;
    return;
  }

  const maxColumns = getMaxColumns(state.workingData);
  const dateColumnIndexes = new Set(state.dateColumns.map((column) => column.index));
  const stickyColumnIndexes = getStickyColumnIndexes();

  els.previewSubtext.textContent = `${state.workingData.length}行 / ${maxColumns}列`;

  const rowsHtml = state.workingData
    .map((row, rowIndex) => {
      const isHeaderRow = rowIndex === state.headerRowIndex;
      const cellsHtml = Array.from({ length: maxColumns }, (_, colIndex) => {
        const value = row?.[colIndex] ?? "";
        const tag = isHeaderRow ? "th" : "td";
        const classes = getCellClasses({
          rowIndex,
          colIndex,
          value,
          isHeaderRow,
          dateColumnIndexes,
          stickyColumnIndexes,
        });
        return `<${tag} class="${classes}">${escapeHtml(formatCell(value))}</${tag}>`;
      }).join("");

      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");

  els.tableFrame.innerHTML = `
    <table class="preview-table">
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function getCellClasses(context) {
  const classes = [];

  if (context.stickyColumnIndexes.has(context.colIndex)) {
    classes.push("sticky-left");
  }

  if (context.colIndex === state.nameColIndex) {
    classes.push("name-cell");
  }

  if (context.colIndex === state.roleColIndex) {
    classes.push("role-cell", "narrow");
  }

  if (context.dateColumnIndexes.has(context.colIndex)) {
    classes.push("date-cell");
  }

  return classes.join(" ");
}

function getStickyColumnIndexes() {
  const indexes = [state.nameColIndex, state.roleColIndex, state.affiliationColIndex]
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b);

  return new Set(indexes.slice(0, 1));
}

function pushRuntimeWarning(level, message) {
  state.generationWarnings.push({ level, message });
  renderAll();
}

function getAllWarnings() {
  return [
    ...state.structureWarnings,
    ...state.roleWarnings.all,
    ...state.roleWarnings.leader,
    ...state.roleWarnings.staff,
    ...state.generationWarnings,
  ];
}

function getReadinessProblem() {
  if (!state.workingData.length) return "シフト表を読み込んでください。";
  if (state.dateColumns.length < 2) return "日付列を判定できないため作成できません。";
  if (state.roleColIndex < 0) return "役職列を判定できないため作成できません。";
  if (state.nameColIndex < 0) return "名前列を判定できないため作成できません。";
  return "";
}

function setStatus(text) {
  els.appStatus.textContent = text;
}

function showToast(message, level = "success", action = null) {
  if (!els.toastRegion) return;

  const type = ["success", "warn", "error"].includes(level) ? level : "success";
  const icon = type === "error" ? "circle-alert" : type === "warn" ? "triangle-alert" : "circle-check";
  const actionMarkup = action?.href
    ? `<a class="toast-link" href="${escapeHtml(action.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(action.label || "開く")}</a>`
    : "";

  if (toastTimer && typeof window.clearTimeout === "function") window.clearTimeout(toastTimer);
  els.toastRegion.innerHTML = `
    <div class="toast ${type}" role="status">
      <i data-lucide="${icon}"></i>
      <span>${escapeHtml(message)}</span>
      ${actionMarkup}
      <button class="toast-close" type="button" aria-label="通知を閉じる"><i data-lucide="x"></i></button>
    </div>
  `;

  const close = () => {
    if (toastTimer && typeof window.clearTimeout === "function") window.clearTimeout(toastTimer);
    els.toastRegion.innerHTML = "";
  };
  els.toastRegion.querySelector?.(".toast-close")?.addEventListener("click", close);
  if (typeof window.setTimeout === "function") {
    toastTimer = window.setTimeout(close, action?.href ? 10_000 : 5_000);
  }
  refreshIcons();
}

function setActiveStep(stepName) {
  els.steps.forEach((step) => {
    step.classList.toggle("active", step.dataset.step === stepName);
  });
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function normalizeRows(rows) {
  const maxColumns = getMaxColumns(rows);
  return rows.map((row) => {
    const next = Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
    return next;
  });
}

function cloneRows(rows) {
  return rows.map((row) => row.slice());
}

function cloneGeneratedCells(generatedCells) {
  return new Map(
    [...generatedCells.entries()].map(([key, value]) => [key, { ...value }]),
  );
}

function cloneWarnings(warnings) {
  return warnings.map((warning) => ({ ...warning }));
}

function cloneProposal(proposal) {
  return {
    ...proposal,
    warnings: cloneWarnings(proposal.warnings),
    optimizationScore: { ...proposal.optimizationScore },
    workingData: cloneRows(proposal.workingData),
    generatedCells: cloneGeneratedCells(proposal.generatedCells),
  };
}

function toDisplayRows(rows) {
  return rows.map((row) => row.map((cell) => formatCell(cell)));
}

function findHeaderIndex(row, patterns) {
  const normalizedPatterns = patterns.map(normalizeText);

  for (let index = 0; index < row.length; index += 1) {
    const value = normalizeText(row[index]);
    if (!value) continue;

    if (normalizedPatterns.some((pattern) => value === pattern || value.includes(pattern))) {
      return index;
    }
  }

  return -1;
}

function getSearchColumnLimit() {
  const firstDateIndex = state.dateColumns.length
    ? Math.min(...state.dateColumns.map((column) => column.index))
    : Math.min(getMaxColumns(state.workingData), 12);
  return Math.max(firstDateIndex, 1);
}

function getMaxColumns(rows) {
  return rows.reduce((max, row) => Math.max(max, row?.length || 0), 0);
}

function countNonBlank(row) {
  return row.reduce((count, cell) => count + (isBlank(cell) ? 0 : 1), 0);
}

function ensureCell(rows, rowIndex, colIndex) {
  if (!rows[rowIndex]) rows[rowIndex] = [];
  while (rows[rowIndex].length <= colIndex) {
    rows[rowIndex].push("");
  }
}

function isRoleValue(value, roleKey) {
  const normalized = normalizeRoleText(value);
  return ROLE_MATCHERS[roleKey]?.has(normalized) || false;
}

function isBlank(value) {
  return value === null || value === undefined || normalizeText(value) === "";
}

function isFixedCell(value) {
  const normalized = normalizeText(value);
  return isOffLikeCell(normalized);
}

function isWorkingCell(value) {
  return isAttendanceCell(value);
}

function isAttendanceCell(value) {
  const type = classifyShiftValue(value);
  return type === "A" || type === "B" || type === "work";
}

function classifyShiftValue(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (isOffLikeCell(text)) return "off";
  if (isBLikeValue(text)) return "B";
  if (isALikeValue(text)) return "A";
  return "work";
}

function isOffLikeCell(value) {
  const text = normalizeText(value);
  return FIXED_VALUES.some((fixed) => text.includes(fixed));
}

function isALikeValue(value) {
  const text = normalizeAscii(value).trim();
  return /A/i.test(text) ||
    text.includes("ア") ||
    /^(8|9|10|930)(?:\D|$)/.test(text);
}

function isBLikeValue(value) {
  const text = normalizeAscii(value).trim();
  return /B/i.test(text) ||
    text.includes("イ") ||
    /^(13|14)(?:\D|$)/.test(text);
}

function getMemberName(rowIndex) {
  return normalizeText(state.workingData[rowIndex]?.[state.nameColIndex]) || `行${rowIndex + 1}`;
}

function normalizeText(value) {
  if (value instanceof Date) return formatDate(value);
  return normalizeAscii(String(value ?? ""))
    .replace(/\u3000/g, " ")
    .trim();
}

function normalizeRoleText(value) {
  return normalizeText(value)
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeAscii(value) {
  return String(value ?? "").replace(/[！-～]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function formatCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }

  return String(value ?? "");
}

function formatDate(date) {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
}

function cellKey(rowIndex, colIndex) {
  return `${rowIndex}:${colIndex}`;
}

function kanjiNumberToInteger(value) {
  const map = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (value === "十") return 10;

  const [beforeTen, afterTen] = value.split("十");
  if (afterTen !== undefined) {
    const tens = beforeTen ? map[beforeTen] || 0 : 1;
    const ones = afterTen ? map[afterTen] || 0 : 0;
    return tens * 10 + ones;
  }

  return map[value] || null;
}

function columnIndexToA1(index) {
  let value = Number(index) + 1;
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function quoteSheetTitle(title) {
  return `'${String(title || "").replace(/'/g, "''")}'`;
}

function countReplacementCharacters(value) {
  return (value.match(/\uFFFD/g) || []).length;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
