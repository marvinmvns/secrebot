import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faRefresh } from '@fortawesome/free-solid-svg-icons';

interface Activity {
  id: number;
  type: string;
  message: string;
  time: string;
  avatar: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  variant?: 'default' | 'glass' | 'neuma';
  maxItems?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  variant = 'default',
  maxItems = 10,
}) => {
  const getCardClasses = () => {
    let classes = 'dashboard-card activity-feed';
    
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

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'user_signup':
        return 'primary';
      case 'ai_interaction':
        return 'success';
      case 'system_update':
        return 'warning';
      case 'payment':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">Recent Activity</h3>
        <div className="dashboard-card__header__actions">
          <motion.button
            className="dashboard-card__header__action"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Refresh"
          >
            <FontAwesomeIcon icon={faRefresh} />
          </motion.button>
          <motion.button
            className="dashboard-card__header__action"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="More Options"
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </motion.button>
        </div>
      </div>
      
      <div className="activity-feed__content">
        {displayedActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            className="activity-feed__item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ backgroundColor: 'var(--glass-bg)' }}
          >
            <div className="activity-feed__item__avatar">
              <img
                src={activity.avatar}
                alt=""
                className={`activity-feed__item__avatar__image activity-feed__item__avatar__image--${getActivityTypeColor(activity.type)}`}
              />
            </div>
            
            <div className="activity-feed__item__content">
              <p className="activity-feed__item__message">
                {activity.message}
              </p>
              <span className="activity-feed__item__time">
                {activity.time}
              </span>
            </div>
            
            <div className="activity-feed__item__indicator">
              <span className={`activity-indicator activity-indicator--${getActivityTypeColor(activity.type)}`} />
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="dashboard-card__footer">
        <motion.button
          className="btn btn-sm btn-outline-primary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          View All Activities
        </motion.button>
      </div>
    </motion.div>
  );
};

export default ActivityFeed;