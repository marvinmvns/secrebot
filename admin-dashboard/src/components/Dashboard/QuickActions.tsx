import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface QuickAction {
  title: string;
  description: string;
  icon: IconDefinition;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  action: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
  variant?: 'default' | 'glass' | 'neuma';
  layout?: 'grid' | 'list';
}

const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  variant = 'default',
  layout = 'grid',
}) => {
  const getCardClasses = () => {
    let classes = 'dashboard-card quick-actions';
    
    switch (variant) {
      case 'glass':
        classes += ' dashboard-card--glass';
        break;
      case 'neuma':
        classes += ' dashboard-card--neuma';
        break;
      default:
        break;
    }
    
    return classes;
  };

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">Quick Actions</h3>
      </div>
      
      <div className={`quick-actions__content quick-actions__content--${layout}`}>
        {actions.map((action, index) => (
          <motion.div
            key={action.title}
            className="quick-action"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={action.action}
          >
            <div className={`quick-action__icon quick-action__icon--${action.color}`}>
              <FontAwesomeIcon icon={action.icon} />
            </div>
            
            <div className="quick-action__content">
              <h4 className="quick-action__title">{action.title}</h4>
              <p className="quick-action__description">{action.description}</p>
            </div>
            
            <div className="quick-action__arrow">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 12L10 8L6 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default QuickActions;