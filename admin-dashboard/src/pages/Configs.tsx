import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Card, 
  CardBody, 
  Button, 
  ButtonGroup, 
  Nav, 
  NavItem, 
  NavLink, 
  TabContent, 
  TabPane,
  Input,
  Form,
  FormGroup,
  Label,
  Alert,
  Spinner,
  Badge,
  Collapse,
  Progress
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCog, 
  faDatabase, 
  faCode, 
  faSave, 
  faDownload, 
  faUndo, 
  faSync,
  faExpand,
  faCompress,
  faEye,
  faSearch,
  faCheck,
  faExclamationTriangle,
  faChevronDown,
  faChevronRight,
  faUpload,
  faEyeSlash,
  faMagic,
  faExpandArrowsAlt,
  faCompressArrowsAlt,
  faTools,
  faShieldAlt,
  faServer,
  faBrain,
  faMicrophone,
  faVolumeUp,
  faCloud,
  faShare,
  faBolt
} from '@fortawesome/free-solid-svg-icons';

interface ConfigValue {
  [key: string]: any;
}

interface ConfigCategory {
  name: string;
  icon: any;
  description: string;
  items: string[];
}

interface ConfigMetadata {
  [key: string]: {
    description: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    category: string;
    sensitive?: boolean;
    advanced?: boolean;
    example?: any;
  };
}

