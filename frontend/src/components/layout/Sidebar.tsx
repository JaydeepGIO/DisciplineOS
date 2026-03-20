import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  BarChart3, 
  CheckSquare, 
  PenLine, 
  Flame, 
  ClipboardList, 
  Settings,
  Zap,
  Moon,
  Sun
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/week', icon: Calendar, label: 'Weekly' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/tracking', icon: CheckSquare, label: 'Tracking' },
  { to: '/reflection', icon: PenLine, label: 'Reflection' },
  { to: '/habits', icon: Flame, label: 'Habits' },
  { to: '/planner', icon: ClipboardList, label: 'Planner' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface border-r border-border hidden md:flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <Zap className="w-6 h-6 text-white fill-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-textPrimary">DisciplineOS</h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
              ${isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-textMuted hover:bg-card hover:text-textPrimary'}
            `}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border flex items-center justify-between">
        <span className="text-xs font-bold text-textMuted uppercase tracking-wider">Theme</span>
        <button 
          onClick={toggleDarkMode}
          className="p-2 rounded-xl bg-card border border-border text-textPrimary hover:bg-surface transition-all shadow-sm"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-primary" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
