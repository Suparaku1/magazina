# Baza Materiale – Shkolla Teknike Elektrike "Gjergj Canco"

Plani teknik dhe modeli i të dhënave. Ky është vetëm plani; nuk ndërtohet asnjë ndërfaqe me të dhëna të rreme.

## 0. Burimet dhe boshllëqet

- Dokumenti "Baza Materiale – Arkitekturë dhe Prompt Lovable" **nuk është i ngarkuar**. Plani bazohet në kërkesat e mesazhit. Duhet ngarkuar për krahasim.
- Lista e mësuesve 2026–2027 (Excel, ~80 rreshta): kolona e emrit është e bashkuar "EMRI MBIEMRI" dhe lënda. Importohet vetëm emri + lënda; email-et mungojnë dhe mbeten "Për konfigurim".
- Ornela dhe Xhiana Lapi: mbiemri i Ornelës mungon, nuk shpiket.
- Lista e 12 skeletkurrikulave dhe 37 grupeve të klasave nuk ndodhet plotësisht në skedarët e ngarkuar (vetëm E-II-24, SK-T2-IV-21, SK-T3-IV-21). Seed-i do t'i krijojë vetëm ato të konfirmuara; pjesa tjetër hyn nga administratori ose nga një listë që na jepni.
- Kërkesa e shembullit (E. Suparaku) shërben si model për rreshtat e kërkesës dhe eksportin.

## 1. Arkitektura

```text
Shfletuesi (React + TS, TanStack Start, shqip)
   │  sesioni i hyrjes
   ▼
Funksione serveri (createServerFn, middleware auth)  ── eksport/import .xlsx (exceljs)
   │  klient me JWT të përdoruesit → RLS zbatohet
   ▼
Lovable Cloud: Postgres + RLS + funksione SECURITY DEFINER + Storage privat
```

- Asnjë çelës service-role në frontend. Klienti admin përdoret vetëm për ftesat e përdoruesve, pas verifikimit të rolit `admin`.
- Regjistrimi publik i çaktivizuar; llogaritë krijohen me `inviteUserByEmail` nga administratori.
- Eksportet ekzekutohen me klientin e përdoruesit, ndaj respektojnë RLS automatikisht.
- Lëvizjet e magazinës vetëm përmes funksioneve RPC transaksionale; nuk ka INSERT/UPDATE/DELETE të drejtpërdrejtë.

## 2. Rolet dhe scope

Role (të shumëfishta për person, tabela `user_roles`): `admin`, `shef_departamenti`, `mesues`, `magazinier`.

| Roli | Scope | Të drejtat kryesore |
|---|---|---|
| admin | global | Konfigurim, ftesa, miratim/refuzim/kthim, katalog, raporte |
| shef_departamenti | `department_id` | Lexim i departamentit, komente/rekomandime, raporte të departamentit |
| mesues | caktimet e veta | Draft, dërgim, korrigjim, sugjerim artikulli |
| magazinier | global magazina | Inventar, hyrje, dalje, kthime, korrigjime me arsye |

Seed: Silvana Kasemi = admin + mësuese; Ornela = shefe TIK + mësuese; Xhiana Lapi = shefe Elektroteknikë + mësuese. Lidhja me llogarinë bëhet kur admini fton me email real.

Funksione ndihmëse (SECURITY DEFINER): `has_role(uid, role)`, `heads_department(uid, dept)`, `teacher_id_of(uid)`, `can_view_request(uid, request_id)`.

## 3. Modeli i të dhënave

**Struktura akademike**
- `school_years` (id, emer "2026–2027", data_fillimi, data_mbarimi, aktiv – unik vetëm një aktiv)
- `departments` (id, kod unik, emer) – TIK, Elektroteknikë
- `curricula` (id, kod unik p.sh. E-II-24, emer, department_id FK, drejtimi, profili, niveli, dokument_id FK)
- `subjects` (id, curriculum_id FK nullable, kod, emer, lloji: teori_pergjithshme | teori_profesionale | praktike_profesionale, klasa_nivel; unik (curriculum_id, kod))
- `class_groups` (id, school_year_id FK, emer p.sh. "10-A", nivel 10–13, department_id FK, curriculum_id FK nullable = "Për konfigurim"; unik (year, emer))
- `laboratories` (id, emer unik, department_id FK, pershkrim)

**Njerëzit dhe caktimet**
- `teachers` (id, user_id FK auth.users nullable unik, emer, mbiemer nullable, email nullable, department_id FK nullable, aktiv)
- `profiles` (user_id PK, emer_shfaqur)
- `user_roles` (user_id, role, department_id nullable; unik (user_id, role, department_id))
- `teaching_assignments` (teacher_id, school_year_id, class_group_id, subject_id, aktiv; unik)
- `homeroom_assignments` (teacher_id, school_year_id, class_group_id; unik (year, class))
- `lab_assignments` (teacher_id, school_year_id, laboratory_id)

