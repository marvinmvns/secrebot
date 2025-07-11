import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useTheme } from '../../hooks/useTheme';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { theme } = useTheme();

  // Check if screen is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 992);
      if (window.innerWidth >= 992) {
        setSidebarOpen(false);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  // Close mobile sidebar when clicking overlay
  const handleOverlayClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <motion.aside
        className={`dashboard-layout__sidebar ${
          sidebarCollapsed ? 'dashboard-layout__sidebar--collapsed' : ''
        } ${sidebarOpen ? 'dashboard-layout__sidebar--open' : ''}`}
        initial={false}
        animate={{
          width: isMobile ? 280 : sidebarCollapsed ? 72 : 280,
          transform: isMobile
            ? sidebarOpen
              ? 'translateX(0)'
              : 'translateX(-100%)'
            : 'translateX(0)',
        }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <Sidebar
          collapsed={sidebarCollapsed && !isMobile}
          onToggle={handleSidebarToggle}
        />
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            className="sidebar-overlay sidebar-overlay--active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleOverlayClick}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="dashboard-layout__main">
        {/* Navbar */}
        <motion.header
          className="dashboard-layout__navbar"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Navbar
            onMenuToggle={handleSidebarToggle}
            sidebarCollapsed={sidebarCollapsed}
            isMobile={isMobile}
          />
        </motion.header>

        {/* Page Content */}
        <motion.main
          className="dashboard-layout__content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};

export default DashboardLayout;