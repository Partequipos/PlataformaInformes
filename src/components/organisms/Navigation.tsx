import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../atoms/Button';
import {
  Home,
  FileText,
  Plus,
  User,
  LogOut,
  Settings,
  Menu,
  X,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
}

interface NavigationProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const { state: authState, logout } = useAuth();

  const role = String(authState.user?.role || '').toLowerCase().trim();
  const isAdmin = role === 'admin';
  const canSeeActs = isAdmin || role === 'user';

  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/reports/new', label: 'New Report', icon: Plus },
  ];

  if (canSeeActs) {
    navItems.push({ path: '/acts', label: 'Actas', icon: ClipboardList });
  }

  navItems.push(
    { path: '/resources', label: 'Resources', icon: FileText },
    { path: '/parameters', label: 'Parameters', icon: FileText }
  );

  if (isAdmin) {
    navItems.push(
      { path: '/admin', label: 'Administration', icon: Shield },
      { path: '/admin/users', label: 'Users', icon: User }
    );
  }

  const isActivePath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navLinkClass = (active: boolean) =>
    cn(
      'group relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
      active
        ? 'bg-brand-soft text-brand-red shadow-sm'
        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
    );

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="md:hidden fixed top-4 left-4 z-50 bg-white rounded-lg p-2 shadow-panel border border-slate-200 text-slate-700"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-brand-sidebar border-r border-slate-200 transform transition-transform duration-200 ease-in-out z-40 shadow-panel',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="brand-accent-bar" />
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-slate-200 flex items-center gap-3">
            <img
              src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png"
              alt="Company Logo"
              className="w-20 h-auto object-contain"
              style={{ maxWidth: '96px' }}
            />
            <div className="min-w-0">
              <h1 className="text-base font-display font-bold text-slate-900 leading-tight">
                MachineryReports
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                Technical Inspection
              </p>
            </div>
          </div>

          <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);
              if (item.children) {
                return (
                  <div key={item.path}>
                    <div className={navLinkClass(isActive)}>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-brand-red" />
                      )}
                      <Icon className="w-5 h-5 mr-3 shrink-0" />
                      {item.label}
                    </div>
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child: NavItem) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={onToggle}
                          className={navLinkClass(isActivePath(child.path))}
                        >
                          <child.icon className="w-4 h-4 mr-2" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onToggle}
                  className={navLinkClass(isActive)}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-brand-red" />
                  )}
                  <Icon
                    className={cn(
                      'w-5 h-5 mr-3 shrink-0 transition-colors',
                      isActive ? 'text-brand-red' : 'text-slate-500 group-hover:text-brand-red'
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200 space-y-2 bg-white/80">
            <div className="flex items-center px-3 py-2 rounded-lg bg-slate-50">
              <div className="w-8 h-8 bg-brand-soft rounded-full flex items-center justify-center mr-3 ring-1 ring-brand-red/20">
                <User className="w-4 h-4 text-brand-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {authState.user?.full_name}
                </p>
                <p className="text-xs text-slate-500 truncate uppercase tracking-wide">
                  {authState.user?.role}
                </p>
              </div>
            </div>

            <Link
              to="/profile"
              onClick={onToggle}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-red transition-colors"
            >
              <Settings className="w-4 h-4 mr-3" />
              Profile Settings
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start px-3 text-slate-700 hover:text-brand-red"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
};
