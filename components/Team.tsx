
import React, { useMemo, useState } from 'react';
import type { Project, TeamMember } from '../types';
import { MemberType, ProjectStatus } from '../types';
import TeamMemberModal from './TeamMemberModal';
import { PencilIcon, TrashIcon, PlusIcon } from './ui/Icons';

interface TeamProps {
  projects: Project[];
  internalRates: Record<string, number>;
  // Full shared catalog (every gestor's internal + external resources),
  // merged with the per-project info derived from `projects` below so every
  // gestor sees everyone, not just whoever's on their own projects.
  teamMembersCatalog: TeamMember[];
  onUpdateRate?: (contact: string, rate: number) => void;
  onUpdateMemberType?: (contact: string, type: string) => void;
  onUpdateMemberName?: (contact: string, newName: string) => void;
  onUpdateMemberContact?: (contact: string, newContact: string) => Promise<void>;
  // Deletes a member already known to be on one of MY OWN projects (shown
  // with a plain confirm; optimistic, matches the original behaviour).
  onDeleteMember?: (contact: string) => void;
  // Deletes a member with zero projects visible to ME -- might be globally
  // unassigned, or might actually be on another gestor's project I can't
  // see. Awaits the server so a blocked delete (RLS + the FK from
  // project_members to team_members) surfaces clearly instead of the UI
  // optimistically pretending it worked.
  onDeleteCatalogMember?: (contact: string) => Promise<void>;
  onAddCollaborator?: () => void;
}

interface MemberProjectSummary {
    name: string;
    active: boolean; // Member active status in project
    projectStatus: ProjectStatus;
}

type ResourceRow = TeamMember & { projects: MemberProjectSummary[] };

const countActivity = (member: ResourceRow) => {
  const activeCount = member.projects.filter(p => p.active && p.projectStatus !== ProjectStatus.Completed).length;
  const inactiveCount = member.projects.length - activeCount;
  return { activeCount, inactiveCount };
};

type ActivityFilter = 'all' | 'active' | 'inactive';
type SortKey = 'name' | 'role' | 'contact' | 'active' | 'inactive';
type SortDir = 'asc' | 'desc';

