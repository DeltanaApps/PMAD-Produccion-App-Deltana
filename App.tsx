
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Team from './components/Team';
import Clients from './components/Clients';
import Collaborators from './components/Collaborators';
import InternalTeam from './components/InternalTeam'; // New Import
import Planning from './components/Planning';
import EconomicTracking from './components/EconomicTracking';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import Administration from './components/Administration';
import Login from './components/Login';
import { SunIcon, MoonIcon } from './components/ui/Icons';
import type { View, Project, CollaboratorInfo, TeamMember, ClientInfo, InternalCostInfo } from './types';
import { MemberType } from './types';
import ProjectModal from './components/ProjectModal';
import ProjectDetailModal from './components/ProjectDetailModal';
import AddCollaboratorModal from './components/AddCollaboratorModal';
import ClientFinancialsModal from './components/ClientFinancialsModal';
import { supabase } from './lib/supabaseClient';
import {
  fetchProjects,
  fetchLoneCollaborators,
  fetchInternalRates,
  fetchCurrentProfile,
  fetchProjectManagers,
} from './lib/api/fetch';
import { updateMyThemePreference } from './lib/api/preferences';
import { fetchInactiveProfilesCount } from './lib/api/admin';
import {
  saveProject as apiSaveProject,
  deleteProject as apiDeleteProject,
  saveClientFinancials as apiSaveClientFinancials,
  saveCollaboratorFinancials as apiSaveCollaboratorFinancials,
  removeCollaboratorFromProject as apiRemoveCollaboratorFromProject,
  saveInternalFinancials as apiSaveInternalFinancials,
  updateProjectWithMembers as apiUpdateProjectWithMembers,
} from './lib/api/projects';
import {
  saveNewCollaborator as apiSaveNewCollaborator,
  updateMemberName as apiUpdateMemberName,
  updateGlobalRate as apiUpdateGlobalRate,
  updateInternalMemberType as apiUpdateInternalMemberType,
  deleteGlobalMember as apiDeleteGlobalMember,
} from './lib/api/teamMembers';

// Any background persistence failure gets logged + surfaced, but never
// rolls back the optimistic local state (matches the app's original
// "update state, then persist" feel; a stale write just means a refresh
// is needed to see the server's version again).
const ROLE_LABELS: Record<string, string> = {
  direccion: 'Dirección',
  administracion: 'Administración',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
};

