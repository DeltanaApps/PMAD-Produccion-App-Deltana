
import React from 'react';
import type { Project } from '../types';
import { ProjectStatus } from '../types';
import Card from './ui/Card';
import { MailIcon, EyeIcon, ClientsIcon, CollaboratorsIcon, BriefcaseIcon } from './ui/Icons';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onView?: (project: Project) => void;
  readOnly?: boolean;
  onNavigateToClient?: (project: Project) => void;
  onNavigateToExternalTeam?: (project: Project) => void;
  onNavigateToInternalTeam?: (project: Project) => void;
}

const EditIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
    </svg>
);


const statusStyles = {
  [ProjectStatus.InProgress]: 'border-sky-500 bg-sky-500/10 text-sky-400',
  [ProjectStatus.Completed]: 'border-green-500 bg-green-500/10 text-green-400',
  [ProjectStatus.Proposal]: 'border-orange-500 bg-orange-500/10 text-orange-400',
};

const statusBadgeStyles = {
  [ProjectStatus.InProgress]: 'bg-sky-500/20 text-sky-300',
  [ProjectStatus.Completed]: 'bg-green-500/20 text-green-300',
  [ProjectStatus.Proposal]: 'bg-orange-500/20 text-orange-300',
};


const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onView, readOnly, onNavigateToClient, onNavigateToExternalTeam, onNavigateToInternalTeam }) => {
  return (
    <Card className={`border-l-4 ${statusStyles[project.status]}`}>
      <div className="flex justify-between items-start">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{project.code}</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                    {project.client}
                </span>
            </div>
            <h3 className="text-lg font-bold text-gray-100 mb-2 pr-4">{project.name}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeStyles[project.status]}`}>
            {project.status}
          </span>
          {readOnly ? (
            onView && (
              <button onClick={() => onView(project)} className="text-gray-400 hover:text-white transition-colors" title="Ver detalle">
                <EyeIcon className="w-5 h-5" />
              </button>
            )
          ) : (
            <button onClick={() => onEdit(project)} className="text-gray-400 hover:text-white transition-colors" title="Editar">
              <EditIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">{project.statusDetail}</p>

      {(onNavigateToClient || onNavigateToExternalTeam || onNavigateToInternalTeam) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {onNavigateToClient && (
            <button
              onClick={() => onNavigateToClient(project)}
              className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 px-2 py-1 rounded-md transition-colors"
              title={`Ver cliente ${project.client}`}
            >
              <ClientsIcon className="w-3.5 h-3.5" />
              Cliente
            </button>
          )}
          {onNavigateToExternalTeam && (
            <button
              onClick={() => onNavigateToExternalTeam(project)}
              className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 px-2 py-1 rounded-md transition-colors"
              title="Ver Recursos Externos de este proyecto"
            >
              <CollaboratorsIcon className="w-3.5 h-3.5" />
              Rec. Externos
            </button>
          )}
          {onNavigateToInternalTeam && (
            <button
              onClick={() => onNavigateToInternalTeam(project)}
              className="flex items-center gap-1 text-[11px] font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 px-2 py-1 rounded-md transition-colors"
              title="Ver Recursos Internos de este proyecto"
            >
              <BriefcaseIcon className="w-3.5 h-3.5" />
              Rec. Internos
            </button>
          )}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Equipo:</h4>
        {project.team.length > 0 ? (
          <div className="flex -space-x-2 overflow-hidden">
            {project.team.slice(0, 5).map((member) => (
              <div 
                key={member.contact} 
                className="inline-block h-8 w-8 rounded-full ring-2 ring-gray-800 bg-gray-600 flex items-center justify-center text-xs font-bold text-white"
                title={member.name}
              >
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
            ))}
            {project.team.length > 5 && (
               <div className="inline-block h-8 w-8 rounded-full ring-2 ring-gray-800 bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                +{project.team.length - 5}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay equipo asignado.</p>
        )}
      </div>

      {/* Closing Email Indicator for Completed Projects */}
      {project.status === ProjectStatus.Completed && (
          <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center gap-2 text-xs">
               <MailIcon className="w-4 h-4 text-gray-500" />
               <span className="text-gray-400 font-medium">Correo Cierre:</span>
               {project.closingEmailSent ? (
                   <span className="text-green-400 flex items-center gap-1 font-bold bg-green-900/20 px-2 py-0.5 rounded">
                       Enviado ✓
                   </span>
               ) : (
                   <span className="text-red-400 flex items-center gap-1 font-bold bg-red-900/20 px-2 py-0.5 rounded">
                       Pendiente ✕
                   </span>
               )}
          </div>
      )}
    </Card>
  );
};

export default ProjectCard;
