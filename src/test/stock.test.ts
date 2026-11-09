// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
const uid = "00000000-0000-4000-8000-000000000001";
const item = "00000000-0000-4000-8000-000000000002";
const req = "00000000-0000-4000-8000-000000000003";
const line = "00000000-0000-4000-8000-000000000004";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true) IN ('admin','magazinier') $$;
    CREATE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE TYPE public.request_status AS ENUM ('miratuar','miratuar_pjeserisht','ne_permbushje','permbushur');
    CREATE TABLE public.items(id uuid primary key);
    CREATE TABLE public.requests(id uuid primary key,statusi public.request_status);
    CREATE TABLE public.request_lines(id uuid primary key,request_id uuid,item_id uuid,sasia_miratuar numeric,sasia_dorezuar numeric default 0);
    CREATE TABLE public.request_decisions(request_id uuid,vendimi public.request_status,kur timestamptz default now());`);
  await db.exec(readFileSync("drizzle/migrations/0004_faza4_magazina.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0006_stock_atomic_initial_inventory.sql", "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("ROLLBACK; BEGIN;");
  await db.query("select set_config('test.uid',$1,false),set_config('test.role','admin',false)", [uid]);
  await db.query("insert into items values($1)", [item]);
  await db.query("insert into requests values($1,'miratuar_pjeserisht')", [req]);
  await db.query("insert into request_lines values($1,$2,$3,6,0)", [line, req, item]);
  await db.query("insert into request_decisions(request_id,vendimi) values($1,'miratuar_pjeserisht')", [req]);
});
afterAll(async () => { await db.exec("ROLLBACK"); await db.close(); });
const move = (type: string, qty: number | string, linked: string | null = null, reason: string | null = null) => db.query("select record_stock_movement($1,$2,$3::numeric,NULL,$4,NULL,$5)", [item, type, qty, linked, reason]);
async function safeFailure(action: () => Promise<unknown>) {
  await db.exec("SAVEPOINT failure"); let failed = false;
  try { await action(); } catch { failed = true; }
  await db.exec("ROLLBACK TO SAVEPOINT failure; RELEASE SAVEPOINT failure"); expect(failed).toBe(true);
}
const balance = async () => (await db.query<{ sasia: string }>("select sasia from stock_balances")).rows[0]?.sasia;
describe("Warehouse SQL invariants", () => {
  it("a request by itself does not add stock", async () => { expect((await db.query("select * from stock_balances")).rows).toHaveLength(0); });
  it("rejects withdrawal above balance without partial changes", async () => { await move("hyrje", 10); await safeFailure(() => move("dalje", 11)); expect(Number(await balance())).toBe(10); expect((await db.query("select * from stock_movements")).rows).toHaveLength(1); });
  it("forbids changing movement history", async () => { await move("hyrje", 10); await safeFailure(() => db.exec("update stock_movements set sasia=99")); expect(Number(await balance())).toBe(10); });
  it("forbids deleting movement history", async () => { await move("hyrje", 10); await safeFailure(() => db.exec("delete from stock_movements")); expect((await db.query("select * from stock_movements")).rows).toHaveLength(1); });
  it("keeps balance equal to sum of signed movements", async () => { await move("hyrje", 10); await move("dalje", 3); await move("korrigjim", -2, null, "Korrigjim prove"); const sum = (await db.query<{ total: string }>("select sum(sasia) total from stock_movements")).rows[0]?.total; expect(Number(await balance())).toBe(5); expect(Number(sum)).toBe(5); });
  it("requires a correction reason", async () => { await move("hyrje", 10); await safeFailure(() => move("korrigjim", -2)); expect(Number(await balance())).toBe(10); });
  it("allows initial inventory only once", async () => { await move("inventar_fillestar", 10); await safeFailure(() => move("inventar_fillestar", 5)); expect(Number(await balance())).toBe(10); });
  it("requires a warehouse role", async () => { await db.exec("select set_config('test.role','mesues',false)"); await safeFailure(() => move("hyrje", 10)); expect((await db.query("select * from stock_movements")).rows).toHaveLength(0); });
  it("partial delivery updates quantity and request status atomically", async () => { await move("hyrje", 10); await move("dalje", 2, line); expect(Number(await balance())).toBe(8); expect((await db.query<{ statusi: string }>("select statusi from requests")).rows[0]?.statusi).toBe("ne_permbushje"); await move("dalje", 4, line); expect((await db.query<{ statusi: string }>("select statusi from requests")).rows[0]?.statusi).toBe("permbushur"); });
  it("returns reduce delivered quantity and reopen remaining fulfillment", async () => { await move("hyrje", 10); await move("dalje", 6, line); await move("kthim", 2, line); expect(Number(await balance())).toBe(6); expect((await db.query<{ statusi: string }>("select statusi from requests")).rows[0]?.statusi).toBe("ne_permbushje"); });
  it("cannot deliver more than the approved quantity", async () => { await move("hyrje", 10); await safeFailure(() => move("dalje", 7, line)); expect(Number(await balance())).toBe(10); expect((await db.query<{ statusi: string }>("select statusi from requests")).rows[0]?.statusi).toBe("miratuar_pjeserisht"); });
  it("rejects nonfinite quantities", async () => { await safeFailure(() => move("hyrje", "NaN")); expect((await db.query("select * from stock_movements")).rows).toHaveLength(0); });
});