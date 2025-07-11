import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faSearch,
  faBell,
  faEnvelope,
  faUserCircle,
  faMoon,
  faSun,
  faExpand,
  faCompress,
  faCog,
  faSignOutAlt,
  faUser,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../../hooks/useTheme';

interface NavbarProps {
  onMenuToggle: () => void;
  sidebarCollapsed: boolean;
  isMobile: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  onMenuToggle,
  sidebarCollapsed,
  isMobile,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsDropdownOpen, setNotificationsDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mock data
  const notifications = [
    {
      id: 1,
      title: 'New message from John Doe',
      message: 'Hey, how are you doing?',
      time: '2 minutes ago',
      unread: true,
    },
    {
      id: 2,
      title: 'System update completed',
      message: 'All systems are running smoothly',
      time: '1 hour ago',
      unread: true,
    },
    {
      id: 3,
      title: 'New user registered',
      message: 'Welcome to the platform!',
      time: '3 hours ago',
      unread: false,
    },
  ];

  const user = {
    name: 'Sarah Johnson',
    role: 'Administrator',
    avatar: 'https://via.placeholder.com/40x40/4285F4/FFFFFF?text=SJ',
    email: 'sarah.johnson@secrebot.ai',
  };

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchValue);
    // Implement search functionality
  };

  const unreadNotifications = notifications.filter(n => n.unread).length;

  return (
    <nav className="navbar">
      <div className="navbar__left">
        {/* Menu Toggle */}
        <motion.button
          className="navbar__toggle"
          onClick={onMenuToggle}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isMobile ? 'Toggle sidebar' : 'Collapse sidebar'}
        >
          <FontAwesomeIcon icon={faBars} size="lg" />
        </motion.button>

        {/* Breadcrumb */}
        <div className="navbar__breadcrumb">
          <span className="navbar__breadcrumb__item">Dashboard</span>
          <span className="navbar__breadcrumb__separator">/</span>
          <span className="navbar__breadcrumb__item navbar__breadcrumb__item--active">
            Overview
          </span>
        </div>
      </div>

      <div className="navbar__right">
        {/* Search */}
        <motion.form
          className="navbar__search"
          onSubmit={handleSearch}
          animate={{
            width: searchFocused ? 320 : 280,
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="navbar__search__icon">
            <FontAwesomeIcon icon={faSearch} />
          </div>
          <input
            type="text"
            placeholder="Search anything..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </motion.form>

        <div className="navbar__actions">
          {/* Fullscreen Toggle */}
          <motion.button
            className="navbar__notification"
            onClick={handleFullscreenToggle}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            className="navbar__notification"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            <FontAwesomeIcon icon={theme === 'light' ? faMoon : faSun} />
          </motion.button>

          {/* Notifications */}
          <div className="navbar__dropdown">
            <motion.button
              className="navbar__notification"
              onClick={() => setNotificationsDropdownOpen(!notificationsDropdownOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faBell} />
              {unreadNotifications > 0 && (
                <motion.span
                  className="navbar__notification__badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {unreadNotifications}
                </motion.span>
              )}
            </motion.button>

            <AnimatePresence>
              {notificationsDropdownOpen && (
                <motion.div
                  className="navbar__dropdown__menu"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="navbar__dropdown__header">
                    <h4>Notifications</h4>
                    <span className="badge">{unreadNotifications} new</span>
                  </div>
                  <div className="navbar__dropdown__content">
                    {notifications.map(notification => (
                      <motion.div
                        key={notification.id}
                        className={`notification-item ${
                          notification.unread ? 'notification-item--unread' : ''
                        }`}
                        whileHover={{ backgroundColor: 'var(--glass-bg)' }}
                      >
                        <div className="notification-item__content">
                          <h5>{notification.title}</h5>
                          <p>{notification.message}</p>
                          <span className="notification-item__time">
                            {notification.time}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="navbar__dropdown__footer">
                    <button className="btn btn-sm btn-primary">
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Messages */}
          <motion.button
            className="navbar__notification"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Messages"
          >
            <FontAwesomeIcon icon={faEnvelope} />
            <motion.span
              className="navbar__notification__badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              3
            </motion.span>
          </motion.button>

          {/* Profile */}
          <div className="navbar__dropdown">
            <motion.div
              className="navbar__profile"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <img
                src={user.avatar}
                alt={user.name}
                className="navbar__profile__avatar"
              />
              <div className="navbar__profile__info">
                <div className="navbar__profile__info__name">{user.name}</div>
                <div className="navbar__profile__info__role">{user.role}</div>
              </div>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className={`navbar__profile__chevron ${
                  profileDropdownOpen ? 'navbar__profile__chevron--rotated' : ''
                }`}
              />
            </motion.div>

            <AnimatePresence>
              {profileDropdownOpen && (
                <motion.div
                  className="navbar__dropdown__menu navbar__dropdown__menu--right"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="navbar__dropdown__header">
                    <div className="profile-header">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="profile-header__avatar"
                      />
                      <div className="profile-header__info">
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="navbar__dropdown__content">
                    <motion.div
                      className="dropdown-item"
                      whileHover={{ backgroundColor: 'var(--glass-bg)' }}
                    >
                      <FontAwesomeIcon icon={faUser} />
                      <span>My Profile</span>
                    </motion.div>
                    <motion.div
                      className="dropdown-item"
                      whileHover={{ backgroundColor: 'var(--glass-bg)' }}
                    >
                      <FontAwesomeIcon icon={faCog} />
                      <span>Settings</span>
                    </motion.div>
                    <hr />
                    <motion.div
                      className="dropdown-item dropdown-item--danger"
                      whileHover={{ backgroundColor: 'var(--danger)' }}
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} />
                      <span>Logout</span>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;