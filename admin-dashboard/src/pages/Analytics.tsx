import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
} from 'chart.js';
import { Row, Col, Card, CardBody, CardHeader, Table, Badge, Spinner, Alert } from 'reactstrap';
import { faUsers, faComments, faMessage, faPhone } from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons';
import StatsCard from '../components/Dashboard/StatsCard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

interface AnalyticsSummary {
  totalUsers: number;
  totalMessages: number;
  platformStats: {
    whatsapp: number;
    telegram: number;
  };
  topUsers: Array<{
    phoneNumber: string;
    totalMessages: number;
    platform: string;
    lastInteraction: string;
  }>;
  dailyStats: Array<{
    _id: string;
    platforms: Array<{
      platform: string;
      messages: number;
      users: number;
    }>;
    totalMessages: number;
  }>;
}

interface PlatformStats {
  _id: string;
  users: number;
  totalMessages: number;
  avgMessages: number;
}

interface MessageTypeStats {
  _id: string;
  count: number;
}

const Analytics: React.FC = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [messageTypes, setMessageTypes] = useState<MessageTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedDays]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, platformRes, messageTypesRes] = await Promise.all([
        fetch('/api/analytics/summary'),
        fetch('/api/analytics/platform-stats'),
        fetch('/api/analytics/message-types')
      ]);

      if (!summaryRes.ok || !platformRes.ok || !messageTypesRes.ok) {
        throw new Error('Erro ao carregar dados de analytics');
      }

      const [summaryData, platformData, messageTypesData] = await Promise.all([
        summaryRes.json(),
        platformRes.json(),
        messageTypesRes.json()
      ]);

      setSummary(summaryData.data);
      setPlatformStats(platformData.data);
      setMessageTypes(messageTypesData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getDailyChartData = () => {
    if (!summary?.dailyStats) return null;

    const labels = summary.dailyStats.map(stat => {
      const date = new Date(stat._id);
      return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
    });

    const whatsappData = summary.dailyStats.map(stat => {
      const whatsapp = stat.platforms.find(p => p.platform === 'whatsapp');
      return whatsapp ? whatsapp.messages : 0;
    });

    const telegramData = summary.dailyStats.map(stat => {
      const telegram = stat.platforms.find(p => p.platform === 'telegram');
      return telegram ? telegram.messages : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: 'WhatsApp',
          data: whatsappData,
          borderColor: '#25D366',
          backgroundColor: 'rgba(37, 211, 102, 0.1)',
          borderWidth: 2,
          fill: true,
        },
        {
          label: 'Telegram',
          data: telegramData,
          borderColor: '#0088cc',
          backgroundColor: 'rgba(0, 136, 204, 0.1)',
          borderWidth: 2,
          fill: true,
        },
      ],
    };
  };

  const getPlatformDistributionData = () => {
    if (!summary?.platformStats) return null;

    return {
      labels: ['WhatsApp', 'Telegram'],
      datasets: [
        {
          data: [summary.platformStats.whatsapp, summary.platformStats.telegram],
          backgroundColor: ['#25D366', '#0088cc'],
          borderWidth: 0,
        },
      ],
    };
  };

  const getMessageTypesData = () => {
    if (!messageTypes.length) return null;

    return {
      labels: messageTypes.map(type => type._id || 'Outros'),
      datasets: [
        {
          data: messageTypes.map(type => type.count),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
          ],
          borderWidth: 0,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '400px' }}
      >
        <Spinner color="primary" size="lg" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Alert color="danger">
          <h4>Erro ao carregar analytics</h4>
          <p>{error}</p>
          <button className="btn btn-outline-danger" onClick={fetchAnalyticsData}>
            Tentar novamente
          </button>
        </Alert>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="analytics-page"
    >
      <div className="page-header">
        <h1 className="page-title">Analytics de Chat</h1>
        <p className="page-subtitle">
          Análise detalhada das interações no WhatsApp e Telegram
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <Row className="mb-4">
        <Col lg="3" md="6" className="mb-3">
          <StatsCard
            title="Total de Usuários"
            value={(summary?.totalUsers || 0).toLocaleString('pt-BR')}
            change="0%"
            changeType="increase"
            icon={faUsers}
            color="primary"
          />
        </Col>
        <Col lg="3" md="6" className="mb-3">
          <StatsCard
            title="Total de Mensagens"
            value={(summary?.totalMessages || 0).toLocaleString('pt-BR')}
            change="0%"
            changeType="increase"
            icon={faComments}
            color="success"
          />
        </Col>
        <Col lg="3" md="6" className="mb-3">
          <StatsCard
            title="Usuários WhatsApp"
            value={(summary?.platformStats.whatsapp || 0).toLocaleString('pt-BR')}
            change="0%"
            changeType="increase"
            icon={faMessage}
            color="info"
          />
        </Col>
        <Col lg="3" md="6" className="mb-3">
          <StatsCard
            title="Usuários Telegram"
            value={(summary?.platformStats.telegram || 0).toLocaleString('pt-BR')}
            change="0%"
            changeType="increase"
            icon={faTelegram}
            color="warning"
          />
        </Col>
      </Row>

      <Row className="mb-4">
        {/* Gráfico de Mensagens Diárias */}
        <Col lg="8" className="mb-4">
          <Card className="dashboard-card">
            <CardHeader>
              <h5 className="mb-0">
                📊 Mensagens por Dia
              </h5>
              <div className="card-header-actions">
                <select
                  className="form-select form-select-sm"
                  value={selectedDays}
                  onChange={(e) => setSelectedDays(Number(e.target.value))}
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </div>
            </CardHeader>
            <CardBody>
              <div style={{ height: '300px' }}>
                {getDailyChartData() && (
                  <Line data={getDailyChartData()!} options={chartOptions} />
                )}
              </div>
            </CardBody>
          </Card>
        </Col>

        {/* Distribuição por Plataforma */}
        <Col lg="4" className="mb-4">
          <Card className="dashboard-card">
            <CardHeader>
              <h5 className="mb-0">Distribuição por Plataforma</h5>
            </CardHeader>
            <CardBody>
              <div style={{ height: '300px' }}>
                {getPlatformDistributionData() && (
                  <Doughnut data={getPlatformDistributionData()!} options={doughnutOptions} />
                )}
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row className="mb-4">
        {/* Tipos de Mensagem */}
        <Col lg="6" className="mb-4">
          <Card className="dashboard-card">
            <CardHeader>
              <h5 className="mb-0">Tipos de Mensagem</h5>
            </CardHeader>
            <CardBody>
              <div style={{ height: '300px' }}>
                {getMessageTypesData() && (
                  <Doughnut data={getMessageTypesData()!} options={doughnutOptions} />
                )}
              </div>
            </CardBody>
          </Card>
        </Col>

        {/* Top Usuários */}
        <Col lg="6" className="mb-4">
          <Card className="dashboard-card">
            <CardHeader>
              <h5 className="mb-0">Top Usuários por Mensagens</h5>
            </CardHeader>
            <CardBody>
              <Table responsive className="mb-0">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Plataforma</th>
                    <th>Mensagens</th>
                    <th>Última Interação</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.topUsers.slice(0, 10).map((user, index) => (
                    <tr key={user.phoneNumber}>
                      <td>
                        <span className="fw-bold">#{index + 1}</span>
                        <br />
                        <small className="text-muted">
                          {user.phoneNumber.slice(0, 8)}...
                        </small>
                      </td>
                      <td>
                        <Badge
                          color={user.platform === 'whatsapp' ? 'success' : 'info'}
                          pill
                        >
                          {user.platform === 'whatsapp' ? (
                            <>
                              📱 WhatsApp
                            </>
                          ) : (
                            <>
                              ✈️ Telegram
                            </>
                          )}
                        </Badge>
                      </td>
                      <td>
                        <span className="fw-bold">{user.totalMessages}</span>
                      </td>
                      <td>
                        🕒 <small>
                          {new Date(user.lastInteraction).toLocaleDateString('pt-BR')}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Estatísticas Detalhadas por Plataforma */}
      <Row>
        <Col lg="12">
          <Card className="dashboard-card">
            <CardHeader>
              <h5 className="mb-0">Estatísticas Detalhadas por Plataforma</h5>
            </CardHeader>
            <CardBody>
              <Table responsive>
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th>Total de Usuários</th>
                    <th>Total de Mensagens</th>
                    <th>Média de Mensagens/Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {platformStats.map((stat) => (
                    <tr key={stat._id}>
                      <td>
                        <Badge
                          color={stat._id === 'whatsapp' ? 'success' : 'info'}
                          pill
                          className="me-2"
                        >
                          {stat._id === 'whatsapp' ? (
                            <>
                              📱 WhatsApp
                            </>
                          ) : (
                            <>
                              ✈️ Telegram
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="fw-bold">{stat.users.toLocaleString('pt-BR')}</td>
                      <td className="fw-bold">{stat.totalMessages.toLocaleString('pt-BR')}</td>
                      <td className="fw-bold">{Math.round(stat.avgMessages).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </motion.div>
  );
};

export default Analytics;