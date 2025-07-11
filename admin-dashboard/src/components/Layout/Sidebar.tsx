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
  faMicrophone,
  faEye,
  faAppleAlt,
  faSitemap,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faYoutube } from '@fortawesome/free-brands-svg-icons';
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
    id: 'chat',
    label: 'Chat com IA',
    icon: faRobot,
    path: '/chat',
  },
  {
    id: 'flow-builder',
    label: 'Flow Builder',
    icon: faSitemap,
    path: '/flow-builder',
  },
  {
    id: 'ai-tools',
    label: 'Ferramentas IA',
    icon: faRobot,
    path: '/ai-tools',
    children: [
      {
        id: 'transcribe',
        label: 'Transcrever Áudio',
        icon: faMicrophone,
        path: '/transcribe',
      },
      {
        id: 'describe',
        label: 'Descrever Imagem',
        icon: faEye,
        path: '/describe',
      },
      {
        id: 'calories',
        label: 'Cálculo de Calorias',
        icon: faAppleAlt,
        path: '/calories',
      },
    ],
  },
  {
    id: 'configs',
    label: 'Configurações',
    icon: faCog,
    path: '/configs',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: faChartLine,
    path: '/analytics',
  },
  {
    id: 'users',
    label: 'Usuários',
    icon: faUsers,
    path: '/users',
  },
  {
    id: 'resources',
    label: 'Recursos do Sistema',
    icon: faServer,
    path: '/resources',
  },
  {
    id: 'settings',
    label: 'Configurações Avançadas',
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
          <span className="brand__text">SecreBot</span>
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