const Team: React.FC<TeamProps> = ({
  projects,
  internalRates,
  teamMembersCatalog,
  onUpdateRate,
  onUpdateMemberType,
  onUpdateMemberName,
  onUpdateMemberContact,
  onDeleteMember,
  onDeleteCatalogMember,
  onAddCollaborator,
}) => {
  const [selectedMember, setSelectedMember] = useState<ResourceRow | null>(null);
  const [activeCategory, setActiveCategory] = useState<'internal' | 'external' | null>(null);

  const { internalMembers, externalMembers } = useMemo(() => {
    const memberMap = new Map<string, ResourceRow>();

    projects.forEach(project => {
      project.team.forEach(member => {
        const projectSummary: MemberProjectSummary = {
            name: project.name,
            active: member.active !== false, // Defaults to true if undefined
            projectStatus: project.status
        };

        if (memberMap.has(member.contact)) {
          memberMap.get(member.contact)!.projects.push(projectSummary);
        } else {
          memberMap.set(member.contact, { ...member, projects: [projectSummary] });
        }
      });
    });

    // Merge in the full shared catalog so every gestor sees every resource,
    // even ones with zero projects visible to them.
    teamMembersCatalog.forEach(m => {
      if (!memberMap.has(m.contact)) {
        memberMap.set(m.contact, { ...m, projects: [] });
      }
    });

    const all = Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      internalMembers: all.filter(m => m.type === MemberType.Internal),
      externalMembers: all.filter(m => m.type === MemberType.External),
    };
  }, [projects, teamMembersCatalog]);

  // Raw delete with no confirm/alert of its own -- callers (the table row's
  // click handler, or the modal's own confirm+error UI) own that part.
  const deleteMemberRaw = async (member: ResourceRow): Promise<void> => {
    if (member.projects.length > 0) {
      onDeleteMember?.(member.contact);
      return;
    }
    if (!onDeleteCatalogMember) return;
    // A member with zero projects visible to me might be globally
    // unassigned, or might just be on another gestor's project I can't see
    // -- either way, this is the safer, server-confirmed path.
    await onDeleteCatalogMember(member.contact);
  };

  const handleDeleteRow = async (member: ResourceRow) => {
    if (!window.confirm(`¿Eliminar definitivamente a "${member.name}" de Recursos?`)) return;
    try {
      await deleteMemberRaw(member);
    } catch (err: any) {
      alert(
        err?.code === '23503'
          ? 'Este recurso participa en un proyecto de otro gestor que no podés ver, así que no se puede eliminar desde acá.'
          : 'No se pudo eliminar el recurso.'
      );
    }
  };

  const canDeleteRow = (member: ResourceRow) => (member.projects.length > 0 ? !!onDeleteMember : !!onDeleteCatalogMember);

  const renderTeamTable = (members: ResourceRow[]) => {
    if (members.length === 0) {
      return <p className="text-gray-500 px-6 py-4">No hay miembros en esta categoría.</p>;
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
            <table className="min-w-full">
            <thead className="bg-gray-700/50">
                <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Nombre
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Tipo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Rol
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Contacto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Proyectos
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Acciones
                </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {members.map((member, index) => {
                    const { activeCount, inactiveCount } = countActivity(member);

                    return (
                        <tr key={index} className="hover:bg-gray-700/40 transition-colors duration-150">
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0 bg-gray-600 rounded-full flex items-center justify-center font-bold text-white">
                                    {member.name.split(' ').map(n=>n[0]).join('')}
                                </div>
                                <div className="ml-4">
                                    <button onClick={() => setSelectedMember(member)} className="text-sm font-medium text-white hover:text-sky-400 text-left transition-colors">
                                        {member.name}
                                    </button>
                                    {member.company && <div className="text-xs text-gray-400">{member.company}</div>}
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                {member.type === MemberType.Internal ? (member.internalMemberType || 'Recurso Interno') : 'Recurso Externo'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.role}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-400">
                                <a href={`mailto:${member.contact}`} className="hover:underline">{member.contact}</a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <button onClick={() => setSelectedMember(member)} className="flex gap-3 hover:underline" title="Ver proyectos">
                                    <span className="text-green-400 font-medium" title="Proyectos Activos En Curso">{activeCount} Activos</span>
                                    <span className="text-gray-500">/</span>
                                    <span className="text-gray-400" title="Proyectos Finalizados o Inactivos">{inactiveCount} Históricos</span>
                                </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                <button
                                    onClick={() => setSelectedMember(member)}
                                    className="text-gray-500 hover:text-sky-400 p-1.5 rounded hover:bg-gray-700/60 transition-colors"
                                    title="Editar"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                {canDeleteRow(member) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRow(member);
                                        }}
                                        className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-gray-700/60 transition-colors"
                                        title="Eliminar de Recursos"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
            </table>
        </div>
    );
  };

  const addButton = onAddCollaborator ? (
    <button
      onClick={onAddCollaborator}
      className="flex items-center gap-2 bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium"
    >
      <PlusIcon className="w-4 h-4"/>
      Añadir Recurso Externo
    </button>
  ) : null;

  if (activeCategory) {
    const members = activeCategory === 'internal' ? internalMembers : externalMembers;
    const title = activeCategory === 'internal' ? 'Recursos Internos' : 'Recursos Externos';
    return (
      <div>
        <button onClick={() => setActiveCategory(null)} className="text-sky-400 hover:text-sky-300 text-sm mb-4 flex items-center gap-1">
          ← Volver a Recursos
        </button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {activeCategory === 'external' && addButton}
        </div>
        <ResourceGrid
          members={members}
          onSelectMember={setSelectedMember}
          onDeleteRow={handleDeleteRow}
          canDeleteRow={canDeleteRow}
        />
        {selectedMember && (
          <TeamMemberModalWrapper
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            projects={projects}
            internalRates={internalRates}
            onUpdateRate={onUpdateRate}
            onUpdateMemberType={onUpdateMemberType}
            onUpdateMemberName={onUpdateMemberName}
            onUpdateMemberContact={onUpdateMemberContact}
            onDeleteMember={canDeleteRow(selectedMember) ? () => deleteMemberRaw(selectedMember) : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-white">Recursos</h1>

      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-sky-400 flex items-center gap-3">
            <span className="w-3 h-3 bg-sky-400 rounded-full"></span>
            <button onClick={() => setActiveCategory('internal')} className="hover:underline">Recursos Internos</button>
          </h2>
          {renderTeamTable(internalMembers)}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 text-purple-400 flex items-center gap-3">
             <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
            <button onClick={() => setActiveCategory('external')} className="hover:underline">Recursos Externos</button>
            <span className="ml-auto">{addButton}</span>
          </h2>
          {renderTeamTable(externalMembers)}
        </div>
      </div>

      {selectedMember && (
        <TeamMemberModalWrapper
          selectedMember={selectedMember}
          setSelectedMember={setSelectedMember}
          projects={projects}
          internalRates={internalRates}
          onUpdateRate={onUpdateRate}
          onUpdateMemberType={onUpdateMemberType}
          onUpdateMemberName={onUpdateMemberName}
          onUpdateMemberContact={onUpdateMemberContact}
          onDeleteMember={canDeleteRow(selectedMember) ? () => deleteMemberRaw(selectedMember) : undefined}
        />
      )}
    </div>
  );
};

// Shared wiring for the detail/edit modal, used from both the default view
// and the drilled-in category grid.
const TeamMemberModalWrapper: React.FC<{
  selectedMember: ResourceRow;
  setSelectedMember: (m: ResourceRow | null) => void;
  projects: Project[];
  internalRates: Record<string, number>;
  onUpdateRate?: (contact: string, rate: number) => void;
  onUpdateMemberType?: (contact: string, type: string) => void;
  onUpdateMemberName?: (contact: string, newName: string) => void;
  onUpdateMemberContact?: (contact: string, newContact: string) => Promise<void>;
  onDeleteMember?: () => Promise<void>;
}> = ({ selectedMember, setSelectedMember, projects, internalRates, onUpdateRate, onUpdateMemberType, onUpdateMemberName, onUpdateMemberContact, onDeleteMember }) => (
  <TeamMemberModal
    member={selectedMember as any}
    projects={projects}
    internalRate={internalRates[selectedMember.contact]}
    onUpdateRate={selectedMember.type === MemberType.Internal && onUpdateRate ? (rate) => onUpdateRate(selectedMember.contact, rate) : undefined}
    onUpdateMemberType={selectedMember.type === MemberType.Internal && onUpdateMemberType ? (type) => onUpdateMemberType(selectedMember.contact, type) : undefined}
    onUpdateMemberName={onUpdateMemberName ? (newName) => {
      onUpdateMemberName(selectedMember.contact, newName);
      setSelectedMember({ ...selectedMember, name: newName });
    } : undefined}
    onUpdateMemberContact={onUpdateMemberContact ? async (newContact) => {
      await onUpdateMemberContact(selectedMember.contact, newContact);
      setSelectedMember({ ...selectedMember, contact: newContact });
    } : undefined}
    onDeleteMember={onDeleteMember}
    onClose={() => setSelectedMember(null)}
  />
);

// The dedicated, filterable/sortable grid shown when drilling into one
// category (Internos or Externos) -- meant for scanning a long list to see
// who's available and how active they are, not just a quick glance.
const ResourceGrid: React.FC<{
  members: ResourceRow[];
  onSelectMember: (m: ResourceRow) => void;
  onDeleteRow: (m: ResourceRow) => void;
  canDeleteRow: (m: ResourceRow) => boolean;
}> = ({ members, onSelectMember, onDeleteRow, canDeleteRow }) => {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo(() => {
    const withCounts = members.map(member => ({ member, ...countActivity(member) }));

    const filtered = withCounts.filter(row => {
      if (activityFilter === 'active') return row.activeCount > 0;
      if (activityFilter === 'inactive') return row.activeCount === 0;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortKey) {
        case 'role':
          return a.member.role.localeCompare(b.member.role) * dir;
        case 'contact':
          return a.member.contact.localeCompare(b.member.contact) * dir;
        case 'active':
          return (a.activeCount - b.activeCount) * dir;
        case 'inactive':
          return (a.inactiveCount - b.inactiveCount) * dir;
        default:
          return a.member.name.localeCompare(b.member.name) * dir;
      }
    });

    return filtered;
  }, [members, activityFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => (key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const headerButton = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th
      scope="col"
      className={`px-6 py-3 text-${align} text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer select-none hover:text-white`}
      onClick={() => toggleSort(key)}
    >
      {label}{sortIndicator(key)}
    </th>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-gray-400 uppercase font-semibold">Filtrar:</label>
        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        >
          <option value="all">Todos ({members.length})</option>
          <option value="active">En actividad</option>
          <option value="inactive">Sin actividad</option>
        </select>
        <span className="text-xs text-gray-500">{rows.length} de {members.length} recursos</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 px-6 py-4">No hay recursos que coincidan con el filtro.</p>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
            <table className="min-w-full">
            <thead className="bg-gray-700/50">
                <tr>
                {headerButton('name', 'Nombre')}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo</th>
                {headerButton('role', 'Rol')}
                {headerButton('contact', 'Contacto')}
                {headerButton('active', 'Activos')}
                {headerButton('inactive', 'Históricos')}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {rows.map(({ member, activeCount, inactiveCount }, index) => (
                    <tr key={index} className="hover:bg-gray-700/40 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-9 w-9 flex-shrink-0 bg-gray-600 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                    {member.name.split(' ').map(n=>n[0]).join('')}
                                </div>
                                <div className="ml-3">
                                    <button onClick={() => onSelectMember(member)} className="text-sm font-medium text-white hover:text-sky-400 text-left transition-colors">
                                        {member.name}
                                    </button>
                                    {member.company && <div className="text-xs text-gray-400">{member.company}</div>}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {member.type === MemberType.Internal ? (member.internalMemberType || 'Recurso Interno') : 'Recurso Externo'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-400">
                            <a href={`mailto:${member.contact}`} className="hover:underline">{member.contact}</a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 font-medium">{activeCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{inactiveCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                                onClick={() => onSelectMember(member)}
                                className="text-gray-500 hover:text-sky-400 p-1.5 rounded hover:bg-gray-700/60 transition-colors"
                                title="Editar"
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            {canDeleteRow(member) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteRow(member); }}
                                    className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-gray-700/60 transition-colors"
                                    title="Eliminar de Recursos"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default Team;
