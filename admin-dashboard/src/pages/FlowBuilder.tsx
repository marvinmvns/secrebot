import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Card, 
  CardBody, 
  Button, 
  ButtonGroup,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Alert
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSitemap, 
  faSave, 
  faFolderOpen, 
  faPlay, 
  faTrash, 
  faArrowLeft,
  faPlus,
  faComment,
  faCodeBranch,
  faKeyboard,
  faClock,
  faRobot,
  faPlug,
  faStop,
  faCode,
  faCalendar
} from '@fortawesome/free-solid-svg-icons';
import { 
  faYoutube, 
  faLinkedin, 
  faTelegram 
} from '@fortawesome/free-brands-svg-icons';

interface FlowNode {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  properties: { [key: string]: any };
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

const nodeTypes = [
  { type: 'start', title: 'Início', icon: faPlay, color: 'success', description: 'Ponto de entrada do fluxo' },
  { type: 'message', title: 'Mensagem', icon: faComment, color: 'primary', description: 'Enviar mensagem de texto' },
  { type: 'condition', title: 'Condição', icon: faCodeBranch, color: 'warning', description: 'Condicional baseada em entrada' },
  { type: 'input', title: 'Entrada', icon: faKeyboard, color: 'info', description: 'Aguardar entrada do usuário' },
  { type: 'delay', title: 'Delay', icon: faClock, color: 'secondary', description: 'Aguardar tempo específico' },
  { type: 'llm', title: 'IA/LLM', icon: faRobot, color: 'primary', description: 'Resposta inteligente' },
  { type: 'webhook', title: 'Webhook', icon: faPlug, color: 'dark', description: 'Chamar API externa' },
  { type: 'youtube', title: 'YouTube', icon: faYoutube, color: 'danger', description: 'Processar vídeo YouTube' },
  { type: 'calories', title: 'Calorias', icon: faPlus, color: 'success', description: 'Calcular calorias' },
  { type: 'linkedin', title: 'LinkedIn', icon: faLinkedin, color: 'primary', description: 'Scraper LinkedIn' },
  { type: 'telegram', title: 'Telegram', icon: faTelegram, color: 'info', description: 'Enviar para Telegram' },
  { type: 'calendar', title: 'Calendário', icon: faCalendar, color: 'info', description: 'Google Calendar' },
  { type: 'variable', title: 'Variável', icon: faCode, color: 'dark', description: 'Definir/usar variável' },
  { type: 'end', title: 'Fim', icon: faStop, color: 'danger', description: 'Finalizar fluxo' },
];

const FlowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [alert, setAlert] = useState<{type: string; message: string} | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const showAlert = (message: string, type: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleDragStart = (nodeType: string) => {
    setDraggedNodeType(nodeType);
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeTypeInfo = nodeTypes.find(nt => nt.type === draggedNodeType);
    if (!nodeTypeInfo) return;

    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type: draggedNodeType,
      title: nodeTypeInfo.title,
      x,
      y,
      properties: {}
    };

    setNodes(prev => [...prev, newNode]);
    setDraggedNodeType(null);
    showAlert(`Nó ${nodeTypeInfo.title} adicionado!`, 'success');
  }, [draggedNodeType]);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
    showAlert('Nó removido!', 'info');
  };

  const updateNodeProperties = (nodeId: string, properties: any) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, properties: { ...n.properties, ...properties } } : n
    ));
  };

  const saveFlow = async () => {
    if (!flowName.trim()) {
      showAlert('Por favor, informe o nome do fluxo.', 'warning');
      return;
    }

    try {
      const flowData = {
        name: flowName,
        description: flowDescription,
        nodes,
        connections,
        createdAt: new Date().toISOString()
      };

      const response = await fetch('/api/flow/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flowData)
      });

      if (!response.ok) throw new Error('Erro ao salvar fluxo');

      showAlert('Fluxo salvo com sucesso!', 'success');
      setShowSaveModal(false);
      setFlowName('');
      setFlowDescription('');
    } catch (error) {
      showAlert('Erro ao salvar fluxo: ' + (error as Error).message, 'danger');
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o canvas?')) {
      setNodes([]);
      setConnections([]);
      setSelectedNode(null);
      showAlert('Canvas limpo!', 'info');
    }
  };

  const testFlow = () => {
    if (nodes.length === 0) {
      showAlert('Adicione pelo menos um nó para testar o fluxo.', 'warning');
      return;
    }
    showAlert('Função de teste será implementada em breve.', 'info');
  };

  const renderNode = (node: FlowNode) => {
    const nodeType = nodeTypes.find(nt => nt.type === node.type);
    if (!nodeType) return null;

    return (
      <motion.div
        key={node.id}
        className={`flow-node border border-${nodeType.color} bg-white shadow-sm rounded p-3`}
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          minWidth: '200px',
          cursor: 'move',
          zIndex: selectedNode?.id === node.id ? 20 : 10
        }}
        onClick={() => setSelectedNode(node)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold text-dark">
            <FontAwesomeIcon icon={nodeType.icon} className={`text-${nodeType.color} me-2`} />
            {node.title}
          </div>
          <Button
            size="sm"
            color="outline-danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(node.id);
            }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </div>
        <small className="text-muted">{nodeType.description}</small>
      </motion.div>
    );
  };

  const renderNodePalette = () => (
    <div className="flow-sidebar p-3" style={{ width: '300px', maxHeight: '100vh', overflowY: 'auto' }}>
      <h5 className="mb-3">
        <FontAwesomeIcon icon={faPlus} className="me-2" />
        Blocos Disponíveis
      </h5>
      
      {nodeTypes.map((nodeType) => (
        <motion.div
          key={nodeType.type}
          className="node-item p-3 mb-2 bg-white border rounded shadow-sm"
          draggable
          onDragStart={() => handleDragStart(nodeType.type)}
          whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          style={{ cursor: 'grab' }}
        >
          <div className="d-flex align-items-center">
            <FontAwesomeIcon 
              icon={nodeType.icon} 
              className={`text-${nodeType.color} me-3`} 
              size="lg"
            />
            <div>
              <div className="fw-bold">{nodeType.title}</div>
              <small className="text-muted">{nodeType.description}</small>
            </div>
          </div>
        </motion.div>
      ))}

      <div className="mt-4 p-3 bg-light rounded">
        <h6 className="mb-2">Informações do Fluxo</h6>
        <div className="small text-muted">
          <div>Nós: <Badge color="primary">{nodes.length}</Badge></div>
          <div>Conexões: <Badge color="success">{connections.length}</Badge></div>
        </div>
      </div>
    </div>
  );

  const renderPropertiesPanel = () => (
    <div className="properties-panel p-3" style={{ width: '300px', maxHeight: '100vh', overflowY: 'auto' }}>
      <h5 className="mb-3">
        <FontAwesomeIcon icon={faCode} className="me-2" />
        Propriedades
      </h5>
      
      {selectedNode ? (
        <Card>
          <CardBody>
            <h6 className="card-title">{selectedNode.title}</h6>
            <Form>
              <FormGroup>
                <Label>Nome:</Label>
                <Input
                  type="text"
                  value={selectedNode.properties.name || ''}
                  onChange={(e) => updateNodeProperties(selectedNode.id, { name: e.target.value })}
                />
              </FormGroup>
              
              {selectedNode.type === 'message' && (
                <FormGroup>
                  <Label>Mensagem:</Label>
                  <Input
                    type="textarea"
                    rows={3}
                    value={selectedNode.properties.message || ''}
                    onChange={(e) => updateNodeProperties(selectedNode.id, { message: e.target.value })}
                  />
                </FormGroup>
              )}
              
              {selectedNode.type === 'delay' && (
                <FormGroup>
                  <Label>Tempo (segundos):</Label>
                  <Input
                    type="number"
                    value={selectedNode.properties.delay || 1}
                    onChange={(e) => updateNodeProperties(selectedNode.id, { delay: parseInt(e.target.value) })}
                  />
                </FormGroup>
              )}
              
              {selectedNode.type === 'webhook' && (
                <FormGroup>
                  <Label>URL:</Label>
                  <Input
                    type="url"
                    value={selectedNode.properties.url || ''}
                    onChange={(e) => updateNodeProperties(selectedNode.id, { url: e.target.value })}
                  />
                </FormGroup>
              )}
            </Form>
          </CardBody>
        </Card>
      ) : (
        <p className="text-muted">Selecione um nó para editar suas propriedades</p>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flow-builder-page"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="flow-header bg-primary text-white p-3">
        <div className="d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">
            <FontAwesomeIcon icon={faSitemap} className="me-3" />
            Construtor de Fluxos WhatsApp
          </h1>
          <ButtonGroup>
            <Button color="success" onClick={() => setShowSaveModal(true)}>
              <FontAwesomeIcon icon={faSave} className="me-2" />
              Salvar
            </Button>
            <Button color="light" onClick={testFlow}>
              <FontAwesomeIcon icon={faPlay} className="me-2" />
              Testar
            </Button>
            <Button color="warning" onClick={clearCanvas}>
              <FontAwesomeIcon icon={faTrash} className="me-2" />
              Limpar
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {alert && (
        <Alert color={alert.type} className="mb-0 border-0 rounded-0">
          {alert.message}
        </Alert>
      )}

      {/* Main Content */}
      <div className="d-flex flex-1 overflow-hidden">
        {/* Node Palette */}
        {renderNodePalette()}

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 position-relative"
          style={{
            background: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0)',
            backgroundSize: '20px 20px',
            overflow: 'auto'
          }}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {/* Render Nodes */}
          {nodes.map(renderNode)}

          {/* Mini Map */}
          <div 
            className="position-absolute bg-white border rounded shadow-sm p-2"
            style={{ bottom: '20px', right: '20px', width: '200px', height: '120px' }}
          >
            <div className="small text-muted text-center">Mini Mapa</div>
            <div className="small text-center mt-2">
              {nodes.length} nós no canvas
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        {renderPropertiesPanel()}
      </div>

      {/* Save Modal */}
      <Modal isOpen={showSaveModal} toggle={() => setShowSaveModal(false)}>
        <ModalHeader toggle={() => setShowSaveModal(false)}>
          Salvar Fluxo
        </ModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label for="flowName">Nome do Fluxo</Label>
              <Input
                type="text"
                id="flowName"
                placeholder="Meu Fluxo WhatsApp"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Label for="flowDescription">Descrição</Label>
              <Input
                type="textarea"
                id="flowDescription"
                rows={3}
                placeholder="Descrição do fluxo..."
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setShowSaveModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={saveFlow}>
            Salvar
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
};

export default FlowBuilder;