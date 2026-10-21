
import React, { useRef } from 'react';
import { DashboardIcon, ProjectsIcon, TeamIcon, ClientsIcon, CollaboratorsIcon, CalendarIcon, DownloadIcon, UploadIcon, BriefcaseIcon, TrendingUpIcon, SettingsIcon } from './ui/Icons';
import type { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  lastDataUpdate: string | null;
  canViewExecutiveDashboard?: boolean;
  isAdministracion?: boolean;
  pendingApprovalCount?: number;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
}> = ({ icon, label, isActive, onClick, badgeCount }) => {
  const isLongLabel = label.length > 20;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center w-full px-4 py-3 text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-sky-500 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      <span className="relative inline-flex flex-shrink-0">
        {icon}
        {!!badgeCount && (
          <span
            className="md:hidden absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
            title={`${badgeCount} cuenta(s) esperando aprobación`}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </span>
      <span className={`ml-4 hidden md:inline text-left leading-tight ${isLongLabel ? 'text-[11px]' : ''}`}>{label}</span>
      {!!badgeCount && (
        <span className="ml-auto hidden md:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onExportData, onImportData, lastDataUpdate, canViewExecutiveDashboard, isAdministracion, pendingApprovalCount }) => {
  const iconClass = "h-6 w-6";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportData(file);
    }
    // Reset value to allow uploading the same file again if needed
    if (event.target) event.target.value = '';
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-16 md:w-64 bg-gray-800 text-white flex flex-col z-10 shadow-lg">
      <div className="flex items-center justify-center md:justify-start md:px-4 h-20 border-b border-gray-700">
        {/* Collapsed (icon-only) width: just the logo's icon mark */}
        <div className="md:hidden h-10 w-10 rounded-md bg-white flex items-center justify-center p-1">
          <img src="/images/logo-deltana-icon.png" alt="Deltana Engineering" className="h-full w-auto" />
        </div>
        {/* Expanded width: full logo lockup */}
        <div className="hidden md:flex bg-white rounded-md px-2 py-1.5">
          <img src="/images/logo-deltana.png" alt="Deltana Engineering" className="h-8 w-auto" />
        </div>
      </div>
      <nav className="flex-1 mt-6 overflow-y-auto">
        {!canViewExecutiveDashboard && (
          <NavItem
            icon={<DashboardIcon className={iconClass} />}
            label="Dashboard"
            isActive={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
          />
        )}
        {canViewExecutiveDashboard && (
          <NavItem
            icon={<TrendingUpIcon className={iconClass} />}
            label="Dashboard Ejecutivo"
            isActive={currentView === 'executive-dashboard'}
            onClick={() => setCurrentView('executive-dashboard')}
          />
        )}
        <NavItem
          icon={<ProjectsIcon className={iconClass} />}
          label={canViewExecutiveDashboard ? 'Proyectos' : 'Mis Proyectos'}
          isActive={currentView === 'projects'}
          onClick={() => setCurrentView('projects')}
        />
        {!canViewExecutiveDashboard && (
          <NavItem
            icon={<CalendarIcon className={iconClass} />}
            label="Planificación"
            isActive={currentView === 'planning'}
            onClick={() => setCurrentView('planning')}
          />
        )}
        {!canViewExecutiveDashboard && (
          <NavItem
            icon={<BriefcaseIcon className={iconClass} />}
            label="Gestión de Recursos Internos"
            isActive={currentView === 'internal-team'}
            onClick={() => setCurrentView('internal-team')}
          />
        )}
        <NavItem
          icon={<TeamIcon className={iconClass} />}
          label="Recursos"
          isActive={currentView === 'team'}
          onClick={() => setCurrentView('team')}
        />
        <NavItem
          icon={<ClientsIcon className={iconClass} />}
          label={canViewExecutiveDashboard ? 'Clientes' : 'Mis Clientes'}
          isActive={currentView === 'clients'}
          onClick={() => setCurrentView('clients')}
        />
        <NavItem
          icon={<CollaboratorsIcon className={iconClass} />}
          label="Gestión de Recursos Externos"
          isActive={currentView === 'collaborators'}
          onClick={() => setCurrentView('collaborators')}
        />
        <NavItem
          icon={<DashboardIcon className={iconClass} />}
          label="Seguimiento Económico"
          isActive={currentView === 'economic-tracking'}
          onClick={() => setCurrentView('economic-tracking')}
        />
        {isAdministracion && (
          <NavItem
            icon={<SettingsIcon className={iconClass} />}
            label="Administración"
            isActive={currentView === 'administration'}
            onClick={() => setCurrentView('administration')}
            badgeCount={pendingApprovalCount}
          />
        )}
      </nav>

      {/* Backup Controls */}
      {!canViewExecutiveDashboard && (
        <div className="p-4 border-t border-gray-700 hidden md:block bg-gray-900/50">
            <p className="text-[10px] text-sky-400 uppercase font-bold mb-3 tracking-wider">Sincronización (OneDrive)</p>

            <div className="flex flex-col gap-3">
              <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center w-full px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded transition-all shadow-lg hover:scale-105 active:scale-95"
                  title="Buscar archivo en OneDrive/PC"
              >
                  <UploadIcon className="h-4 w-4 mr-2" />
                  ABRIR DATOS
              </button>
              <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".json"
                  onChange={handleFileChange}
              />

              <button
                  onClick={onExportData}
                  className="flex items-center justify-center w-full px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-all shadow-lg hover:scale-105 active:scale-95"
                  title="Descargar archivo para guardar en OneDrive"
              >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  GUARDAR DATOS
              </button>
            </div>

            {lastDataUpdate && (
               <div className="mt-3 text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest">Datos del:</p>
                  <p className="text-[10px] text-sky-300 font-mono">{lastDataUpdate}</p>
               </div>
            )}

            {!lastDataUpdate && (
              <p className="text-[10px] text-gray-500 mt-3 text-center leading-tight">
                  No has cargado copia de seguridad.
              </p>
            )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
