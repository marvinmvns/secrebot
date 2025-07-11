import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt,
  faChartLine,
  faUsers,
  faCog,
  faFileAlt,
  faBell,
  faEnvelope,
  faCalendarAlt,
  faShoppingCart,
  faCreditCard,
  faUserCircle,
  faQuestionCircle,
  faSignOutAlt,
  faBars,
  faChevronRight,
  faRobot,
  faDatabase,
  faCloud,
  faMobile,
  faDesktop,
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: string;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: faTachometerAlt,
    path: '/dashboard',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: faChartLine,
    path: '/analytics',
    badge: 'Pro',
  },
  {
    id: 'users',
    label: 'Users',
    icon: faUsers,
    path: '/users',
  },
  {
    id: 'ai-tools',
    label: 'AI Tools',
    icon: faRobot,
    path: '/ai-tools',
    children: [
      {
        id: 'chat',
        label: 'Chat Assistant',
        icon: faEnvelope,
        path: '/ai-tools/chat',
      },
      {
        id: 'transcribe',
        label: 'Transcribe Audio',
        icon: faMobile,
        path: '/ai-tools/transcribe',
      },
      {
        id: 'describe',
        label: 'Image Analysis',
        icon: faDesktop,
        path: '/ai-tools/describe',
      },
    ],
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: faDatabase,
    path: '/data',
    children: [
      {
        id: 'flows',
        label: 'Flow Builder',
        icon: faChartLine,
        path: '/data/flows',
      },
      {
        id: 'configs',
        label: 'Configurations',
        icon: faCog,
        path: '/data/configs',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: faCloud,
    path: '/integrations',
    children: [
      {
        id: 'linkedin',
        label: 'LinkedIn',
        icon: faUsers,
        path: '/integrations/linkedin',
      },
      {
        id: 'youtube',
        label: 'YouTube',
        icon: faFileAlt,
        path: '/integrations/youtube',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        icon: faCalendarAlt,
        path: '/integrations/calendar',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: faFileAlt,
    path: '/reports',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: faBell,
    path: '/notifications',
    badge: '12',
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: faEnvelope,
    path: '/messages',
    badge: '3',
  },
  {
    id: 'e-commerce',
    label: 'E-Commerce',
    icon: faShoppingCart,
    path: '/ecommerce',
    children: [
      {
        id: 'products',
        label: 'Products',
        icon: faShoppingCart,
        path: '/ecommerce/products',
      },
      {
        id: 'orders',
        label: 'Orders',
        icon: faFileAlt,
        path: '/ecommerce/orders',
      },
      {
        id: 'payments',
        label: 'Payments',
        icon: faCreditCard,
        path: '/ecommerce/payments',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: faCog,
    path: '/settings',
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const hasActiveChild = (item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => isActive(child.path));
  };

  const toggleExpanded = (itemId: string) => {
    if (collapsed) return;
    
    setExpandedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  React.useEffect(() => {
    // Auto-expand parent items when child is active
    navigationItems.forEach(item => {
      if (item.children && hasActiveChild(item)) {
        setExpandedItems(prev => 
          prev.includes(item.id) ? prev : [...prev, item.id]
        );
      }
    });
  }, [location.pathname]);

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const active = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const activeChild = hasActiveChild(item);

    return (
      <motion.div
        key={item.id}
        className="nav-item"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: level * 0.1 }}
      >
        <div
          className={`nav-item__link ${
            active || activeChild ? 'nav-item__link--active' : ''
          }`}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id);
            } else {
              handleNavigation(item.path);
            }
          }}
          style={{ paddingLeft: `${1 + level * 0.5}rem` }}
        >
          <div className="nav-item__icon">
            <FontAwesomeIcon icon={item.icon} />
          </div>
          <span className="nav-item__text">{item.label}</span>
          {item.badge && (
            <span className="nav-item__badge">{item.badge}</span>
          )}
          {hasChildren && !collapsed && (
            <motion.div
              className="nav-item__chevron"
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ marginLeft: 'auto' }}
            >
              <FontAwesomeIcon icon={faChevronRight} size="sm" />
            </motion.div>
          )}
        </div>

        {/* Submenu */}
        {hasChildren && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: isExpanded ? 'auto' : 0,
              opacity: isExpanded ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="nav-submenu">
              {item.children?.map(child => renderNavItem(child, level + 1))}
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar__header">
        <motion.a
          href="#"
          className="brand"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="brand__icon">
            <FontAwesomeIcon icon={faRobot} />
          </div>
          <span className="brand__text">SecreBot AI</span>
        </motion.a>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {navigationItems.map(item => renderNavItem(item))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <motion.div
          className="nav-item"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="nav-item__link">
            <div className="nav-item__icon">
              <FontAwesomeIcon icon={faUserCircle} />
            </div>
            <span className="nav-item__text">Profile</span>
          </div>
        </motion.div>

        <motion.div
          className="nav-item"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="nav-item__link">
            <div className="nav-item__icon">
              <FontAwesomeIcon icon={faQuestionCircle} />
            </div>
            <span className="nav-item__text">Help</span>
          </div>
        </motion.div>

        <motion.div
          className="nav-item"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="nav-item__link">
            <div className="nav-item__icon">
              <FontAwesomeIcon icon={faSignOutAlt} />
            </div>
            <span className="nav-item__text">Logout</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Sidebar;