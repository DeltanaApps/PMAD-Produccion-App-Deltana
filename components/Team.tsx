
import React, { useMemo, useState } from 'react';
import type { Project, TeamMember } from '../types';
import { MemberType, ProjectStatus } from '../types';
import TeamMemberModal from './TeamMemberModal';
import { PencilIcon, TrashIcon } from './ui/Icons';

interface TeamProps {
  projects: Project[];
  internalRates: Record<string, number>;
  onUpdateRate?: (contact: string, rate: number) => void;
  onUpdateMemberType?: (contact: string, type: string) => void;
  onUpdateMemberName?: (contact: string, newName: string) => void;
  onDeleteMember?: (contact: string) => void;
}

interface MemberProjectSummary {
    name: string;
    active: boolean; // Member active status in project
    projectStatus: ProjectStatus;
}

const Team: React.FC<TeamProps> = ({ projects, internalRates, onUpdateRate, onUpdateMemberType, onUpdateMemberName, onDeleteMember }) => {
  const [selectedMember, setSelectedMember] = useState<(TeamMember & { projects: MemberProjectSummary[] }) | null>(null);

  const { internalMembers, externalMembers } = useMemo(() => {
    const memberMap = new Map<string, TeamMember & { projects: MemberProjectSummary[] }>();
    
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

    const all = Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      internalMembers: all.filter(m => m.type === MemberType.Internal),
      externalMembers: all.filter(m => m.type === MemberType.External),
    };
  }, [projects]);
  
  const renderTeamTable = (members: (TeamMember & { projects: MemberProjectSummary[] })[]) => {
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
                    // Calculate Active vs Inactive
                    // Logic: "Active" means Project is NOT Completed AND Member is marked Active.
                    // Everything else is considered "Historical/Inactive" (either project finished or member finished).
                    const activeCount = member.projects.filter(p => p.active && p.projectStatus !== ProjectStatus.Completed).length;
                    const inactiveCount = member.projects.length - activeCount;

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
                                {onDeleteMember && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`¿Estás seguro de que deseas eliminar a "${member.name}" de Recursos?`)) {
                                                onDeleteMember(member.contact);
                                            }
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-white">Recursos</h1>

      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-sky-400 flex items-center gap-3">
            <span className="w-3 h-3 bg-sky-400 rounded-full"></span>
            Recursos Internos
          </h2>
          {renderTeamTable(internalMembers)}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 text-purple-400 flex items-center gap-3">
             <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
            Recursos Externos
          </h2>
          {renderTeamTable(externalMembers)}
        </div>
      </div>

      {selectedMember && (
        <TeamMemberModal 
          member={selectedMember as any} // Cast because the internal structure slightly differs in types but is compatible for display
          projects={projects}
          internalRate={internalRates[selectedMember.contact]}
          onUpdateRate={selectedMember.type === MemberType.Internal && onUpdateRate ? (rate) => onUpdateRate(selectedMember.contact, rate) : undefined}
          onUpdateMemberType={selectedMember.type === MemberType.Internal && onUpdateMemberType ? (type) => onUpdateMemberType(selectedMember.contact, type) : undefined}
          onUpdateMemberName={onUpdateMemberName ? (newName) => {
            onUpdateMemberName(selectedMember.contact, newName);
            setSelectedMember(prev => prev ? { ...prev, name: newName } : null);
          } : undefined}
          onClose={() => setSelectedMember(null)} 
        />
      )}
    </div>
  );
};

export default Team;
