import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Card, 
  CardBody, 
  Progress,
  Badge,
  Alert,
  Spinner,
  Button
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer, 
  faMemory, 
  faMicrochip, 
  faHdd,
  faNetworkWired,
  faSync,
  faChartLine,
  faDatabase,
  faGlobe
} from '@fortawesome/free-solid-svg-icons';

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    upload: number;
    download: number;
  };
  uptime: number;
  processes: number;
  loadAverage: number[];
}

const Resources: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch('/resources');
      if (!response.ok) throw new Error('Erro ao carregar recursos do sistema');
      
      const data = await response.json();
      setStats(data);
      setError('');
    } catch (err) {
      setError('Erro ao carregar informações do sistema: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'danger';
  };

  const getStatusBadge = (percentage: number): React.ReactNode => {
    if (percentage < 50) return <Badge color="success">Normal</Badge>;
    if (percentage < 80) return <Badge color="warning">Atenção</Badge>;
    return <Badge color="danger">Crítico</Badge>;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner size="lg" color="primary" />
        <p className="mt-3">Carregando recursos do sistema...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="resources-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title">
              <FontAwesomeIcon icon={faServer} className="me-3" />
              Recursos do Sistema
            </h1>
            <p className="page-subtitle">
              Monitoramento em tempo real dos recursos do servidor.
            </p>
          </div>
          <div>
            <Button
              color={autoRefresh ? 'success' : 'outline-secondary'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="me-2"
            >
              <FontAwesomeIcon icon={faSync} className="me-2" />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button color="primary" onClick={fetchStats}>
              <FontAwesomeIcon icon={faSync} className="me-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Alert color="danger" className="border-0 shadow-sm">
            <FontAwesomeIcon icon={faServer} className="me-2" />
            {error}
          </Alert>
        </motion.div>
      )}

      {stats && (
        <>
          {/* System Overview */}
          <div className="row mb-4">
            <div className="col-lg-3 col-md-6 mb-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="shadow-sm h-100">
                  <CardBody className="text-center">
                    <FontAwesomeIcon icon={faMicrochip} size="2x" className="text-primary mb-3" />
                    <h5>CPU</h5>
                    <h3 className="text-primary">{stats.cpu.usage.toFixed(1)}%</h3>
                    {getStatusBadge(stats.cpu.usage)}
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-3 col-md-6 mb-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="shadow-sm h-100">
                  <CardBody className="text-center">
                    <FontAwesomeIcon icon={faMemory} size="2x" className="text-info mb-3" />
                    <h5>Memória</h5>
                    <h3 className="text-info">{stats.memory.percentage.toFixed(1)}%</h3>
                    {getStatusBadge(stats.memory.percentage)}
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-3 col-md-6 mb-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Card className="shadow-sm h-100">
                  <CardBody className="text-center">
                    <FontAwesomeIcon icon={faHdd} size="2x" className="text-warning mb-3" />
                    <h5>Disco</h5>
                    <h3 className="text-warning">{stats.disk.percentage.toFixed(1)}%</h3>
                    {getStatusBadge(stats.disk.percentage)}
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-3 col-md-6 mb-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Card className="shadow-sm h-100">
                  <CardBody className="text-center">
                    <FontAwesomeIcon icon={faChartLine} size="2x" className="text-success mb-3" />
                    <h5>Uptime</h5>
                    <h6 className="text-success">{formatUptime(stats.uptime)}</h6>
                    <Badge color="success">Online</Badge>
                  </CardBody>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="row">
            <div className="col-lg-6 mb-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <Card className="shadow-sm">
                  <CardBody>
                    <h5 className="card-title">
                      <FontAwesomeIcon icon={faMicrochip} className="me-2" />
                      Processador
                    </h5>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span>Uso da CPU</span>
                        <span>{stats.cpu.usage.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={stats.cpu.usage} 
                        color={getProgressColor(stats.cpu.usage)}
                        className="mb-2"
                      />
                    </div>

                    <div className="row text-center">
                      <div className="col-6">
                        <strong>{stats.cpu.cores}</strong>
                        <br />
                        <small className="text-muted">Núcleos</small>
                      </div>
                      <div className="col-6">
                        <strong>{stats.loadAverage[0].toFixed(2)}</strong>
                        <br />
                        <small className="text-muted">Load Avg</small>
                      </div>
                    </div>

                    <hr />
                    <small className="text-muted">
                      <strong>Modelo:</strong> {stats.cpu.model || 'N/A'}
                    </small>
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-6 mb-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <Card className="shadow-sm">
                  <CardBody>
                    <h5 className="card-title">
                      <FontAwesomeIcon icon={faMemory} className="me-2" />
                      Memória
                    </h5>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span>Uso da Memória</span>
                        <span>{stats.memory.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={stats.memory.percentage} 
                        color={getProgressColor(stats.memory.percentage)}
                        className="mb-2"
                      />
                    </div>

                    <div className="row text-center">
                      <div className="col-6">
                        <strong>{formatBytes(stats.memory.used)}</strong>
                        <br />
                        <small className="text-muted">Usado</small>
                      </div>
                      <div className="col-6">
                        <strong>{formatBytes(stats.memory.total)}</strong>
                        <br />
                        <small className="text-muted">Total</small>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-6 mb-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <Card className="shadow-sm">
                  <CardBody>
                    <h5 className="card-title">
                      <FontAwesomeIcon icon={faHdd} className="me-2" />
                      Armazenamento
                    </h5>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span>Uso do Disco</span>
                        <span>{stats.disk.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={stats.disk.percentage} 
                        color={getProgressColor(stats.disk.percentage)}
                        className="mb-2"
                      />
                    </div>

                    <div className="row text-center">
                      <div className="col-6">
                        <strong>{formatBytes(stats.disk.used)}</strong>
                        <br />
                        <small className="text-muted">Usado</small>
                      </div>
                      <div className="col-6">
                        <strong>{formatBytes(stats.disk.total)}</strong>
                        <br />
                        <small className="text-muted">Total</small>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            </div>

            <div className="col-lg-6 mb-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
              >
                <Card className="shadow-sm">
                  <CardBody>
                    <h5 className="card-title">
                      <FontAwesomeIcon icon={faNetworkWired} className="me-2" />
                      Rede & Processos
                    </h5>
                    
                    <div className="row text-center mb-3">
                      <div className="col-6">
                        <strong>{formatBytes(stats.network.upload)}/s</strong>
                        <br />
                        <small className="text-muted">Upload</small>
                      </div>
                      <div className="col-6">
                        <strong>{formatBytes(stats.network.download)}/s</strong>
                        <br />
                        <small className="text-muted">Download</small>
                      </div>
                    </div>

                    <hr />

                    <div className="text-center">
                      <strong>{stats.processes}</strong>
                      <br />
                      <small className="text-muted">Processos Ativos</small>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.0 }}
      >
        <Card className="shadow-sm bg-light">
          <CardBody>
            <div className="row text-center">
              <div className="col-md-4">
                <FontAwesomeIcon icon={faDatabase} className="text-primary mb-2" />
                <h6>Sistema</h6>
                <small className="text-muted">Monitoramento contínuo</small>
              </div>
              <div className="col-md-4">
                <FontAwesomeIcon icon={faGlobe} className="text-success mb-2" />
                <h6>Status</h6>
                <small className="text-muted">Online e funcionando</small>
              </div>
              <div className="col-md-4">
                <FontAwesomeIcon icon={faSync} className="text-info mb-2" />
                <h6>Atualização</h6>
                <small className="text-muted">A cada 5 segundos</small>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Resources;