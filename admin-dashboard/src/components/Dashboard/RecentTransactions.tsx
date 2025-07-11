import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisV,
  faDownload,
  faFilter,
  faSearch,
  faCheck,
  faClock,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

interface Transaction {
  id: number;
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  user: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  variant?: 'default' | 'glass' | 'neuma';
  maxItems?: number;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  variant = 'default',
  maxItems = 10,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const getCardClasses = () => {
    let classes = 'dashboard-card transactions-table';
    
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return faCheck;
      case 'pending':
        return faClock;
      case 'failed':
        return faTimes;
      default:
        return faClock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const filteredTransactions = transactions
    .filter(transaction => {
      const matchesSearch = 
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.user.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || transaction.status === selectedStatus;
      return matchesSearch && matchesStatus;
    })
    .slice(0, maxItems);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      className={getCardClasses()}
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.2 }}
    >
      <div className="dashboard-card__header">
        <h3 className="dashboard-card__header__title">Recent Transactions</h3>
        <div className="dashboard-card__header__actions">
          <motion.button
            className="dashboard-card__header__action"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Download"
          >
            <FontAwesomeIcon icon={faDownload} />
          </motion.button>
          <motion.button
            className="dashboard-card__header__action"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Filter"
          >
            <FontAwesomeIcon icon={faFilter} />
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

      {/* Filters */}
      <div className="transactions-table__filters">
        <div className="transactions-table__search">
          <FontAwesomeIcon icon={faSearch} className="transactions-table__search__icon" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="transactions-table__search__input"
          />
        </div>
        
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="transactions-table__status-filter"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      
      <div className="transactions-table__content">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Description</th>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => (
                <motion.tr
                  key={transaction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ backgroundColor: 'var(--glass-bg)' }}
                >
                  <td>
                    <div className="transaction__description">
                      {transaction.description}
                    </div>
                  </td>
                  <td>
                    <div className="transaction__user">
                      {transaction.user}
                    </div>
                  </td>
                  <td>
                    <div className="transaction__amount">
                      {formatCurrency(transaction.amount)}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge--${getStatusColor(transaction.status)}`}>
                      <FontAwesomeIcon
                        icon={getStatusIcon(transaction.status)}
                        className="me-1"
                      />
                      {transaction.status}
                    </span>
                  </td>
                  <td>
                    <div className="transaction__date">
                      {formatDate(transaction.date)}
                    </div>
                  </td>
                  <td>
                    <motion.button
                      className="btn-icon"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="More actions"
                    >
                      <FontAwesomeIcon icon={faEllipsisV} />
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {filteredTransactions.length === 0 && (
        <div className="transactions-table__empty">
          <p>No transactions found matching your criteria.</p>
        </div>
      )}
      
      <div className="dashboard-card__footer">
        <span className="text-muted">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </span>
        <motion.button
          className="btn btn-sm btn-outline-primary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          View All Transactions
        </motion.button>
      </div>
    </motion.div>
  );
};

export default RecentTransactions;