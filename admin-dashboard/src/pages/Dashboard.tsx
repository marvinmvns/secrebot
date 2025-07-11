import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Row, Col, Card, CardBody } from 'reactstrap';
import StatsCard from '../components/Dashboard/StatsCard';
import ChartCard from '../components/Dashboard/ChartCard';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import QuickActions from '../components/Dashboard/QuickActions';
import RecentTransactions from '../components/Dashboard/RecentTransactions';
import SystemHealth from '../components/Dashboard/SystemHealth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faChartLine,
  faRobot,
  faDollarSign,
  faArrowUp,
  faArrowDown,
  faClock,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const Dashboard: React.FC = () => {
  
  // Fetch scheduling statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStatsData([
          {
            title: 'Total',
            value: data.total?.toString() || '0',
            change: '+0%',
            changeType: 'increase' as const,
            icon: faUsers,
            color: 'primary' as const,
          },
          {
            title: 'Pendentes',
            value: data.pending?.toString() || '0',
            change: '+0%',
            changeType: 'increase' as const,
            icon: faClock,
            color: 'warning' as const,
          },
          {
            title: 'Enviados',
            value: data.sent?.toString() || '0',
            change: '+0%',
            changeType: 'increase' as const,
            icon: faChartLine,
            color: 'success' as const,
          },
          {
            title: 'Falhos',
            value: data.failed?.toString() || '0',
            change: '0%',
            changeType: 'decrease' as const,
            icon: faArrowDown,
            color: 'danger' as const,
          },
        ]);
        setUpcomingSchedules(data.upcoming || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  React.useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);
  // Scheduling stats data
  const [statsData, setStatsData] = useState([
    {
      title: 'Total',
      value: '0',
      change: '+0%',
      changeType: 'increase' as const,
      icon: faUsers,
      color: 'primary' as const,
    },
    {
      title: 'Pendentes',
      value: '0',
      change: '+0%',
      changeType: 'increase' as const,
      icon: faClock,
      color: 'warning' as const,
    },
    {
      title: 'Enviados',
      value: '0',
      change: '+0%',
      changeType: 'increase' as const,
      icon: faChartLine,
      color: 'success' as const,
    },
    {
      title: 'Falhos',
      value: '0',
      change: '0%',
      changeType: 'decrease' as const,
      icon: faArrowDown,
      color: 'danger' as const,
    },
  ]);
  
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Users',
        data: [650, 800, 920, 1100, 1300, 1450],
        borderColor: '#4285F4',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Revenue',
        data: [450, 620, 750, 900, 1100, 1250],
        borderColor: '#34A853',
        backgroundColor: 'rgba(52, 168, 83, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const activities = [
    {
      id: 1,
      type: 'user_signup',
      message: 'New user John Doe signed up',
      time: '2 minutes ago',
      avatar: 'https://via.placeholder.com/32x32/4285F4/FFFFFF?text=JD',
    },
    {
      id: 2,
      type: 'ai_interaction',
      message: 'AI processed 50 new requests',
      time: '5 minutes ago',
      avatar: 'https://via.placeholder.com/32x32/34A853/FFFFFF?text=AI',
    },
    {
      id: 3,
      type: 'system_update',
      message: 'System update completed successfully',
      time: '10 minutes ago',
      avatar: 'https://via.placeholder.com/32x32/FBBC05/FFFFFF?text=SU',
    },
    {
      id: 4,
      type: 'payment',
      message: 'Payment of $299 received',
      time: '15 minutes ago',
      avatar: 'https://via.placeholder.com/32x32/EA4335/FFFFFF?text=$',
    },
  ];

  const quickActions = [
    {
      title: 'Chat com IA',
      description: 'Conversar com assistente',
      icon: faRobot,
      color: 'primary' as const,
      action: () => window.location.href = '/chat',
    },
    {
      title: 'Configurações',
      description: 'Editar configurações do sistema',
      icon: faClock,
      color: 'warning' as const,
      action: () => window.location.href = '/configs',
    },
    {
      title: 'Flow Builder',
      description: 'Construtor de fluxos WhatsApp',
      icon: faChartLine,
      color: 'success' as const,
      action: () => window.location.href = '/flow-builder',
    },
    {
      title: 'Recursos',
      description: 'Monitor de recursos do sistema',
      icon: faUsers,
      color: 'info' as const,
      action: () => window.location.href = '/resources',
    },
  ];

  const transactions = [
    {
      id: 1,
      description: 'Premium Subscription',
      amount: 299,
      status: 'completed' as const,
      date: '2025-01-10',
      user: 'John Smith',
    },
    {
      id: 2,
      description: 'AI API Credits',
      amount: 150,
      status: 'pending' as const,
      date: '2025-01-10',
      user: 'Sarah Johnson',
    },
    {
      id: 3,
      description: 'Enterprise License',
      amount: 999,
      status: 'completed' as const,
      date: '2025-01-09',
      user: 'Tech Corp',
    },
    {
      id: 4,
      description: 'Monthly Subscription',
      amount: 49,
      status: 'failed' as const,
      date: '2025-01-09',
      user: 'Mike Wilson',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="dashboard-page"
    >
      {/* Page Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faWhatsapp} className="me-3" />
          Dashboard de Agendamentos
        </h1>
        <p className="page-subtitle">
          Estatísticas e monitoramento dos agendamentos do WhatsApp.
        </p>
      </motion.div>

      {/* Stats Cards */}
      <Row className="mb-4">
        {statsData.map((stat, index) => (
          <Col lg={3} md={6} className="mb-3" key={stat.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
            >
              <StatsCard {...stat} />
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* Charts and System Health */}
      <Row className="mb-4">
        <Col lg={8} className="mb-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ChartCard
              title="Performance Overview"
              data={chartData}
              type="line"
            />
          </motion.div>
        </Col>
        <Col lg={4} className="mb-3">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <SystemHealth />
          </motion.div>
        </Col>
      </Row>

      {/* Upcoming Schedules */}
      <Row className="mb-4">
        <Col lg={12} className="mb-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="shadow-sm">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
                  Próximos Agendamentos
                </h5>
                {loading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm" role="status">
                      <span className="visually-hidden">Carregando...</span>
                    </div>
                  </div>
                ) : upcomingSchedules.length === 0 ? (
                  <div className="text-center py-3 text-muted">
                    Nenhum agendamento encontrado
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {upcomingSchedules.slice(0, 5).map((schedule: any, index) => (
                      <div key={index} className="list-group-item border-0">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <FontAwesomeIcon icon={faWhatsapp} className="text-success me-2" />
                            <span>{schedule.message}</span>
                          </div>
                          <small className="text-muted">
                            {new Date(schedule.scheduledTime).toLocaleString('pt-BR')}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </Col>
      </Row>
      
      {/* Quick Actions */}
      <Row className="mb-4">
        <Col lg={12} className="mb-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <QuickActions actions={quickActions} />
          </motion.div>
        </Col>
      </Row>

      {/* Recent Transactions */}
      <Row>
        <Col lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <RecentTransactions transactions={transactions} />
          </motion.div>
        </Col>
      </Row>
    </motion.div>
  );
};

export default Dashboard;