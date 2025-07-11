import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Card, 
  CardBody, 
  Form, 
  FormGroup, 
  Label, 
  Input, 
  Button, 
  Alert,
  Table,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faPlus, 
  faTrash, 
  faEdit,
  faClock,
  faCheck,
  faTimes,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

interface ScheduledMessage {
  id: string;
  message: string;
  scheduledTime: string;
  status: 'pending' | 'sent' | 'failed';
  phoneNumber?: string;
  createdAt: string;
}

const Scheduler: React.FC = () => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  
  // Form state
  const [message, setMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/scheduled-messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      setError('Erro ao carregar mensagens agendadas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !scheduledTime) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const response = await fetch('/api/scheduled-messages', {
        method: editingMessage ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingMessage?.id,
          message,
          scheduledTime,
          phoneNumber: phoneNumber || undefined,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        resetForm();
        fetchMessages();
        setError('');
      } else {
        throw new Error('Erro ao salvar mensagem');
      }
    } catch (error) {
      setError('Erro ao salvar mensagem agendada');
    }
  };

  const resetForm = () => {
    setMessage('');
    setScheduledTime('');
    setPhoneNumber('');
    setEditingMessage(null);
  };

  const openModal = (messageToEdit?: ScheduledMessage) => {
    if (messageToEdit) {
      setEditingMessage(messageToEdit);
      setMessage(messageToEdit.message);
      setScheduledTime(messageToEdit.scheduledTime);
      setPhoneNumber(messageToEdit.phoneNumber || '');
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const deleteMessage = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta mensagem agendada?')) {
      try {
        const response = await fetch(`/api/scheduled-messages/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          fetchMessages();
        } else {
          throw new Error('Erro ao excluir mensagem');
        }
      } catch (error) {
        setError('Erro ao excluir mensagem agendada');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="warning"><FontAwesomeIcon icon={faClock} className="me-1" />Pendente</Badge>;
      case 'sent':
        return <Badge color="success"><FontAwesomeIcon icon={faCheck} className="me-1" />Enviado</Badge>;
      case 'failed':
        return <Badge color="danger"><FontAwesomeIcon icon={faTimes} className="me-1" />Falhou</Badge>;
      default:
        return <Badge color="secondary">Desconhecido</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="scheduler-page"
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
              <FontAwesomeIcon icon={faCalendarAlt} className="me-3" />
              Agendamento de Mensagens
            </h1>
            <p className="page-subtitle">
              Gerencie mensagens agendadas do WhatsApp.
            </p>
          </div>
          <Button 
            color="primary" 
            onClick={() => openModal()}
            size="lg"
          >
            <FontAwesomeIcon icon={faPlus} className="me-2" />
            Nova Mensagem
          </Button>
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
            {error}
          </Alert>
        </motion.div>
      )}

      {/* Messages Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="shadow-sm">
          <CardBody>
            <h5 className="card-title mb-4">
              <FontAwesomeIcon icon={faWhatsapp} className="me-2" />
              Mensagens Agendadas
            </h5>
            
            {loading ? (
              <div className="text-center py-4">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-primary" />
                <p className="mt-3">Carregando mensagens...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-4">
                <FontAwesomeIcon icon={faCalendarAlt} size="3x" className="text-muted mb-3" />
                <p className="text-muted">Nenhuma mensagem agendada encontrada.</p>
                <Button color="primary" onClick={() => openModal()}>
                  <FontAwesomeIcon icon={faPlus} className="me-2" />
                  Criar primeira mensagem
                </Button>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover>
                  <thead>
                    <tr>
                      <th>Mensagem</th>
                      <th>Data/Hora</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg) => (
                      <tr key={msg.id}>
                        <td>
                          <div style={{ maxWidth: '300px' }}>
                            {msg.message.length > 100 
                              ? msg.message.substring(0, 100) + '...' 
                              : msg.message
                            }
                          </div>
                        </td>
                        <td>{new Date(msg.scheduledTime).toLocaleString('pt-BR')}</td>
                        <td>{msg.phoneNumber || 'N/A'}</td>
                        <td>{getStatusBadge(msg.status)}</td>
                        <td>
                          <div className="btn-group">
                            <Button
                              size="sm"
                              color="outline-primary"
                              onClick={() => openModal(msg)}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </Button>
                            <Button
                              size="sm"
                              color="outline-danger"
                              onClick={() => deleteMessage(msg.id)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Modal for Add/Edit Message */}
      <Modal isOpen={showModal} toggle={() => setShowModal(false)} size="lg">
        <ModalHeader toggle={() => setShowModal(false)}>
          {editingMessage ? 'Editar Mensagem' : 'Nova Mensagem Agendada'}
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Label for="message">Mensagem *</Label>
              <Input
                type="textarea"
                id="message"
                rows={5}
                placeholder="Digite a mensagem que será enviada..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </FormGroup>
            
            <FormGroup>
              <Label for="scheduledTime">Data e Hora do Agendamento *</Label>
              <Input
                type="datetime-local"
                id="scheduledTime"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
              />
            </FormGroup>
            
            <FormGroup>
              <Label for="phoneNumber">Número do Telefone (opcional)</Label>
              <Input
                type="tel"
                id="phoneNumber"
                placeholder="+5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <small className="text-muted">
                Deixe em branco para usar o número padrão configurado no sistema.
              </small>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleSubmit}>
            <FontAwesomeIcon icon={editingMessage ? faEdit : faPlus} className="me-2" />
            {editingMessage ? 'Atualizar' : 'Agendar'}
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
};

export default Scheduler;