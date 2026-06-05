import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validId(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validToken(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validAccountName(value) {
  return typeof value === "string" && /^[\u0600-\u06FFa-z0-9_-]{3,64}$/i.test(value);
}

function validEncrypted(value) {
  return (
    value &&
    [1, 2].includes(value.version) &&
    typeof value.iv === "string" &&
    value.iv.length < 128 &&
    typeof value.ciphertext === "string" &&
    value.ciphertext.length > 10 &&
    value.ciphertext.length < 7_000_000
  );
}

export default async (request) => {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const token = request.headers.get("x-sync-token");

  if (!validId(accountId) || !validToken(token)) {
    return json({ message: "بيانات الدخول إلى حساب المزامنة غير صالحة." }, 400);
  }

  const store = getStore({ name: "rafiq-sync-accounts", consistency: "strong" });
  const existing = await store.get(accountId, { type: "json" });

  if (request.method === "POST") {
    if (existing) return json({ message: "اسم الحساب موجود بالفعل. اختر اسمًا آخر أو سجل الدخول." }, 409);
    const body = await request.json().catch(() => null);
    if (!validEncrypted(body?.encrypted)) return json({ message: "البيانات المشفرة غير صالحة." }, 400);
    if (!validAccountName(body?.accountName)) return json({ message: "اسم الحساب غير صالح." }, 400);
    const record = {
      accountName: body.accountName,
      tokenHash: hash(token),
      encrypted: body.encrypted,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const result = await store.setJSON(accountId, record, { onlyIfNew: true });
    if (!result.modified) return json({ message: "تعذر إنشاء حساب المزامنة." }, 409);
    return json({ accountName: record.accountName, version: record.version, updatedAt: record.updatedAt }, 201);
  }

  if (!existing) return json({ message: "لم يتم العثور على هذا الحساب." }, 404);
  if (!safeEqual(existing.tokenHash, hash(token))) {
    return json({ message: "اسم الحساب أو كلمة المرور غير صحيحة." }, 401);
  }

  if (request.method === "GET") {
    return json({
      accountName: existing.accountName,
      encrypted: existing.encrypted,
      version: existing.version,
      updatedAt: existing.updatedAt,
    });
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    if (!validEncrypted(body?.encrypted)) return json({ message: "البيانات المشفرة غير صالحة." }, 400);
    if (body.expectedVersion !== existing.version) {
      return json(
        {
          message: "يوجد تعديل أحدث من جهاز آخر.",
          version: existing.version,
          updatedAt: existing.updatedAt,
        },
        409,
      );
    }
    const record = {
      ...existing,
      encrypted: body.encrypted,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(accountId, record);
    return json({ accountName: record.accountName, version: record.version, updatedAt: record.updatedAt });
  }

  if (request.method === "DELETE") {
    await store.delete(accountId);
    return json({ deleted: true });
  }

  return json({ message: "الطريقة غير مدعومة." }, 405);
};

export const config = {
  path: "/.netlify/functions/sync",
};
