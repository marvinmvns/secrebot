import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardBody, Form, FormGroup, Label, Input, Button, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faRobot, faUser, faSpinner } from '@fortawesome/free-solid-svg-icons';

const Chat: React.FC = () => {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Erro ao processar mensagem');
      }

      const data = await response.json();
      setResult(data.result || data.response || 'Resposta recebida');
    } catch (err) {
      setError('Erro ao comunicar com o assistente. Tente novamente.');
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="chat-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faRobot} className="me-3" />
          Chat com Assistente
        </h1>
        <p className="page-subtitle">
          Converse com o assistente de IA para obter respostas e realizar tarefas.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="shadow-sm">
          <CardBody>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <Label for="message" className="fw-bold">
                  <FontAwesomeIcon icon={faUser} className="me-2" />
                  Sua mensagem:
                </Label>
                <Input
                  type="textarea"
                  name="message"
                  id="message"
                  placeholder="Digite sua pergunta ou comando..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={loading}
                  className="mb-3"
                />
              </FormGroup>
              
              <div className="text-end">
                <Button 
                  color="primary" 
                  type="submit" 
                  disabled={loading || !message.trim()}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPaperPlane} className="me-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </CardBody>
        </Card>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-4"
        >
          <Alert color="danger" className="border-0 shadow-sm">
            <FontAwesomeIcon icon={faRobot} className="me-2" />
            {error}
          </Alert>
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-4"
        >
          <Card className="shadow-sm border-success">
            <CardBody>
              <h5 className="card-title text-success mb-3">
                <FontAwesomeIcon icon={faRobot} className="me-2" />
                Resposta do Assistente:
              </h5>
              <div 
                className="result-content p-3 bg-light rounded"
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                {result}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4"
        >
          <Card className="shadow-sm border-primary">
            <CardBody className="text-center py-4">
              <FontAwesomeIcon 
                icon={faSpinner} 
                spin 
                size="2x" 
                className="text-primary mb-3" 
              />
              <p className="mb-0 text-muted">
                O assistente está processando sua mensagem...
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Chat;