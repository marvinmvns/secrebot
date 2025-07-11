import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: IconDefinition;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  variant?: 'default' | 'glass' | 'neuma';
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon,
  color,
  variant = 'default',
}) => {
  const getCardClasses = () => {
    let classes = 'dashboard-card stats-card';
    
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

  const getChangeColor = () => {
    return changeType === 'increase' ? 'text-success' : 'text-danger';
  };

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div className="stats-card__header">
        <div className="stats-card__info">
          <h3 className="stats-card__title">{title}</h3>
          <div className="stats-card__value">{value}</div>
        </div>
        <div className={`stats-card__icon stats-card__icon--${color}`}>
          <FontAwesomeIcon icon={icon} size="lg" />
        </div>
      </div>
      
      <div className="stats-card__footer">
        <span className={`stats-card__change ${getChangeColor()}`}>
          <FontAwesomeIcon
            icon={changeType === 'increase' ? faArrowUp : faArrowDown}
            size="sm"
          />
          <span className="ms-1">{change}</span>
        </span>
        <span className="stats-card__period">vs last month</span>
      </div>
    </motion.div>
  );
};

export default StatsCard;