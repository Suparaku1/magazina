<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- UI is entirely in Albanian; keep all user-facing copy in Albanian.
- Roles live only in `public.user_roles` (multiple per user); department heads are scoped by `department_id`. Why: avoids privilege escalation and supports multi-role staff.
- Public signup is disabled; accounts are created only via the admin `inviteUser` server function. Why: invite-only internal system.
- Admin account creation may set an initial password through the authenticated inviteUser function; never persist it in source. Why: supports explicitly requested staff credentials without opening signup.
- Teacher accounts link to `public.teachers` by email in the `handle_new_user` trigger, which also applies `pending_role_grants`. Why: roles can be pre-assigned before an email is known.
- All exposed tables have RLS; config tables are readable by signed-in users and writable only by admin. Why: least privilege enforced in the database, not the UI.
- Every config/role table has the generic `audit_trigger`; `audit_log` is read-only for admin. Why: full change history.
- Admin config CRUD is driven by `src/lib/config-sections.ts`. Why: one generic editor for all base data.
- Missing real-world data is stored as NULL and shown as "Për konfigurim"; never invent emails, surnames or assignments.
- Implementation proceeds in phases per the approved plan in `.lovable/plan/`.
- Catalog duplicates are blocked by a unique index on normalized (emer, specifikime, unit_id); items with different units or specs stay separate. Why: request lines link by item_id, never by text.
- Catalog search goes through the `search_items` RPC (name, code, spec, synonyms, trigram); suggestion review only through `review_suggestion`. Why: one consistent search and an atomic, admin-checked review.
- Unknown prices are NULL, never 0. Why: zero would distort totals and reports.
- Request status changes only through `submit_request` / `decide_request` (they set `app.rpc`); triggers block direct status edits and teacher writes to approved/delivered quantities. Why: workflow integrity enforced in the database.
- `requests_validate` trigger requires a matching active assignment (teaching/homeroom/lab) and derives curriculum and department. Why: teachers can only request within their own assignments.
- The `requests` SELECT policy uses row columns directly (not `can_view_request`), so INSERT ... RETURNING works; child tables use `can_view_request`. Why: a subquery cannot see the row being inserted.
- Stock changes only through the `record_stock_movement` RPC (role check, row lock, no negative balance, updates delivered qty and request status); `stock_movements` is append-only, errors are fixed with a new `korrigjim`. Why: auditable warehouse history.
- Excel data is fetched through authenticated server functions with the user's RLS client and paginated reads; workbook processing uses ExcelJS in memory. Why: exports preserve access boundaries and do not truncate at the Data API row limit.
- Excel imports are admin-only, validated again on the server, and initial inventory imports call record_stock_movement per row. Why: file input cannot bypass catalog constraints or stock audit rules.
- Confirmed Excel imports use commit_excel_import to persist all rows and the batch log in one transaction. Why: failed imports must not leave partial data or unaudited stock.
- Dashboard totals use a SECURITY INVOKER aggregate RPC and notification recipients are resolved by transactional workflow triggers; clients can only mark their own readable notifications. Why: metrics preserve RLS and alerts cannot be forged.