const Configs: React.FC = () => {
  const [currentConfig, setCurrentConfig] = useState<ConfigValue>({});
  const [originalConfig, setOriginalConfig] = useState<ConfigValue>({});
  const [activeTab, setActiveTab] = useState('visual');
  const [jsonValue, setJsonValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [alert, setAlert] = useState<{type: string; message: string} | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sensitiveVisible, setSensitiveVisible] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [jsonHistory, setJsonHistory] = useState<string[]>([]);
  const [jsonHistoryIndex, setJsonHistoryIndex] = useState(-1);

  // Configuration categories with icons
  const configCategories: ConfigCategory[] = [
    {
      name: 'Debug & Logging',
      icon: faTools,
      description: 'Configurações de depuração e logs do sistema',
      items: ['debug.enabled', 'debug.verbose', 'debug.logLevel']
    },
    {
      name: 'Database',
      icon: faDatabase,
      description: 'Configurações de conexão com MongoDB',
      items: ['mongo.uri', 'mongo.dbName', 'mongo.collectionName']
    },
    {
      name: 'Server',
      icon: faServer,
      description: 'Configurações do servidor web',
      items: ['server.port']
    },
    {
      name: 'Scheduler',
      icon: faBolt,
      description: 'Agendamento e execução de tarefas',
      items: ['scheduler.interval', 'scheduler.maxAttempts', 'scheduler.retryDelay', 'scheduler.concurrency', 
               'scheduler.dynamic.enabled', 'scheduler.dynamic.min', 'scheduler.dynamic.max', 
               'scheduler.dynamic.cpuThreshold', 'scheduler.dynamic.memThreshold']
    },
    {
      name: 'Queue Management',
      icon: faShare,
      description: 'Gestão de filas e processamento paralelo',
      items: ['queues.llmConcurrency', 'queues.whisperConcurrency', 'queues.memoryThresholdGB', 'queues.memoryCheckInterval']
    },
    {
      name: 'LLM/AI',
      icon: faBrain,
      description: 'Configurações de inteligência artificial',
      items: ['llm.model', 'llm.imageModel', 'llm.maxTokens', 'llm.host', 'llm.timeoutMs']
    },
    {
      name: 'Audio Processing',
      icon: faMicrophone,
      description: 'Processamento e transcrição de áudio',
      items: ['audio.sampleRate', 'audio.model', 'audio.language', 'audio.timeoutMs']
    },
    {
      name: 'Text-to-Speech',
      icon: faVolumeUp,
      description: 'Síntese de voz e TTS',
      items: ['elevenlabs.apiKey', 'elevenlabs.voiceId', 'elevenlabs.modelId', 'elevenlabs.stability', 
               'elevenlabs.similarityBoost', 'piper.enabled', 'piper.executable', 'piper.model']
    },
    {
      name: 'External APIs',
      icon: faCloud,
      description: 'Integrações com APIs externas',
      items: ['calorieApi.url', 'calorieApi.key', 'google.clientId', 'google.clientSecret', 'google.redirect',
               'linkedin.user', 'linkedin.pass', 'linkedin.liAt', 'linkedin.timeoutMs']
    },
    {
      name: 'Telegram Bot',
      icon: faShare,
      description: 'Configurações do bot do Telegram',
      items: ['telegram.botToken', 'telegram.enableTTS', 'telegram.maxFileSize']
    }
  ];

  // Sensitive fields that should be masked
  const sensitiveFields = new Set([
    'elevenlabs.apiKey', 'calorieApi.key', 'google.clientSecret', 
    'linkedin.pass', 'linkedin.liAt', 'telegram.botToken', 'mongo.uri'
  ]);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (Object.keys(currentConfig).length > 0) {
      setJsonValue(JSON.stringify(currentConfig, null, 2));
    }
  }, [currentConfig]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/configs');
      if (!response.ok) throw new Error('Erro ao carregar configurações');
      
      const data = await response.json();
      setCurrentConfig(data);
      setOriginalConfig(data);
      setHasUnsavedChanges(false);
      showAlert('Configurações carregadas com sucesso!', 'success');
    } catch (error) {
      showAlert('Erro ao carregar configurações: ' + (error as Error).message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      let configToSave = currentConfig;
      
      if (activeTab === 'json') {
        try {
          configToSave = JSON.parse(jsonValue);
        } catch (error) {
          showAlert('JSON inválido. Corrija os erros antes de salvar.', 'danger');
          setSaving(false);
          return;
        }
      }

      const response = await fetch('/api/configs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave)
      });

      if (!response.ok) throw new Error('Erro ao salvar configurações');

      setCurrentConfig(configToSave);
      showAlert('Configurações salvas com sucesso! A solução será reiniciada.', 'success');
    } catch (error) {
      showAlert('Erro ao salvar configurações: ' + (error as Error).message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(currentConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `secrebot-config-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showAlert('Configuração exportada com sucesso!', 'success');
  };

  const resetToDefaults = async () => {
    if (window.confirm('Tem certeza que deseja restaurar todas as configurações para os valores padrão?')) {
      setLoading(true);
      try {
        const response = await fetch('/api/configs/reset', { method: 'POST' });
        const data = await response.json();
        setCurrentConfig(data);
        showAlert('Configurações restauradas para os valores padrão!', 'success');
      } catch (error) {
        showAlert('Erro ao restaurar configurações: ' + (error as Error).message, 'danger');
      } finally {
        setLoading(false);
      }
    }
  };

  const validateJson = () => {
    try {
      JSON.parse(jsonValue);
      showAlert('JSON válido! ✅', 'success');
    } catch (error) {
      showAlert('JSON inválido: ' + (error as Error).message, 'danger');
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      setJsonValue(JSON.stringify(parsed, null, 2));
      showAlert('JSON formatado com sucesso!', 'info');
    } catch (error) {
      showAlert('Erro ao formatar JSON: ' + (error as Error).message, 'danger');
    }
  };

  const showAlert = (message: string, type: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const updateConfigValue = (path: string, value: any) => {
    const keys = path.split('.');
    const newConfig = { ...currentConfig };
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    setCurrentConfig(newConfig);
    setHasUnsavedChanges(true);
    
    // Auto-save functionality
    if (autoSave) {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      const timer = setTimeout(() => {
        saveConfigs();
      }, 3000);
      setAutoSaveTimer(timer);
    }
  };
  
  const getConfigValue = (path: string): any => {
    const keys = path.split('.');
    let current = currentConfig;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  };
  
  const toggleSectionCollapse = (categoryName: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(categoryName)) {
      newCollapsed.delete(categoryName);
    } else {
      newCollapsed.add(categoryName);
    }
    setCollapsedSections(newCollapsed);
  };
  
  const expandAllSections = () => {
    setCollapsedSections(new Set());
  };
  
  const collapseAllSections = () => {
    const allCategories = new Set(configCategories.map(cat => cat.name));
    setCollapsedSections(allCategories);
  };
  
  const toggleSensitiveVisibility = (path: string) => {
    const newVisible = new Set(sensitiveVisible);
    if (newVisible.has(path)) {
      newVisible.delete(path);
    } else {
      newVisible.add(path);
    }
    setSensitiveVisible(newVisible);
  };

  const renderConfigByCategory = (): React.ReactNode => {
    return configCategories.map((category) => {
      const isCollapsed = collapsedSections.has(category.name);
      const filteredItems = category.items.filter(item => {
        if (!searchTerm) return true;
        const value = getConfigValue(item);
        return item.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()));
      });

      if (filteredItems.length === 0 && searchTerm) return null;

      return (
        <motion.div
          key={category.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="config-section mb-4"
        >
          <div 
            className="config-section-title d-flex align-items-center justify-content-between p-3 bg-light border rounded cursor-pointer"
            onClick={() => toggleSectionCollapse(category.name)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="d-flex align-items-center">
              <FontAwesomeIcon icon={category.icon} className="me-3 text-primary" />
              <div>
                <h5 className="mb-1">{category.name}</h5>
                <small className="text-muted">{category.description}</small>
              </div>
            </div>
            <FontAwesomeIcon 
              icon={isCollapsed ? faChevronRight : faChevronDown} 
              className="text-muted" 
            />
          </div>
          
          <Collapse isOpen={!isCollapsed}>
            <div className="p-3">
              {filteredItems.map((configPath) => {
                const value = getConfigValue(configPath);
                const isSensitive = sensitiveFields.has(configPath);
                const isVisible = sensitiveVisible.has(configPath);
                
                return (
                  <motion.div
                    key={configPath}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="config-item mb-3 p-3 border rounded bg-white"
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <div className="config-key fw-bold text-dark mb-1">
                          {configPath.split('.').pop()}
                        </div>
                        <div className="config-path text-muted small">
                          <code>{configPath}</code>
                        </div>
                      </div>
                      {isSensitive && (
                        <Button
                          size="sm"
                          color="link"
                          className="p-0 text-muted"
                          onClick={() => toggleSensitiveVisibility(configPath)}
                        >
                          <FontAwesomeIcon icon={isVisible ? faEyeSlash : faEye} />
                        </Button>
                      )}
                    </div>
                    
                    <div className="config-value-container">
                      {typeof value === 'boolean' ? (
                        <FormGroup check className="mb-0">
                          <Input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => updateConfigValue(configPath, e.target.checked)}
                          />
                          <Label check className="ms-2">
                            {value ? 'Habilitado' : 'Desabilitado'}
                          </Label>
                        </FormGroup>
                      ) : Array.isArray(value) ? (
                        <div className="array-config">
                          <Badge color="info" className="mb-2">
                            Array com {value.length} itens
                          </Badge>
                          {value.map((item, index) => (
                            <Input
                              key={index}
                              type="text"
                              bsSize="sm"
                              className="mb-2"
                              value={typeof item === 'string' ? item : JSON.stringify(item)}
                              onChange={(e) => {
                                const newValue = [...value];
                                try {
                                  newValue[index] = JSON.parse(e.target.value);
                                } catch {
                                  newValue[index] = e.target.value;
                                }
                                updateConfigValue(configPath, newValue);
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="position-relative">
                          <Input
                            type={isSensitive && !isVisible ? 'password' : 
                                  typeof value === 'number' ? 'number' : 'text'}
                            value={value || ''}
                            onChange={(e) => {
                              const newValue = typeof value === 'number' ? 
                                parseFloat(e.target.value) || 0 : e.target.value;
                              updateConfigValue(configPath, newValue);
                            }}
                            placeholder={`Configurar ${configPath.split('.').pop()}`}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Collapse>
        </motion.div>
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="configs-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faDatabase} className="me-3" />
          Configurações do Sistema
        </h1>
        <p className="page-subtitle">
          Visualize e edite todas as configurações armazenadas na base de dados.
        </p>
      </motion.div>

      {alert && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Alert color={alert.type} className="border-0 shadow-sm">
            <FontAwesomeIcon 
              icon={alert.type === 'danger' ? faExclamationTriangle : faCheck} 
              className="me-2" 
            />
            {alert.message}
          </Alert>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="shadow-sm">
          <CardBody>
            {/* Control Actions */}
            <div className="config-actions mb-4 p-3 bg-light border rounded">
              <div className="row">
                <div className="col-md-9">
                  <div className="d-flex flex-wrap gap-2">
                    <ButtonGroup>
                      <Button 
                        color="outline-primary" 
                        onClick={loadConfigs}
                        disabled={loading}
                        data-bs-toggle="tooltip"
                        title="Recarregar configurações do servidor"
                      >
                        <FontAwesomeIcon icon={faSync} className="me-2" />
                        Recarregar
                      </Button>
                      <Button 
                        color="outline-secondary" 
                        onClick={formatJson}
                        data-bs-toggle="tooltip"
                        title="Formatar JSON com indentação"
                      >
                        <FontAwesomeIcon icon={faCode} className="me-2" />
                        Formatar
                      </Button>
                      <Button 
                        color="outline-info" 
                        onClick={exportConfig}
                        data-bs-toggle="tooltip"
                        title="Exportar configuração para arquivo"
                      >
                        <FontAwesomeIcon icon={faDownload} className="me-2" />
                        Exportar
                      </Button>
                      <Button 
                        color="outline-warning" 
                        onClick={resetToDefaults}
                        data-bs-toggle="tooltip"
                        title="Restaurar valores padrão"
                      >
                        <FontAwesomeIcon icon={faUndo} className="me-2" />
                        Padrões
                      </Button>
                    </ButtonGroup>
                    
                    <ButtonGroup>
                      <Button 
                        color="outline-secondary" 
                        onClick={expandAllSections}
                        data-bs-toggle="tooltip"
                        title="Expandir todas as seções"
                      >
                        <FontAwesomeIcon icon={faExpandArrowsAlt} className="me-2" />
                        Expandir
                      </Button>
                      <Button 
                        color="outline-secondary" 
                        onClick={collapseAllSections}
                        data-bs-toggle="tooltip"
                        title="Recolher todas as seções"
                      >
                        <FontAwesomeIcon icon={faCompressArrowsAlt} className="me-2" />
                        Recolher
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>
                <div className="col-md-3 text-end">
                  <Button 
                    color={hasUnsavedChanges ? "warning" : "success"}
                    size="lg"
                    onClick={saveConfigs}
                    disabled={saving}
                    data-bs-toggle="tooltip"
                    title="Salvar alterações e reiniciar sistema"
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faSave} className="me-2" />
                        {hasUnsavedChanges ? 'Salvar Mudanças' : 'Salvar e Reiniciar'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="config-search mb-4">
              <div className="row">
                <div className="col-md-6">
                  <div className="input-group">
                    <span className="input-group-text">
                      <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <Input
                      type="text"
                      placeholder="Buscar configuração..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-3">
                    <FormGroup check className="mb-0">
                      <Input
                        type="checkbox"
                        checked={showAdvanced}
                        onChange={(e) => setShowAdvanced(e.target.checked)}
                      />
                      <Label check>
                        <FontAwesomeIcon icon={faCog} className="me-2" />
                        Mostrar configurações avançadas
                      </Label>
                    </FormGroup>
                    <FormGroup check className="mb-0">
                      <Input
                        type="checkbox"
                        checked={autoSave}
                        onChange={(e) => setAutoSave(e.target.checked)}
                      />
                      <Label check>
                        <FontAwesomeIcon icon={faMagic} className="me-2" />
                        Salvar automaticamente
                      </Label>
                    </FormGroup>
                  </div>
                </div>
              </div>
              {hasUnsavedChanges && (
                <div className="mt-3">
                  <Alert color="warning" className="mb-0">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                    <strong>Alterações não salvas!</strong> Você tem modificações que ainda não foram salvas.
                  </Alert>
                </div>
              )}
            </div>

            {/* Tabs */}
            <Nav tabs className="mb-4">
              <NavItem>
                <NavLink
                  className={activeTab === 'visual' ? 'active' : ''}
                  onClick={() => setActiveTab('visual')}
                  style={{ cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={faEye} className="me-2" />
                  Visual
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeTab === 'json' ? 'active' : ''}
                  onClick={() => setActiveTab('json')}
                  style={{ cursor: 'pointer' }}
                >
                  <FontAwesomeIcon icon={faCode} className="me-2" />
                  JSON
                </NavLink>
              </NavItem>
            </Nav>

            {/* Tab Content */}
            <TabContent activeTab={activeTab}>
              <TabPane tabId="visual">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner size="lg" color="primary" />
                    <p className="mt-3">Carregando configurações...</p>
                  </div>
                ) : (
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }} className="config-categories">
                    {renderConfigByCategory()}
                  </div>
                )}
              </TabPane>

              <TabPane tabId="json">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Label className="fw-bold">Editor JSON Avançado:</Label>
                  <ButtonGroup size="sm">
                    <Button color="outline-primary" onClick={validateJson}>
                      <FontAwesomeIcon icon={faCheck} className="me-1" />
                      Validar
                    </Button>
                    <Button color="outline-secondary" onClick={formatJson}>
                      <FontAwesomeIcon icon={faCode} className="me-1" />
                      Formatar
                    </Button>
                  </ButtonGroup>
                </div>
                <Input
                  type="textarea"
                  rows={25}
                  value={jsonValue}
                  onChange={(e) => setJsonValue(e.target.value)}
                  style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}
                />
              </TabPane>
            </TabContent>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Configs;