const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function deriveEncryptionKey(code) {
  const material = await sha256(`rafiq-encryption-v1:${code}`);
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function generateSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `RAFIQ-${bytesToBase64Url(bytes)}`;
}

export function normalizeSyncCode(code) {
  return String(code || "").trim().replace(/\s+/g, "");
}

export async function getSyncCredentials(code) {
  const normalized = normalizeSyncCode(code);
  if (normalized.length < 24) throw new Error("رمز المزامنة غير صالح.");
  const [spaceId, authToken] = await Promise.all([
    sha256(`rafiq-space-v1:${normalized}`),
    sha256(`rafiq-auth-v1:${normalized}`),
  ]);
  return {
    code: normalized,
    spaceId: bytesToHex(spaceId),
    authToken: bytesToHex(authToken),
  };
}

export async function encryptData(data, code) {
  const key = await deriveEncryptionKey(normalizeSyncCode(code));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptData(encrypted, code) {
  if (!encrypted || encrypted.version !== 1 || !encrypted.iv || !encrypted.ciphertext) {
    throw new Error("بيانات المزامنة غير صالحة.");
  }
  const key = await deriveEncryptionKey(normalizeSyncCode(code));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encrypted.iv) },
    key,
    base64ToBytes(encrypted.ciphertext),
  );
  return JSON.parse(decoder.decode(decrypted));
}

async function cloudRequest(code, options = {}) {
  const credentials = await getSyncCredentials(code);
  const response = await fetch(`/.netlify/functions/sync?spaceId=${credentials.spaceId}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-sync-token": credentials.authToken,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "تعذر الاتصال بخدمة المزامنة.");
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
}

export async function createCloudSpace(code, data) {
  const encrypted = await encryptData(data, code);
  return cloudRequest(code, {
    method: "POST",
    body: JSON.stringify({ encrypted }),
  });
}

export async function fetchCloudSpace(code) {
  const payload = await cloudRequest(code);
  return {
    ...payload,
    data: await decryptData(payload.encrypted, code),
  };
}

export async function saveCloudSpace(code, data, expectedVersion) {
  const encrypted = await encryptData(data, code);
  return cloudRequest(code, {
    method: "PUT",
    body: JSON.stringify({ encrypted, expectedVersion }),
  });
}

export async function deleteCloudSpace(code) {
  return cloudRequest(code, { method: "DELETE" });
}
