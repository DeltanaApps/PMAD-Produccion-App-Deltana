import { supabase } from '../supabaseClient';
import type { TeamMember } from '../../types';
import { MemberType } from '../../types';
import { MEMBER_TYPE_TO_DB } from '../enumMappers';

export async function saveNewCollaborator(data: Omit<TeamMember, 'type'>): Promise<void> {
  const { error } = await supabase.from('team_members').insert({
    contact: data.contact,
    name: data.name,
    company: data.company ?? null,
    member_type: MEMBER_TYPE_TO_DB[MemberType.External],
    internal_member_type: data.internalMemberType ?? null,
  });
  if (error) throw error;
}

export async function updateMemberName(contact: string, newName: string): Promise<void> {
  const { error } = await supabase.from('team_members').update({ name: newName }).eq('contact', contact);
  if (error) throw error;
}

export async function updateMemberContact(contact: string, newContact: string): Promise<void> {
  const { error } = await supabase.from('team_members').update({ contact: newContact }).eq('contact', contact);
  if (error) throw error;
}

export async function updateGlobalRate(contact: string, rate: number): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ default_hourly_rate: rate })
    .eq('contact', contact);
  if (error) throw error;
}

export async function updateInternalMemberType(contact: string, type: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ internal_member_type: type })
    .eq('contact', contact);
  if (error) throw error;
}

// Removes the person from every project roster (satisfies the FK from
// project_members) and then deletes the global catalog row, matching the
// original localStorage behaviour of wiping them out everywhere.
export async function deleteGlobalMember(contact: string): Promise<void> {
  const { data: member, error: findError } = await supabase
    .from('team_members')
    .select('id')
    .eq('contact', contact)
    .single();
  if (findError) throw findError;

  const { error: removeFromProjectsError } = await supabase
    .from('project_members')
    .delete()
    .eq('team_member_id', member.id);
  if (removeFromProjectsError) throw removeFromProjectsError;

  const { error: deleteError } = await supabase.from('team_members').delete().eq('id', member.id);
  if (deleteError) throw deleteError;
}
