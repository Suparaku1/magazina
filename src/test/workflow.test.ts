// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const teacher=id(1), admin=id(2), warehouse=id(3), head=id(4), other=id(5), year=id(10), dept=id(11), curriculum=id(12), group=id(13), subject=id(14), item=id(15);
let req: string, line: string;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TYPE subject_type AS ENUM('teori_pergjithshme','teori_profesionale','praktike_profesionale');
 CREATE TABLE school_years(id uuid primary key);
 CREATE TABLE departments(id uuid primary key);
 CREATE TABLE curricula(id uuid primary key,department_id uuid);
 CREATE TABLE teachers(id uuid primary key,user_id uuid);
 CREATE TABLE user_roles(user_id uuid,role text,department_id uuid);
 CREATE TABLE class_groups(id uuid primary key,school_year_id uuid,curriculum_id uuid,department_id uuid);
 CREATE TABLE subjects(id uuid primary key,lloji subject_type,curriculum_id uuid);
 CREATE TABLE laboratories(id uuid primary key,department_id uuid);
 CREATE TABLE teaching_assignments(teacher_id uuid,school_year_id uuid,class_group_id uuid,subject_id uuid,aktiv boolean);
 CREATE TABLE homeroom_assignments(teacher_id uuid,school_year_id uuid,class_group_id uuid,aktiv boolean);
 CREATE TABLE lab_assignments(teacher_id uuid,school_year_id uuid,laboratory_id uuid,aktiv boolean);
 CREATE TABLE items(id uuid primary key);
 CREATE TABLE item_suggestions(statusi text);
 CREATE TABLE audit_log(tabela text,veprimi text);
 CREATE FUNCTION audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO audit_log VALUES(TG_TABLE_NAME,TG_OP); RETURN coalesce(NEW,OLD); END $$;
 CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
 CREATE FUNCTION heads_department(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role='shef_departamenti' AND department_id=$2) $$;
 CREATE FUNCTION teacher_id_of(uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT id FROM teachers WHERE user_id=$1 $$;
 GRANT SELECT ON school_years,departments,curricula,teachers,user_roles,class_groups,subjects,laboratories,teaching_assignments,homeroom_assignments,lab_assignments,items,item_suggestions TO authenticated;`);
 for (const file of ['0002_faza3_kerkesat','0003_faza3_fix_select_policy','0004_faza4_magazina','0006_stock_atomic_initial_inventory','0007_faza6_panele_njoftime','0008_faza6_summary_suggestion_status']) await db.exec(readFileSync(`drizzle/migrations/${file}.sql`,'utf8'));
},30000);
async function asUser(user: string){await db.exec('RESET ROLE');await db.query("SELECT set_config('test.uid',$1,false)",[user]);await db.exec('SET ROLE authenticated');}
async function fail(action:()=>Promise<unknown>){await db.exec('SAVEPOINT invalid');let error=false;try{await action();}catch{error=true;}await db.exec('ROLLBACK TO SAVEPOINT invalid;RELEASE SAVEPOINT invalid');expect(error).toBe(true);}
beforeEach(async()=>{
 await db.exec('RESET ROLE;ROLLBACK;BEGIN;');
 await db.query('INSERT INTO school_years VALUES($1)',[year]);await db.query('INSERT INTO departments VALUES($1)',[dept]);await db.query('INSERT INTO curricula VALUES($1,$2)',[curriculum,dept]);
 await db.query('INSERT INTO teachers VALUES($1,$1),($2,$2)',[teacher,other]);
 await db.query("INSERT INTO user_roles VALUES($1,'mesues',NULL),($2,'admin',NULL),($3,'magazinier',NULL),($4,'shef_departamenti',$5)",[teacher,admin,warehouse,head,dept]);
 await db.query('INSERT INTO class_groups VALUES($1,$2,$3,$4)',[group,year,curriculum,dept]);await db.query("INSERT INTO subjects VALUES($1,'teori_profesionale',$2)",[subject,curriculum]);await db.query('INSERT INTO teaching_assignments VALUES($1,$2,$3,$4,true)',[teacher,year,group,subject]);await db.query('INSERT INTO items VALUES($1)',[item]);
 await asUser(teacher);
 req=(await db.query<{id:string}>("INSERT INTO requests(school_year_id,teacher_id,konteksti,class_group_id,subject_id) VALUES($1,$2,'teori_profesionale',$3,$4) RETURNING id",[year,teacher,group,subject])).rows[0]?.id ?? '';
 line=(await db.query<{id:string}>('INSERT INTO request_lines(request_id,item_id,sasia,cmim_njesi) VALUES($1,$2,6,NULL) RETURNING id',[req,item])).rows[0]?.id ?? '';
});
afterAll(async()=>{await db.exec('RESET ROLE;ROLLBACK');await db.close();});
const submit=()=>db.query('SELECT submit_request($1)',[req]);
const approve=(qty?:number,reason?:string)=>db.query("SELECT decide_request($1,'mirato',$2,$3::jsonb)",[req,reason??null,qty===undefined?null:JSON.stringify([{line_id:line,sasia_miratuar:qty}])]);
const move=(kind:string,qty:number,linked:string|null=null)=>db.query('SELECT record_stock_movement($1,$2,$3,NULL,$4,NULL,NULL)',[item,kind,qty,linked]);
it('request -> approval -> partial delivery -> fulfillment -> read notification uses real workflow functions',async()=>{
 await submit();await asUser(admin);expect((await db.query('SELECT * FROM notifications')).rows).toHaveLength(1);await approve();
 await asUser(warehouse);await move('hyrje',10);await move('dalje',2,line);
 expect((await db.query<{statusi:string}>('SELECT statusi FROM requests')).rows[0]?.statusi).toBe('ne_permbushje');
 await move('dalje',4,line);expect((await db.query<{statusi:string}>('SELECT statusi FROM requests')).rows[0]?.statusi).toBe('permbushur');
 expect(Number((await db.query<{sasia:string}>('SELECT sasia FROM stock_balances')).rows[0]?.sasia)).toBe(4);
 await asUser(teacher);expect((await db.query('SELECT * FROM notifications')).rows).toHaveLength(3);await db.exec('UPDATE notifications SET read_at=now()');expect((await db.query('SELECT * FROM notifications WHERE read_at IS NULL')).rows).toHaveLength(0);
 expect((await db.query<{vlera:string|null}>('SELECT vlera FROM request_lines')).rows[0]?.vlera).toBeNull();
 expect((await db.query('SELECT * FROM request_status_history')).rows).toHaveLength(5);
});
it('teachers without assignment cannot create requests',async()=>{await asUser(other);await fail(()=>db.query("INSERT INTO requests(school_year_id,teacher_id,konteksti,class_group_id,subject_id) VALUES($1,$2,'teori_profesionale',$3,$4)",[year,other,group,subject]));});
it('head can recommend but cannot approve',async()=>{await submit();await asUser(head);await db.query("INSERT INTO request_comments(request_id,lloji,tekst) VALUES($1,'rekomandim','Rekomandim prove')",[req]);await fail(()=>approve());});
it('failed partial approval leaves status and notifications unchanged',async()=>{await submit();await asUser(admin);await fail(()=>approve(3));expect((await db.query<{statusi:string}>('SELECT statusi FROM requests')).rows[0]?.statusi).toBe('derguar');expect((await db.query('SELECT * FROM notifications')).rows).toHaveLength(1);});
it('return reopens fulfillment without altering past stock movements',async()=>{await submit();await asUser(admin);await approve(3,'Sasia e nevojshme');await asUser(warehouse);await move('hyrje',5);await move('dalje',3,line);await move('kthim',1,line);expect((await db.query<{statusi:string}>('SELECT statusi FROM requests')).rows[0]?.statusi).toBe('ne_permbushje');expect(Number((await db.query<{sasia_dorezuar:string}>('SELECT sasia_dorezuar FROM request_lines')).rows[0]?.sasia_dorezuar)).toBe(2);expect((await db.query('SELECT * FROM stock_movements')).rows).toHaveLength(3);});
it('direct status changes and foreign request submission are blocked',async()=>{await fail(()=>db.query("UPDATE requests SET statusi='derguar' WHERE id=$1",[req]));await asUser(other);await fail(()=>submit());});
