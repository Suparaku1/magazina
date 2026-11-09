// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = '00000000-0000-4000-8000-000000000001';
const admin = '00000000-0000-4000-8000-000000000002';
const head = '00000000-0000-4000-8000-000000000003';
const otherHead = '00000000-0000-4000-8000-000000000004';
const warehouse = '00000000-0000-4000-8000-000000000005';
const req = '00000000-0000-4000-8000-000000000010';
const dept = '00000000-0000-4000-8000-000000000011';
const otherDept = '00000000-0000-4000-8000-000000000012';
beforeAll(async () => {
 db = new PGlite();
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE teachers(id uuid primary key,user_id uuid);
 CREATE TABLE user_roles(user_id uuid,role text,department_id uuid);
 CREATE TABLE requests(id uuid primary key,teacher_id uuid,department_id uuid,statusi text,numer text);
 CREATE TABLE request_lines(id uuid primary key,request_id uuid);
 CREATE TABLE stock_movements(request_line_id uuid,lloji text);
 CREATE TABLE class_groups(curriculum_id uuid,department_id uuid);
 CREATE TABLE curricula(id uuid);
 CREATE TABLE item_suggestions(statusi text);
 CREATE TABLE stock_balances(sasia numeric);
 CREATE TABLE audit_log(id bigint);
 INSERT INTO audit_log VALUES(1);
 CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
 CREATE FUNCTION can_view_request(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM requests r WHERE r.id=$2 AND (EXISTS(SELECT 1 FROM teachers t WHERE t.id=r.teacher_id AND t.user_id=$1) OR has_role($1,'admin') OR (r.statusi<>'draft' AND (has_role($1,'magazinier') OR EXISTS(SELECT 1 FROM user_roles u WHERE u.user_id=$1 AND u.role='shef_departamenti' AND u.department_id=r.department_id))))) $$;
 GRANT SELECT ON teachers,user_roles,requests,class_groups,curricula,item_suggestions,stock_balances TO authenticated;
 ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
 CREATE POLICY readable ON requests FOR SELECT TO authenticated USING(can_view_request(auth.uid(),id));`);
 const auditSql = readFileSync('drizzle/migrations/0000_faza1_struktura_role_rls.sql','utf8');
 await db.exec(auditSql.slice(auditSql.indexOf('GRANT SELECT ON public.audit_log'),auditSql.indexOf('-- ===== SEED')));
 await db.exec(readFileSync('drizzle/migrations/0007_faza6_panele_njoftime.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0008_faza6_summary_suggestion_status.sql','utf8'));
},30000);
beforeEach(async () => {
 await db.exec('RESET ROLE; ROLLBACK; BEGIN;');
 await db.query("SELECT set_config('test.uid',$1,false)",[owner]);
 await db.query('INSERT INTO teachers VALUES($1,$1)',[owner]);
 await db.query("INSERT INTO user_roles VALUES($1,'admin',NULL),($1,'shef_departamenti',$4),($2,'shef_departamenti',$4),($3,'shef_departamenti',$5),($6,'magazinier',NULL)",[admin,head,otherHead,dept,otherDept,warehouse]);
 await db.query("INSERT INTO requests VALUES($1,$2,$3,'draft','K-TEST')",[req,owner,dept]);
});
afterAll(async () => { await db.exec('RESET ROLE; ROLLBACK'); await db.close(); });
async function status(value: string) { await db.query('UPDATE requests SET statusi=$1 WHERE id=$2',[value,req]); }
async function recipients() { return (await db.query<{user_id:string}>('SELECT user_id FROM notifications ORDER BY user_id')).rows.map(r=>r.user_id); }
async function asUser(id: string) { await db.query("SELECT set_config('test.uid',$1,false)",[id]); await db.exec('SET ROLE authenticated'); }
async function rejected(sql: string) { await db.exec('SAVEPOINT denied'); let failed=false; try { await db.exec(sql); } catch { failed=true; } await db.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied'); expect(failed).toBe(true); }
it('submission notifies admins and only the matching department once per user',async()=>{await status('derguar');expect(await recipients()).toEqual([admin,head]);});
it('unrelated updates do not duplicate alerts',async()=>{await status('derguar');await status('derguar');expect(await recipients()).toEqual([admin,head]);});
for(const decision of ['miratuar','miratuar_pjeserisht','refuzuar','kthyer_per_korrigjim']) it(`notifies owner on ${decision}`,async()=>{await status(decision);expect(await recipients()).toEqual(decision.startsWith('miratuar')?[owner,warehouse]:[owner]);});
it('linked deliveries and returns notify owner, unlinked movements do not',async()=>{await db.query('INSERT INTO request_lines VALUES($1,$1)',[req]);await db.query("INSERT INTO stock_movements VALUES($1,'dalje'),($1,'kthim'),(NULL,'hyrje')",[req]);expect(await recipients()).toEqual([owner,owner]);});
it('alerts roll back with their originating transaction',async()=>{await db.exec('SAVEPOINT workflow');await status('derguar');await db.exec('ROLLBACK TO SAVEPOINT workflow');expect(await recipients()).toEqual([]);});
it('users cannot read another users notifications',async()=>{await status('derguar');await asUser(owner);expect((await db.query('SELECT * FROM notifications')).rows).toHaveLength(0);});
it('own readable notifications can be marked but not forged',async()=>{await status('derguar');await asUser(head);await db.exec('UPDATE notifications SET read_at=now()');expect((await db.query('SELECT * FROM notifications WHERE read_at IS NOT NULL')).rows).toHaveLength(1);await rejected("UPDATE notifications SET user_id='"+owner+"'");await rejected("INSERT INTO notifications(user_id,request_id,titulli,mesazhi) VALUES('"+head+"','"+req+"','X','X')");});
it('cannot mark another users notifications',async()=>{await status('derguar');await asUser(owner);await db.exec('UPDATE notifications SET read_at=now()');await db.exec('RESET ROLE');expect((await db.query('SELECT * FROM notifications WHERE read_at IS NOT NULL')).rows).toHaveLength(0);});
it('department summary respects RLS and hides admin fields',async()=>{await status('derguar');await db.query("INSERT INTO requests VALUES($1,$2,$3,'derguar','K-OTHER')",[otherDept,owner,otherDept]);await asUser(head);const result=(await db.query<{summary:{statuses:Record<string,number>;teachers?:number}}> ('SELECT dashboard_summary() summary')).rows[0]?.summary;expect(result?.statuses['derguar']).toBe(1);expect(result?.teachers).toBeUndefined();});
it('admin summary counts pending suggestions using the real enum value',async()=>{await db.exec("INSERT INTO item_suggestions VALUES('ne_shqyrtim'),('pranuar')");await asUser(admin);const result=(await db.query<{summary:{pendingSuggestions:number}}> ('SELECT dashboard_summary() summary')).rows[0]?.summary;expect(result?.pendingSuggestions).toBe(1);});

it('audit is readable by admin and not by a teacher',async()=>{await asUser(owner);expect((await db.query('SELECT * FROM audit_log')).rows).toHaveLength(0);await rejected('INSERT INTO audit_log VALUES(2)');await db.exec('RESET ROLE');await asUser(admin);expect((await db.query('SELECT * FROM audit_log')).rows).toHaveLength(1);});
it('teacher summary excludes other teachers requests and stock fields',async()=>{await db.query("INSERT INTO requests VALUES($1,$2,$3,'derguar','K-OTHER')",[otherDept,otherHead,otherDept]);await asUser(owner);const r=(await db.query<{summary:{statuses:Record<string,number>;stockItems?:number}}> ('SELECT dashboard_summary() summary')).rows[0]?.summary;expect(r?.statuses['draft']).toBe(1);expect(r?.statuses['derguar']).toBeUndefined();expect(r?.stockItems).toBeUndefined();});
it('warehouse summary hides drafts and shows stock counts',async()=>{await status('derguar');await db.query("INSERT INTO requests VALUES($1,$2,$3,'draft','K-DRAFT')",[otherDept,owner,otherDept]);await db.exec('INSERT INTO stock_balances VALUES(5),(0)');await asUser(warehouse);const r=(await db.query<{summary:{statuses:Record<string,number>;stockItems:number;zeroStock:number}}> ('SELECT dashboard_summary() summary')).rows[0]?.summary;expect(r?.statuses['derguar']).toBe(1);expect(r?.statuses['draft']).toBeUndefined();expect(r?.stockItems).toBe(1);expect(r?.zeroStock).toBe(1);});
