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

function validSpaceId(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validToken(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validEncrypted(value) {
  return (
    value &&
    value.version === 1 &&
    typeof value.iv === "string" &&
    value.iv.length < 128 &&
    typeof value.ciphertext === "string" &&
    value.ciphertext.length > 10 &&
    value.ciphertext.length < 2_000_000
  );
}

export default async (request) => {
  const url = new URL(request.url);
  const spaceId = url.searchParams.get("spaceId");
  const token = request.headers.get("x-sync-token");

  if (!validSpaceId(spaceId) || !validToken(token)) {
    return json({ message: "بيانات الوصول إلى المزامنة غير صالحة." }, 400);
  }

  const store = getStore({ name: "rafiq-sync-spaces", consistency: "strong" });
  const existing = await store.get(spaceId, { type: "json" });

  if (request.method === "POST") {
    if (existing) return json({ message: "مساحة المزامنة موجودة بالفعل." }, 409);
    const body = await request.json().catch(() => null);
    if (!validEncrypted(body?.encrypted)) return json({ message: "البيانات المشفرة غير صالحة." }, 400);
    const record = {
      tokenHash: hash(token),
      encrypted: body.encrypted,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    const result = await store.setJSON(spaceId, record, { onlyIfNew: true });
    if (!result.modified) return json({ message: "تعذر إنشاء مساحة المزامنة." }, 409);
    return json({ version: record.version, updatedAt: record.updatedAt }, 201);
  }

  if (!existing) return json({ message: "لم يتم العثور على مساحة المزامنة." }, 404);
  if (!safeEqual(existing.tokenHash, hash(token))) {
    return json({ message: "رمز المزامنة غير صحيح." }, 401);
  }

  if (request.method === "GET") {
    return json({
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
    await store.setJSON(spaceId, record);
    return json({ version: record.version, updatedAt: record.updatedAt });
  }

  if (request.method === "DELETE") {
    await store.delete(spaceId);
    return json({ deleted: true });
  }

  return json({ message: "الطريقة غير مدعومة." }, 405);
};

export const config = {
  path: "/.netlify/functions/sync",
};