**Katalogu**
- `categories` (emer unik, parent_id), `units` (kod unik: copë, m, kg, pako...)
- `items` (id, kod unik, emer, specifikime, category_id, unit_id, cmim_reference numeric NULL, aktiv; unik (lower(emer), lower(specifikime), unit_id))
- `item_synonyms` (item_id, sinonim; unik lower(sinonim)) – për kërkim
- `item_suggestions` (sugjeruar_nga, emer, specifikime, njesi, arsye, statusi: ne_shqyrtim | pranuar | refuzuar, item_id_i_krijuar / item_id_i_bashkuar)
- Kërkim me `pg_trgm` mbi emër + sinonime.

**Kërkesat**
- `requests` (id, numer unik, school_year_id, teacher_id, konteksti: teori_pergjithshme | teori_profesionale | praktike_profesionale | kujdestari | laborator, class_group_id, subject_id nullable, curriculum_id, laboratory_id nullable, department_id (i derivuar), statusi, arsyetimi, krijuar/derguar_me)
- Statuset: `draft → derguar → (kthyer_per_korrigjim → derguar) → miratuar | miratuar_pjeserisht | refuzuar → ne_permbushje → permbushur | mbyllur`
- `request_lines` (request_id, item_id FK NOT NULL, sasia >0, cmim_njesi NULL, vlera GENERATED = sasia*cmim_njesi (NULL nëse çmimi NULL), sasia_miratuar NULL, sasia_dorezuar default 0, shenim; unik (request_id, item_id))
- `request_decisions` (request_id, vendimi, arsye – e detyrueshme për refuzim/kthim, vendosur_nga, kur)
- `request_comments` (request_id, autor, lloji: koment | rekomandim, tekst)
- `request_status_history` (request_id, nga, ne, nga_kush, kur) – trigger automatik
- Trigger validimi: mësuesi duhet të ketë caktim aktiv që përputhet (mësim → teaching_assignments; kujdestari → homeroom; laborator → lab_assignments).

**Magazina**
- `stock_balances` (item_id PK, sasia ≥ 0, perditesuar_me) – vetëm lexim për klientin
- `stock_movements` (id, item_id, lloji: inventar_fillestar | hyrje | dalje | kthim | korrigjim, sasia (me shenjë), cmim_njesi NULL, request_line_id nullable, dokument_id, arsye – e detyrueshme për korrigjim, kryer_nga, kur) – append-only (pa UPDATE/DELETE; korrigjimi = lëvizje e re)
- RPC `record_stock_movement(...)`: kontroll roli, bllokim rreshti i bilancit, refuzim nëse bilanci bëhet negativ, insert lëvizje, update bilanc, update `sasia_dorezuar`, audit – në një transaksion.

**Të tjera**
- `notifications` (user_id, lloji, titulli, link, lexuar_me)
- `documents` (bucket privat `dokumente`, path, lloji, lidhur me request/movement/curriculum, ngarkuar_nga)
- `audit_log` (tabela, rekordi_id, veprimi, te_vjetra jsonb, te_rejat jsonb, user_id, kur) – trigger gjenerik, vetëm insert.
- `import_batches` (lloji, skedari, statusi, rreshta_ok, rreshta_gabim, raport_gabimesh jsonb)

## 4. RLS (përmbledhje)

- Të gjitha tabelat: RLS aktiv + GRANT-e eksplicite për `authenticated`; asgjë për `anon`.
- Konfigurimi (vite, departamente, kurrikula, klasa, lëndë, katalog): lexim nga të gjithë të kyçurit; shkrim vetëm admin.
- `requests`/`request_lines`: mësuesi sheh të vetat; shefi sheh ato me `department_id` të tij; admin dhe magazinier të gjitha. Mësuesi redakton vetëm në `draft`/`kthyer_per_korrigjim`. Ndryshimet e statusit vetëm përmes RPC (`submit_request`, `decide_request`).
- Komentet: shefi vetëm në kërkesat e departamentit.
- `stock_*`: lexim admin, magazinier, shef (vetëm agregat); shkrim vetëm përmes RPC.
- `audit_log`: lexim vetëm admin.
- Storage: bucket privat, politika sipas pronarit/rolit, URL të nënshkruara.

## 5. Faqet

```text
/auth                      Hyrje, harruar fjalëkalimin, /reset-password
/paneli                    Dashboard sipas roleve (ndryshon për çdo rol)
/kerkesat, /kerkesat/re, /kerkesat/$id
/miratime                  (admin) radha e shqyrtimit
/departamenti              (shef) kërkesat dhe komentet e departamentit
/katalogu, /katalogu/sugjerime
/magazina, /magazina/levizje, /magazina/hyrje|dalje|kthim|korrigjim
/raportet                  8 eksportet .xlsx
/importe                   parapamje, validim, raport gabimesh
/konfigurim/*              (admin) vite, departamente, kurrikula, klasa, lëndë, mësues, caktime, laboratorë, përdorues/ftesa
/njoftimet, /auditimi
```

