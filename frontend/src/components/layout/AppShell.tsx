import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import FocusOverlay from '../tracking/FocusOverlay';

const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-textPrimary flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <Outlet />
      </main>
      
      <FocusOverlay />
      {/* Mobile Nav would be added here */}
    </div>
  );
};

export default AppShell;
