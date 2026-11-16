import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  MessageSquare,
  UserCog,
  ScrollText,
  Settings,
  PenSquare,
  Clock,
  Activity,
  LogOut,
  GraduationCap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const adminNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics/boys', icon: BarChart3, label: 'Boys Analytics' },
  { to: '/analytics/girls', icon: BarChart3, label: 'Girls Analytics' },
  { to: '/analytics/combined', icon: BarChart3, label: 'Combined Overview' },
  { to: '/data-entry', icon: PenSquare, label: 'Data Entry' },
  { to: '/ustazes', icon: GraduationCap, label: 'Ustazes' },
  { to: '/questions', icon: ClipboardList, label: 'Evaluation Questions' },
  { to: '/evaluations', icon: FileText, label: 'All Evaluations' },
  { to: '/comments', icon: MessageSquare, label: 'Comments' },
  { to: '/users', icon: UserCog, label: 'Data Entry Users' },
  { to: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const dataEntryNav = [
  { to: '/data-entry', icon: PenSquare, label: 'New Evaluation' },
  { to: '/my-entries', icon: Clock, label: 'My Recent Entries' },
  { to: '/my-activity', icon: Activity, label: 'My Activity' },
];

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNav : dataEntryNav;

  const handleSignOut = async () => {
    onMobileClose();
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900 text-white z-50 flex flex-col transition-all duration-300 ${
          /* Mobile classes */
          mobileOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full'
        } ${
          /* Desktop classes */
          'md:translate-x-0'
        } ${
          collapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <GraduationCap className="w-7 h-7 text-emerald-400 flex-shrink-0" />
            <div className={`transition-opacity duration-200 ${collapsed ? 'md:hidden' : 'block'}`}>
              <h1 className="text-sm font-bold leading-tight">Medersa</h1>
              <p className="text-xs text-slate-400">Evaluation System</p>
            </div>
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggle}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className={collapsed ? 'md:hidden' : 'block'}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User profile & sign out */}
        <div className="border-t border-slate-700 p-3 bg-slate-900/50">
          {profile && (
            <div className={`mb-2 px-2.5 ${collapsed ? 'md:hidden' : 'block'}`}>
              <p className="text-sm font-semibold truncate text-white">{profile.full_name}</p>
              <p className="text-[11px] text-emerald-400 uppercase tracking-wider font-mono">
                {profile.role.replace('_', ' ')}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-medium"
            title="Sign out"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={collapsed ? 'md:hidden' : 'block'}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
