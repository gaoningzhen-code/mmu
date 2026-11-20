// MMU 云存档：每个存档账号一条记录（全部角色）
import { getStore } from "@netlify/blobs";

const MAX = 3 * 1024 * 1024;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
async function sha(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const idOf = (n) => (typeof n === "string" && /^[\p{L}\p{N}_-]{2,20}$/u.test(n) ? n.toLowerCase() : null);

export default async (req) => {
  const store = getStore({ name: "mmu-saves", consistency: "strong" });
  let b;
  try { b = await req.json(); } catch { return json({ err: "bad" }, 400); }
  const id = idOf(b.name);
  if (!id || typeof b.key !== "string" || b.key.length < 32) return json({ err: "账号名需 2-20 个字（字母、数字、汉字、_ -）" }, 400);
  const k = await sha("mmu-srv:" + b.key);
  const rec = await store.get(id, { type: "json" });
  if (rec && rec.k !== k) return json({ err: "账号名已被占用，或密码错误" }, 403);

  if (b.op === "login") {
    if (!rec) { if (!b.register) return json({ err: "账号不存在" }, 404); await store.setJSON(id, { k, ts: 0, data: null }); return json({ ok: 1, ts: 0, data: null, created: 1 }); }
    return json({ ok: 1, ts: rec.ts, data: rec.data });
  }
  if (b.op === "push") {
    if (!rec) return json({ err: "账号不存在" }, 404);
    if ((b.prev || 0) !== (rec.ts || 0)) return json({ conflict: 1, ts: rec.ts, data: rec.data }, 409);
    const s = JSON.stringify(b.data || null);
    if (s.length > MAX) return json({ err: "存档过大" }, 413);
    const ts = Date.now();
    await store.setJSON(id, { k, ts, data: b.data });
    return json({ ok: 1, ts });
  }
  return json({ err: "bad op" }, 400);
};

export const config = { path: "/api/save" };
