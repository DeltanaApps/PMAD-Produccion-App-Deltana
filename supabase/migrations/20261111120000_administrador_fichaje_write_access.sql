-- Lets "administrador" (Kristel) actually persist the weekly multi-project
-- fichaje import from InternalTeam. She already has read access to every
-- project (20261015120500_administrador_role_split.sql), but every write
-- policy below still only allowed the owning gestor (is_project_manager),
-- so her saves were silently rejected by RLS even though the button worked.
--
-- updateProjectWithMembers (lib/api/projects.ts) -- the only thing
-- InternalTeam's "onUpdateProject" ever calls -- now only ever touches
-- team_members, project_members, project_time_logs and
-- project_time_log_uploads (see that function's comment). This grant is
-- scoped to exactly those four tables: 'administrador' still cannot write
-- to a project's core fields, contacts, partial deliveries, client
-- financials or invoices through any other screen.

drop policy team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (public.current_app_role() in ('direccion', 'gestor', 'administrador'));

drop policy team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update to authenticated
  using (public.current_app_role() in ('direccion', 'gestor', 'administrador'))
  with check (public.current_app_role() in ('direccion', 'gestor', 'administrador'));

drop policy project_members_write on public.project_members;
create policy project_members_write on public.project_members
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administrador')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administrador');

drop policy project_time_logs_write on public.project_time_logs;
create policy project_time_logs_write on public.project_time_logs
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administrador')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administrador');

drop policy project_time_log_uploads_write on public.project_time_log_uploads;
create policy project_time_log_uploads_write on public.project_time_log_uploads
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administrador')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administrador');