const handlePersistError = (err: unknown) => {
  console.error('Error al guardar en Supabase:', err);
  alert('No se pudo guardar el cambio en el servidor. Los cambios pueden no haberse sincronizado — recargá la página para verificar.');
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [currentView, setCurrentView] = useState<View>('dashboard');

  // Light/dark theme — applied via a data-theme attribute (see theme-light.css);
  // components/ itself is never touched, this only affects the app shell after
  // login (the Login screen has its own permanent light design).
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // Light by default (matches profiles.theme_preference's DB default for
    // brand-new accounts) — only an explicit prior choice of dark sticks
    // before the real per-account preference loads from the profile.
    return localStorage.getItem('deltana_pm_theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('deltana_pm_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (session) {
        updateMyThemePreference(next).catch(handlePersistError);
      }
      return next;
    });
  };

  // User menu (profile pill -> dropdown with theme + logout)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track last local backup export/import (informational only, not synced)
  const [lastDataUpdate, setLastDataUpdate] = useState<string | null>(() => {
      return localStorage.getItem('vicent_pm_last_update');
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [loneCollaborators, setLoneCollaborators] = useState<TeamMember[]>([]);
  const [internalRates, setInternalRates] = useState<Record<string, number>>({});
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserLabel, setCurrentUserLabel] = useState<string | null>(null);
  const [projectManagers, setProjectManagers] = useState<Record<string, { id: string; name: string }>>({});
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load all data from Supabase once authenticated
  useEffect(() => {
    if (!session) {
      setProjects([]);
      setLoneCollaborators([]);
      setInternalRates({});
      setCurrentUserRole(null);
      setCurrentUserLabel(null);
      setProjectManagers({});
      return;
    }
    setDataLoading(true);
    Promise.all([
      fetchProjects(),
      fetchLoneCollaborators(),
      fetchInternalRates(),
      fetchCurrentProfile(session.user.id),
    ])
      .then(([loadedProjects, loadedLoneCollaborators, loadedRates, profile]) => {
        if (profile && profile.active === false) {
          alert('Tu cuenta todavía no tiene acceso habilitado en la app. Contactá a Administración para que te asigne un rol.');
          supabase.auth.signOut();
          return;
        }
        setProjects(loadedProjects);
        setLoneCollaborators(loadedLoneCollaborators);
        setInternalRates(loadedRates);
        setCurrentUserRole(profile?.role ?? null);
        setCurrentUserLabel(profile?.name || profile?.email || session.user.email || null);
        if (profile?.theme_preference === 'light' || profile?.theme_preference === 'dark') {
          setTheme(profile.theme_preference);
        }
        if (profile?.role === 'direccion' || profile?.role === 'administracion') {
          fetchProjectManagers().then(setProjectManagers).catch(handlePersistError);
          setCurrentView('executive-dashboard');
        }
        if (profile?.role === 'administracion') {
          fetchInactiveProfilesCount().then(setPendingApprovalCount).catch(handlePersistError);
        }
      })
      .catch((err) => {
        console.error('Error cargando datos desde Supabase:', err);
        alert('No se pudieron cargar los datos desde el servidor. Recargá la página para reintentar.');
      })
      .finally(() => setDataLoading(false));
  }, [session]);

  // Project Modal State
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // Collaborator Modal State
  const [isAddCollaboratorModalOpen, setAddCollaboratorModalOpen] = useState(false);

  // Client Financials Modal State
  const [editingClientProject, setEditingClientProject] = useState<Project | null>(null);

  // Aggregate unique clients from projects
  const availableClients = useMemo(() => {
    const clients = new Set(projects.map(p => p.client));
    return Array.from(clients).sort();
  }, [projects]);

  // Aggregate all unique team members (internal and external) for dropdowns
  const availableTeamMembers = useMemo(() => {
    const membersMap = new Map<string, TeamMember>();

    // Add from projects
    projects.forEach(p => {
        p.team.forEach(m => {
            if (!membersMap.has(m.contact)) {
                membersMap.set(m.contact, m);
            }
        });
    });

    // Add from lone collaborators
    loneCollaborators.forEach(m => {
        if (!membersMap.has(m.contact)) {
            membersMap.set(m.contact, m);
        }
    });

    return Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, loneCollaborators]);


  const handleLogin = async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
          return 'Email o contraseña incorrectos.';
      }
      return null;
  };

  const handleMicrosoftLogin = async (): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: { scopes: 'openid email profile offline_access' },
      });
      if (error) {
          return 'No se pudo iniciar el login con Microsoft. Intentá de nuevo.';
      }
      return null; // on success the browser redirects away; nothing left to do here
  };

  const handleLogout = () => {
      supabase.auth.signOut();
  };

  // --- DATA BACKUP HANDLERS (local JSON snapshot; not synced to Supabase) ---
  const handleExportData = () => {
    const now = new Date();
    const data = {
        projects,
        loneCollaborators,
        internalRates,
        exportDate: now.toISOString()
    };

    const dateStr = now.toLocaleString();
    setLastDataUpdate(dateStr);
    localStorage.setItem('vicent_pm_last_update', dateStr);

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deltana_pm_backup_${now.toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              const data = JSON.parse(text);

              // NOTE: this only replaces the in-memory view for inspection —
              // it does not write to Supabase. A refresh brings back the
              // server's real data. Bulk-importing a backup into the
              // relational schema is a separate, deliberately deferred task.
              if (Array.isArray(data.projects)) {
                  setProjects(data.projects);
              }
              if (Array.isArray(data.loneCollaborators)) {
                  setLoneCollaborators(data.loneCollaborators);
              }
              if (data.internalRates) {
                  setInternalRates(data.internalRates);
              }

              let dateStr = "";
              if (data.exportDate) {
                  dateStr = new Date(data.exportDate).toLocaleString();
              } else {
                  dateStr = new Date().toLocaleString() + " (Importado)";
              }
              setLastDataUpdate(dateStr);
              localStorage.setItem('vicent_pm_last_update', dateStr);

              alert("Backup cargado solo para vista previa en esta sesión — todavía no se sincroniza con el servidor. Recargar la página vuelve a traer los datos reales.");
          } catch (err) {
              console.error("Error parsing backup file", err);
              alert("Error al leer el archivo. Asegúrate de que es un backup válido de Deltana PM (.json).");
          }
      };
      reader.readAsText(file);
  };
  // -----------------------------


  const handleOpenAddProjectModal = () => {
    setEditingProject(null);
    setProjectModalOpen(true);
  };

  const handleOpenEditProjectModal = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleCloseProjectModal = () => {
    setProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleOpenViewProjectModal = (project: Project) => {
    setViewingProject(project);
  };

  const handleSaveProject = (projectData: Omit<Project, 'id'>) => {
    if (editingProject) {
      setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...projectData } : p));
      if (session) {
        apiSaveProject(editingProject.id, false, projectData, session.user.id).catch(handlePersistError);
      }
    } else {
      const newId = crypto.randomUUID();
      const newProject: Project = {
        ...projectData,
        id: newId,
      };
      setProjects([...projects, newProject]);
      if (session) {
        apiSaveProject(newId, true, projectData, session.user.id).catch(handlePersistError);
      }
    }
    handleCloseProjectModal();
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta propuesta? Esta acción no se puede deshacer.")) {
      setProjects(projects.filter(p => p.id !== projectId));
      apiDeleteProject(projectId).catch(handlePersistError);
      handleCloseProjectModal();
    }
  };

  const handleSaveCollaboratorFinancials = (projectId: string, memberContact: string, financialInfo: CollaboratorInfo | null) => {
    setProjects(currentProjects => {
        return currentProjects.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    team: p.team.map(member => {
                        if (member.contact === memberContact) {
                            // TypeScript fix: explicitly convert null to undefined to match TeamMember type interface
                            const safeInfo = financialInfo === null ? undefined : financialInfo;
                            return { ...member, collaboratorInfo: safeInfo };
                        }
                        return member;
                    })
                };
            }
            return p;
        });
    });
    apiSaveCollaboratorFinancials(projectId, memberContact, financialInfo).catch(handlePersistError);
  };

  const handleRemoveCollaboratorFromProject = (projectId: string, memberContact: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar a este colaborador de este proyecto?")) {
      setProjects(currentProjects => {
        return currentProjects.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              team: p.team.filter(member => member.contact !== memberContact)
            };
          }
          return p;
        });
      });
      apiRemoveCollaboratorFromProject(projectId, memberContact).catch(handlePersistError);
      return true;
    }
    return false;
  };

  const handleSaveInternalFinancials = (projectId: string, memberContact: string, costInfo: InternalCostInfo) => {
      setProjects(currentProjects => {
          return currentProjects.map(p => {
              if (p.id === projectId) {
                  return {
                      ...p,
                      team: p.team.map(member => {
                          if (member.contact === memberContact) {
                              return { ...member, internalCostInfo: costInfo };
                          }
                          return member;
                      })
                  }
              }
              return p;
          });
      });
      apiSaveInternalFinancials(projectId, memberContact, costInfo).catch(handlePersistError);
  };

  const handleUpdateProjectWithMembers = (updatedProject: Project, newGlobalMembers?: TeamMember[]) => {
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      if (newGlobalMembers && newGlobalMembers.length > 0) {
          setLoneCollaborators(prev => {
              const existing = new Set(prev.map(m => m.contact.toLowerCase().trim()));
              const toAdd = newGlobalMembers.filter(m => !existing.has(m.contact.toLowerCase().trim()));
              return [...prev, ...toAdd];
          });
      }
      apiUpdateProjectWithMembers(updatedProject).catch(handlePersistError);
  };

  const handleSaveClientFinancials = (clientInfo: ClientInfo) => {
      if (!editingClientProject) return;

      setProjects(currentProjects => {
          return currentProjects.map(p => {
              if (p.id === editingClientProject.id) {
                  return { ...p, clientInfo };
              }
              return p;
          });
      });
      apiSaveClientFinancials(editingClientProject.id, clientInfo).catch(handlePersistError);
      setEditingClientProject(null);
  };

  const handleOpenAddCollaboratorModal = () => setAddCollaboratorModalOpen(true);
  const handleCloseAddCollaboratorModal = () => setAddCollaboratorModalOpen(false);

  const handleSaveNewCollaborator = (collaboratorData: Omit<TeamMember, 'type' | 'projects'>) => {
    const allContacts = new Set([
      ...projects.flatMap(p => p.team.map(m => m.contact)),
      ...loneCollaborators.map(c => c.contact)
    ]);

    if (allContacts.has(collaboratorData.contact)) {
      alert("Ya existe un miembro del equipo con este email de contacto.");
      return;
    }

    const newCollaborator: TeamMember = {
      ...collaboratorData,
      type: MemberType.External,
    };

    setLoneCollaborators([...loneCollaborators, newCollaborator]);
    apiSaveNewCollaborator(collaboratorData).catch(handlePersistError);
    handleCloseAddCollaboratorModal();
  };

  const handleUpdateMemberName = (contact: string, newName: string) => {
    setLoneCollaborators(prev => prev.map(c => c.contact === contact ? { ...c, name: newName } : c));
    setProjects(prev => prev.map(p => ({
      ...p,
      team: p.team.map(m => m.contact === contact ? { ...m, name: newName } : m)
    })));
    apiUpdateMemberName(contact, newName).catch(handlePersistError);
  };

  const handleUpdateCollaboratorName = handleUpdateMemberName;

  // Handle global internal rate updates
  const handleUpdateGlobalRate = (contact: string, rate: number) => {
      setInternalRates(prev => ({
          ...prev,
          [contact]: rate
      }));
      apiUpdateGlobalRate(contact, rate).catch(handlePersistError);
  };

  const handleUpdateInternalMemberType = (contact: string, type: string) => {
    setProjects(prev => prev.map(p => ({
      ...p,
      team: p.team.map(m => m.contact === contact ? { ...m, internalMemberType: type } : m)
    })));
    apiUpdateInternalMemberType(contact, type).catch(handlePersistError);
  };

  const handleDeleteGlobalMember = (contact: string) => {
    setLoneCollaborators(prev => prev.filter(c => c.contact !== contact));
    setProjects(prev => prev.map(p => ({
      ...p,
      team: p.team.filter(m => m.contact !== contact)
    })));
    apiDeleteGlobalMember(contact).catch(handlePersistError);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard projects={projects} internalRates={internalRates} />;
      case 'projects':
        return <Projects
                  projects={projects}
                  internalRates={internalRates}
                  onAddProject={handleOpenAddProjectModal}
                  onEditProject={handleOpenEditProjectModal}
                  onViewProject={handleOpenViewProjectModal}
                  projectManagers={projectManagers}
                  readOnly={currentUserRole === 'direccion' || currentUserRole === 'administracion'}
               />;
      case 'planning':
        return <Planning projects={projects} />;
      case 'team': {
        const isTeamReadOnly = currentUserRole === 'direccion' || currentUserRole === 'administracion';
        return <Team
                  projects={projects}
                  internalRates={internalRates}
                  onUpdateRate={isTeamReadOnly ? undefined : handleUpdateGlobalRate}
                  onUpdateMemberType={isTeamReadOnly ? undefined : handleUpdateInternalMemberType}
                  onUpdateMemberName={isTeamReadOnly ? undefined : handleUpdateMemberName}
                  onDeleteMember={isTeamReadOnly ? undefined : handleDeleteGlobalMember}
               />;
      }
      case 'internal-team': // NEW VIEW
        return (
          <InternalTeam
            projects={projects}
            globalRates={internalRates}
            availableGlobalMembers={availableTeamMembers}
            onUpdateInternalCost={handleSaveInternalFinancials}
            onUpdateProject={handleUpdateProjectWithMembers}
          />
        );
      case 'clients':
        return <Clients
                  projects={projects}
                  onAddClient={handleOpenAddProjectModal}
                  onEditFinancials={(project) => setEditingClientProject(project)}
                  projectManagers={projectManagers}
                  readOnly={currentUserRole === 'direccion' || currentUserRole === 'administracion'}
                />;
      case 'collaborators':
        return <Collaborators
                  projects={projects}
                  loneCollaborators={loneCollaborators}
                  onSaveFinancials={handleSaveCollaboratorFinancials}
                  onRemoveFromProject={handleRemoveCollaboratorFromProject}
                  onAddCollaborator={handleOpenAddCollaboratorModal}
                  onUpdateCollaboratorName={handleUpdateCollaboratorName}
                  projectManagers={projectManagers}
                  readOnly={currentUserRole === 'direccion' || currentUserRole === 'administracion'}
                />;
      case 'economic-tracking':
        return <EconomicTracking projects={projects} globalRates={internalRates} projectManagers={projectManagers} />;
      case 'executive-dashboard':
        if (currentUserRole !== 'direccion' && currentUserRole !== 'administracion') {
          return <Dashboard projects={projects} internalRates={internalRates} />;
        }
        return (
          <ExecutiveDashboard
            projects={projects}
            internalRates={internalRates}
            projectManagers={projectManagers}
            isAdministracion={currentUserRole === 'administracion'}
            pendingApprovalCount={pendingApprovalCount}
          />
        );
      case 'administration':
        if (currentUserRole !== 'administracion') {
          return <Dashboard projects={projects} internalRates={internalRates} />;
        }
        return <Administration onPendingApprovalCountChange={setPendingApprovalCount} />;
      default:
        return <Dashboard projects={projects} internalRates={internalRates} />;
    }
  };

  // Wait for the initial session check before deciding what to render, so a
  // logged-in user doesn't flash the login screen on refresh.
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Cargando...
      </div>
    );
  }

  if (!session) {
      return <Login onLogin={handleLogin} onLoginWithMicrosoft={handleMicrosoftLogin} />;
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Cargando datos...
      </div>
    );
  }

  // Determine container style based on view
  const isFixedView = currentView === 'planning';

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onExportData={handleExportData}
        onImportData={handleImportData}
        lastDataUpdate={lastDataUpdate}
        canViewExecutiveDashboard={currentUserRole === 'direccion' || currentUserRole === 'administracion'}
        isAdministracion={currentUserRole === 'administracion'}
        pendingApprovalCount={pendingApprovalCount}
      />

      {/* User menu (Positioned Absolute Top Right) */}
      <div ref={userMenuRef} className="fixed top-3 right-4 z-50">
        <button
          onClick={() => setIsUserMenuOpen((o) => !o)}
          className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-full pl-3 pr-2 py-1.5 shadow-lg hover:border-gray-500 transition-colors"
        >
          {currentUserLabel && (
            <span className="text-xs text-gray-300 hidden sm:inline">
              <span className="font-medium">{currentUserLabel}</span>
              {currentUserRole && (
                <span className="text-sky-400 uppercase tracking-wider font-bold ml-1.5">
                  {ROLE_LABELS[currentUserRole] ?? currentUserRole}
                </span>
              )}
            </span>
          )}
          <span className="text-gray-500 text-[10px]">▾</span>
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1.5 animate-fade-in">
            <button
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <div className="my-1 border-t border-gray-700" />
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        )}

        <style>{`
          @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 0.15s ease-out; }
        `}</style>
      </div>

      <main
        className={`flex-1 px-4 sm:px-6 lg:px-10 pb-4 sm:pb-6 lg:pb-10 pt-16 sm:pt-20 ml-16 md:ml-64 transition-all duration-300 flex flex-col ${
            isFixedView ? 'h-screen overflow-hidden' : 'min-h-screen'
        }`}
      >
        {renderView()}
      </main>

      {isProjectModalOpen && (
        <ProjectModal
          project={editingProject}
          availableClients={availableClients}
          availableTeamMembers={availableTeamMembers}
          onClose={handleCloseProjectModal}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
        />
      )}

      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          internalRates={internalRates}
          managerName={projectManagers[viewingProject.id]?.name}
          onClose={() => setViewingProject(null)}
        />
      )}

      {isAddCollaboratorModalOpen && (
        <AddCollaboratorModal
            onClose={handleCloseAddCollaboratorModal}
            onSave={handleSaveNewCollaborator}
        />
      )}

      {editingClientProject && (
          <ClientFinancialsModal
            project={editingClientProject}
            onClose={() => setEditingClientProject(null)}
            onSave={handleSaveClientFinancials}
          />
      )}
    </div>
  );
};

export default App;