Përdoruesi me disa role zgjedh rolin aktiv në shiritin e sipërm.

## 6. Excel

- Librari: `exceljs` në funksione serveri (e përputhshme me Workers).
- Raportet: 1) Kërkesat e detajuara 2) Artikujt e konsoliduar (GROUP BY item_id) 3) Gjendja e magazinës 4) Regjistri hyrje-dalje 5) Mungesat (miratuar − dorëzuar, stok − kërkesë e hapur) 6) Sipas mësuesit 7) Sipas kurrikulës/profilit 8) Katalogu.
- Formati: header i trashë me ngjyrë, autofilter, freeze panes, data `dd.mm.yyyy`, `#,##0 "Lek"`, çmimi NULL = qelizë bosh, fletë "Përmbledhje" + "Filtrat e aplikuar".
- Importet: mësues, caktime, klasa, katalog, inventar fillestar. Hapat: ngarkim → parapamje → validim për rresht → konfirmim → raport gabimesh .xlsx.

## 7. Migrimet

1. `001_extensions_enums` (pg_trgm, citext, enum-et)
2. `002_academic` (vite, departamente, kurrikula, lëndë, klasa, laboratorë)
3. `003_people_roles` (teachers, profiles, user_roles, caktimet, funksionet e roleve)
4. `004_catalog` (kategori, njësi, items, sinonime, sugjerime)
5. `005_requests` (kërkesat, rreshtat, vendimet, komentet, historiku, RPC, trigger validimi)
6. `006_inventory` (bilance, lëvizje, RPC transaksional, mbrojtje append-only)
7. `007_notifications_documents_audit` (+ bucket privat)
8. `008_rls_policies`
9. `009_seed` – vetëm të dhëna të konfirmuara: viti 2026–2027, 2 departamentet, kurrikulat e konfirmuara, mësuesit nga Excel (pa email), rolet e drejtuesve të paraqitura si "Për konfigurim" deri në ftesë, njësitë bazë. Çdo seed i dokumentuar në `supabase/seed/README.md`.

## 8. Fazat, kriteret e pranimit dhe testet

**F1 – Auth, role, RLS, të dhëna bazë**
Pranimi: regjistrimi publik i fikur; admin fton me email; role të shumëfishta; konfigurimi i klasave/kurrikulave i redaktueshëm.
Teste: përdorues i paftuar s'hyn; mësuesi s'shkruan në konfigurim; shefi TIK s'lexon të dhëna Elektroteknike (test SQL me `set role` + JWT).

**F2 – Katalogu**
Pranimi: kërkim me sinonime; dublikati emër+specifikim+njësi refuzohet; sugjerimet shqyrtohen dhe bashkohen.
Teste: insert dublikat dështon; "Rezistencë 1kΩ copë" ≠ "Rezistencë 1kΩ pako".

**F3 – Kërkesat**
Pranimi: kërkesë vetëm brenda caktimeve aktive; çmim NULL mbetet bosh; vlera llogaritet; miratim i plotë/pjesshëm, kthim, refuzim me arsye; historik dhe komente shefi.
Teste: kërkesë për klasë pa caktim refuzohet; kujdestari pa caktim refuzohet; redaktim pas dërgimit bllokohet.

**F4 – Magazina**
Pranimi: kërkesa nuk ndryshon stokun; çdo lëvizje përmes RPC; përmbushje e pjesshme; historiku pa fshirje.
Teste: dalje > bilanc refuzohet; UPDATE/DELETE në `stock_movements` dështon; bilanci = shuma e lëvizjeve.

**F5 – Excel**
Pranimi: 8 raportet me formatimin e kërkuar; konsolidim sipas item_id; eksporti i shefit përmban vetëm departamentin e tij; importet me raport gabimesh.
Teste: hapja e skedarëve me openpyxl dhe kontroll i filtrave, freeze, formateve; import me rreshta të gabuar.

**F6 – Dashboard, njoftime, auditim**
Pranimi: 4 dashboard të ndryshëm; njoftime për dërgim/vendim/dorëzim; auditimi i lexueshëm nga admin.
Teste end-to-end me Playwright për çdo rol mbi llogari testuese reale.

Asnjë modul nuk shënohet funksional pa kaluar testet e fazës së tij.

## 9. Çfarë na duhet nga ju

- Dokumenti i specifikimit "Arkitekturë dhe Prompt Lovable".
- Lista e plotë e 12 skeletkurrikulave dhe 37 grupeve të klasave (ose konfirmim që i fut admini).
- Email-i i Silvana Kasemit për ftesën e parë të administratores.
