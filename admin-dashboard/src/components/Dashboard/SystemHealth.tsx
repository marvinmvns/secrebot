import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faDatabase,
  faCloud,
  faMicrochip,
  faMemory,
  faHdd,
  faWifi,
  faShieldAlt,
} from '@fortawesome/free-solid-svg-icons';

interface SystemMetric {
  name: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  icon: any;
  unit: string;
}

interface SystemHealthProps {
  variant?: 'default' | 'glass' | 'neuma';
}

const SystemHealth: React.FC<SystemHealthProps> = ({ variant = 'default' }) => {
  const getCardClasses = () => {
    let classes = 'dashboard-card system-health';
    
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

  const metrics: SystemMetric[] = [
    {
      name: 'CPU Usage',
      value: 45,
      status: 'healthy',
      icon: faMicrochip,
      unit: '%',
    },
    {
      name: 'Memory',
      value: 68,
      status: 'warning',
      icon: faMemory,
      unit: '%',
    },
    {
      name: 'Storage',
      value: 32,
      status: 'healthy',
      icon: faHdd,
      unit: '%',
    },
    {
      name: 'Network',
      value: 12,
      status: 'healthy',
      icon: faWifi,
      unit: 'Mbps',
    },
    {
      name: 'Database',
      value: 89,
      status: 'critical',
      icon: faDatabase,
      unit: '%',
    },
    {
      name: 'Security',
      value: 100,
      status: 'healthy',
      icon: faShieldAlt,
      unit: '%',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getOverallHealth = () => {
    const criticalCount = metrics.filter(m => m.status === 'critical').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'healthy';
  };

  const getOverallScore = () => {
    const healthyMetrics = metrics.filter(m => m.status === 'healthy').length;
    return Math.round((healthyMetrics / metrics.length) * 100);
  };

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">System Health</h3>
        <span className={`system-health__status system-health__status--${getOverallHealth()}`}>
          {getOverallHealth().toUpperCase()}
        </span>
      </div>
      
      {/* Overall Score */}
      <div className="system-health__score">
        <div className="system-health__score__circle">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke={`var(--${getStatusColor(getOverallHealth())})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 35}`}
              strokeDashoffset={`${2 * Math.PI * 35 * (1 - getOverallScore() / 100)}`}
              transform="rotate(-90 40 40)"
              initial={{ strokeDashoffset: 2 * Math.PI * 35 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 35 * (1 - getOverallScore() / 100) }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
          </svg>
          <div className="system-health__score__text">
            <span className="system-health__score__value">{getOverallScore()}</span>
            <span className="system-health__score__unit">%</span>
          </div>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="system-health__metrics">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            className="system-health__metric"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ backgroundColor: 'var(--glass-bg)' }}
          >
            <div className="system-health__metric__icon">
              <FontAwesomeIcon icon={metric.icon} />
            </div>
            
            <div className="system-health__metric__info">
              <div className="system-health__metric__name">{metric.name}</div>
              <div className="system-health__metric__value">
                {metric.value}{metric.unit}
              </div>
            </div>
            
            <div className="system-health__metric__progress">
              <div className="progress progress-sm">
                <motion.div
                  className={`progress-bar bg-${getStatusColor(metric.status)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.value}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
              </div>
            </div>
            
            <span className={`system-health__metric__status system-health__metric__status--${getStatusColor(metric.status)}`}>
              ●
            </span>
          </motion.div>
        ))}
      </div>
      
      <div className="dashboard-card__footer">
        <motion.button
          className="btn btn-sm btn-outline-primary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          View Detailed Report
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SystemHealth;