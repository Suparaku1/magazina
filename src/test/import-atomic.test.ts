// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest';
let db:PGlite;
const uid='00000000-0000-4000-8000-000000000001', item='00000000-0000-4000-8000-000000000002', other='00000000-0000-4000-8000-000000000003';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true)=$2 $$;
 CREATE FUNCTION audit_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW;END $$;
 CREATE TYPE request_status AS ENUM('miratuar','miratuar_pjeserisht','ne_permbushje','permbushur');
 CREATE TABLE items(id uuid primary key,emer text NOT NULL UNIQUE,specifikime text,unit_id uuid,category_id uuid,cmim_reference numeric);
 CREATE TABLE requests(id uuid primary key,statusi request_status);
 CREATE TABLE request_lines(id uuid primary key,request_id uuid,item_id uuid,sasia_miratuar numeric,sasia_dorezuar numeric);
 CREATE TABLE request_decisions(request_id uuid,vendimi request_status,kur timestamptz);
 CREATE TABLE teachers(emer text,mbiemer text,email text,department_id uuid,lendet_sipas_listes text);
 CREATE TABLE class_groups(emer text,nivel smallint,school_year_id uuid,department_id uuid,curriculum_id uuid);
 CREATE TABLE teaching_assignments(teacher_id uuid,school_year_id uuid,class_group_id uuid,subject_id uuid);`);
 for(const f of ['0004_faza4_magazina','0005_faza5_import_batches_stock_safety','0006_stock_atomic_initial_inventory','0009_atomic_excel_import'])await db.exec(readFileSync(`drizzle/migrations/${f}.sql`,'utf8'));
},30000);
beforeEach(async()=>{await db.exec('ROLLBACK;BEGIN;');await db.query("SELECT set_config('test.uid',$1,false),set_config('test.role','admin',false)",[uid]);await db.query("INSERT INTO items(id,emer) VALUES($1,'A'),($2,'B')",[item,other]);});
afterAll(async()=>{await db.exec('ROLLBACK');await db.close();});
const commit=(rows:unknown[])=>db.query("SELECT commit_excel_import('inventar',$1::jsonb,'test.xlsx')",[JSON.stringify(rows)]);
async function rejected(action:()=>Promise<unknown>){await db.exec('SAVEPOINT invalid');let failed=false;try{await action();}catch{failed=true;}await db.exec('ROLLBACK TO SAVEPOINT invalid;RELEASE SAVEPOINT invalid');expect(failed).toBe(true);}
it('valid inventory rows and batch log commit together',async()=>{await commit([{item_id:item,sasia:5},{item_id:other,sasia:3}]);expect((await db.query('SELECT * FROM stock_movements')).rows).toHaveLength(2);expect((await db.query<{rreshta_ok:number}>('SELECT rreshta_ok FROM import_batches')).rows[0]?.rreshta_ok).toBe(2);});
it('later inventory row failure rolls back earlier movements and balances',async()=>{await rejected(()=>commit([{item_id:item,sasia:5},{item_id:item,sasia:3}]));expect((await db.query('SELECT * FROM stock_movements')).rows).toHaveLength(0);expect((await db.query('SELECT * FROM stock_balances')).rows).toHaveLength(0);expect((await db.query('SELECT * FROM import_batches')).rows).toHaveLength(0);});
it('batch log failure rolls back all inventory writes',async()=>{await db.exec("CREATE FUNCTION reject_batch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test failure';END $$;CREATE TRIGGER reject_batch BEFORE INSERT ON import_batches FOR EACH ROW EXECUTE FUNCTION reject_batch();");await rejected(()=>commit([{item_id:item,sasia:5}]));expect((await db.query('SELECT * FROM stock_movements')).rows).toHaveLength(0);});
it('warehouse-only users cannot import',async()=>{await db.exec("SELECT set_config('test.role','magazinier',false)");await rejected(()=>commit([{item_id:item,sasia:5}]));expect((await db.query('SELECT * FROM import_batches')).rows).toHaveLength(0);});
