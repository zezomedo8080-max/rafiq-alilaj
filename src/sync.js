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

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export function normalizeAccountName(name) {
  return String(name || "").trim().replace(/\s+/g, "-").toLowerCase();
}

function validateAccount(accountName, password) {
  const normalizedName = normalizeAccountName(accountName);
  if (normalizedName.length < 3) throw new Error("اسم الحساب يجب أن يكون 3 أحرف على الأقل.");
  if (normalizedName.length > 64) throw new Error("اسم الحساب طويل جدًا.");
  if (!/^[\u0600-\u06FFa-z0-9_-]+$/i.test(normalizedName)) {
    throw new Error("استخدم حروفًا عربية أو إنجليزية وأرقامًا فقط في اسم الحساب.");
  }
  if (String(password || "").length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  return { accountName: normalizedName, password: String(password) };
}

async function deriveEncryptionKey(accountName, password) {
  const material = await sha256(`rafiq-account-encryption-v1:${accountName}:${password}`);
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function getAccountCredentials(accountName, password) {
  const account = validateAccount(accountName, password);
  const [accountId, authToken] = await Promise.all([
    sha256(`rafiq-account-id-v1:${account.accountName}`),
    sha256(`rafiq-account-auth-v1:${account.accountName}:${account.password}`),
  ]);
  return {
    ...account,
    accountId: bytesToHex(accountId),
    authToken: bytesToHex(authToken),
  };
}

export async function encryptData(data, accountName, password) {
  const account = validateAccount(accountName, password);
  const key = await deriveEncryptionKey(account.accountName, account.password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: 2,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptData(encrypted, accountName, password) {
  if (!encrypted || ![1, 2].includes(encrypted.version) || !encrypted.iv || !encrypted.ciphertext) {
    throw new Error("بيانات الحساب غير صالحة.");
  }
  const account = validateAccount(accountName, password);
  const key = await deriveEncryptionKey(account.accountName, account.password);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(encrypted.iv) },
      key,
      base64ToBytes(encrypted.ciphertext),
    );
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    throw new Error("اسم الحساب أو كلمة المرور غير صحيحة.");
  }
}

async function accountRequest(accountName, password, options = {}) {
  const credentials = await getAccountCredentials(accountName, password);
  const response = await fetch(`/.netlify/functions/sync?accountId=${credentials.accountId}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-sync-token": credentials.authToken,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "تعذر الاتصال بحساب المزامنة.");
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
}

export async function createCloudAccount(accountName, password, data) {
  const encrypted = await encryptData(data, accountName, password);
  return accountRequest(accountName, password, {
    method: "POST",
    body: JSON.stringify({ encrypted, accountName: normalizeAccountName(accountName) }),
  });
}

export async function fetchCloudAccount(accountName, password) {
  const payload = await accountRequest(accountName, password);
  return {
    ...payload,
    data: await decryptData(payload.encrypted, accountName, password),
  };
}

export async function saveCloudAccount(accountName, password, data, expectedVersion) {
  const encrypted = await encryptData(data, accountName, password);
  return accountRequest(accountName, password, {
    method: "PUT",
    body: JSON.stringify({ encrypted, expectedVersion }),
  });
}

export async function deleteCloudAccount(accountName, password) {
  return accountRequest(accountName, password, { method: "DELETE" });
}
