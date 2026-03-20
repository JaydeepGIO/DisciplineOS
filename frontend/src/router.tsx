import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import HabitManager from './pages/HabitManager';
import DailyPlanner from './pages/DailyPlanner';
import Tracking from './pages/Tracking';
import Analytics from './pages/Analytics';
import Reflection from './pages/Reflection';
import WeeklyView from './pages/WeeklyView';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { useAuthStore } from './store/authStore';

// Placeholder for remaining
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full text-textMuted">
    <h1 className="text-2xl font-bold">{title} Page (Coming Soon)</h1>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  // NOTE: For initial setup, we bypass if no token is present, 
  // but in production, this should redirect to /login
  if (!isAuthenticated && window.location.pathname !== '/login') {
     // return <Navigate to="/login" replace />; 
     // Temporarily allowed for demo if you haven't registered yet
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'week', element: <WeeklyView /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'tracking', element: <Tracking /> },
      { path: 'reflection', element: <Reflection /> },
      { path: 'habits', element: <HabitManager /> },
      { path: 'planner', element: <DailyPlanner /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
]);
