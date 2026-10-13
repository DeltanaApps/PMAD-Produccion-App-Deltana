import { supabase } from '../supabaseClient';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateProfileRole(userId: string, role: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

export async function updateProfileActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ active }).eq('id', userId);
  if (error) throw error;
}

export async function fetchInactiveProfilesCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('active', false);
  if (error) throw error;
  return count ?? 0;
}

export interface PendingRoleAssignment {
  email: string;
  role: string;
  name: string | null;
  created_at: string;
}

export async function fetchPendingAssignments(): Promise<PendingRoleAssignment[]> {
  const { data, error } = await supabase
    .from('pending_role_assignments')
    .select('email, role, name, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPendingAssignment(email: string, role: string, name?: string): Promise<void> {
  const { error } = await supabase
    .from('pending_role_assignments')
    .upsert({ email: email.trim().toLowerCase(), role, name: name || null });
  if (error) throw error;
}

export async function deletePendingAssignment(email: string): Promise<void> {
  const { error } = await supabase.from('pending_role_assignments').delete().eq('email', email);
  if (error) throw error;
}

async function unwrapFunctionError(error: unknown): Promise<never> {
  // Supabase JS wraps the function's JSON error body inside `error.context`
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const body = await context.json();
      throw new Error(body.error ?? (error as Error).message);
    } catch {
      throw error;
    }
  }
  throw error;
}

export async function createUser(
  email: string,
  password: string,
  role: string,
  name?: string
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { email, password, role, name },
  });
  if (error) return unwrapFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { action: 'reset_password', userId, newPassword },
  });
  if (error) return unwrapFunctionError(error);
  if (data?.error) throw new Error(data.error);
}
