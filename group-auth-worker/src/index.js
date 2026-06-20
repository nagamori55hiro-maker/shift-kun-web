const DIRECTORY_MEMBER_SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let googleJwksCache = null;
let directoryTokenCache = null;

export default {
  async fetch(request, env) {
    const cors = getCorsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST" || new URL(request.url).pathname !== "/check") {
      return json({ error: "Not found" }, 404, cors);
    }

    if (!isAllowedOrigin(request, env)) {
      return json({ error: "Origin is not allowed" }, 403, cors);
    }

    try {
      const body = await request.json();
      const profile = await verifyGoogleCredential(body?.credential, env);
      const groups = parseGroups(env.ALLOWED_GROUPS);
      const accessToken = await getDirectoryAccessToken(env);
      const matches = await Promise.all(groups.map((group) => hasMember(group, profile.email, accessToken)));
      const matchedGroups = groups.filter((_, index) => matches[index]);

      return json({
        allowed: matchedGroups.length > 0,
        email: profile.email,
        matchedGroups,
      }, 200, cors);
    } catch (error) {
      return json({ error: error.message || "Group access check failed" }, error.status || 500, cors);
    }
  },
};

async function verifyGoogleCredential(credential, env) {
  if (typeof credential !== "string" || credential.split(".").length !== 3) {
    throw httpError("Invalid Google credential", 401);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = credential.split(".");
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (!header.kid || header.alg !== "RS256") throw httpError("Unsupported Google credential", 401);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) throw httpError("Invalid issuer", 401);
  if (!audiences.includes(env.GOOGLE_OAUTH_CLIENT_ID)) throw httpError("Invalid audience", 401);
  if (payload.exp <= now || payload.iat > now + 300) throw httpError("Expired Google credential", 401);
  if (!payload.email || payload.email_verified !== true) throw httpError("Verified email is required", 401);

  const jwks = await getGoogleJwks();
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw httpError("Google signing key not found", 401);

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw httpError("Invalid Google credential signature", 401);

  return { email: String(payload.email).toLowerCase() };
}

async function getGoogleJwks() {
  if (googleJwksCache && googleJwksCache.expiresAt > Date.now()) return googleJwksCache.value;

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) throw httpError("Unable to load Google signing keys", 502);
  const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 300);
  const value = await response.json();
  googleJwksCache = { value, expiresAt: Date.now() + maxAge * 1000 };
  return value;
}

async function getDirectoryAccessToken(env) {
  if (directoryTokenCache && directoryTokenCache.expiresAt > Date.now()) return directoryTokenCache.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signServiceAccountJwt({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    sub: env.GOOGLE_WORKSPACE_ADMIN_EMAIL,
    scope: DIRECTORY_MEMBER_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }, env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw httpError("Unable to authorize Google Directory API", 502);

  directoryTokenCache = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(60, Number(result.expires_in || 3600) - 120) * 1000,
  };
  return directoryTokenCache.value;
}

async function signServiceAccountJwt(payload, privateKeyPem) {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function hasMember(group, email, accessToken) {
  const response = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(group)}/hasMember/${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (response.status === 404) return false;
  const result = await response.json();
  if (!response.ok) throw httpError("Unable to check Google group membership", 502);
  return result.isMember === true;
}

function parseGroups(value) {
  try {
    const groups = JSON.parse(value || "[]");
    return Array.isArray(groups) ? groups.map((group) => String(group).trim()).filter(Boolean) : [];
  } catch (_) {
    throw httpError("ALLOWED_GROUPS must be a JSON array", 500);
  }
}

function getCorsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://nagamori55hiro-maker.github.io";
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : "null",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return origin === (env.ALLOWED_ORIGIN || "https://nagamori55hiro-maker.github.io");
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pemToBytes(value) {
  const pem = String(value || "").replace(/\\n/g, "\n");
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return base64UrlToBytes(base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
