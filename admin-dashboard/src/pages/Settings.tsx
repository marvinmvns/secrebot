import React from 'react';
import { motion } from 'framer-motion';
import ThemeCustomizer from '../components/Settings/ThemeCustomizer';

const Settings: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="settings-page"
    >
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure your dashboard preferences and system settings.
        </p>
      </div>
      
      <div className="row">
        <div className="col-lg-8">
          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3 className="dashboard-card__header__title">General Settings</h3>
            </div>
            <div className="dashboard-card__content">
              <p>General settings interface will be implemented here.</p>
            </div>
          </div>
        </div>
        
        <div className="col-lg-4">
          <ThemeCustomizer />
        </div>
      </div>
    </motion.div>
  );
};

export default Settings;