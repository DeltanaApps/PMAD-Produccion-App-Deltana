-- Corrects 20261111120000_administrador_fichaje_write_access.sql: the role
-- that actually needs to persist the weekly multi-project fichaje import is
-- "administracion" (Kristel -- the accounting role, manages client
-- invoicing across every project), not "administrador" (the role-management
-- role, who only assigns roles when an account is created and was never
-- meant to have business-data write access). Swaps the role in each of the
-- four write policies touched by updateProjectWithMembers.

drop policy team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (public.current_app_role() in ('direccion', 'gestor', 'administracion'));

drop policy team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update to authenticated
  using (public.current_app_role() in ('direccion', 'gestor', 'administracion'))
  with check (public.current_app_role() in ('direccion', 'gestor', 'administracion'));

drop policy project_members_write on public.project_members;
create policy project_members_write on public.project_members
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administracion')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administracion');

drop policy project_time_logs_write on public.project_time_logs;
create policy project_time_logs_write on public.project_time_logs
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administracion')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administracion');

drop policy project_time_log_uploads_write on public.project_time_log_uploads;
create policy project_time_log_uploads_write on public.project_time_log_uploads
  for all to authenticated
  using (public.is_project_manager(project_id) or public.current_app_role() = 'administracion')
  with check (public.is_project_manager(project_id) or public.current_app_role() = 'administracion');
