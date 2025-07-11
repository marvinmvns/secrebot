import React, { useState } from 'react';
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
  Spinner
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faImage, 
  faUpload, 
  faSpinner, 
  faEye,
  faFileImage,
  faCamera,
  faCopy
} from '@fortawesome/free-solid-svg-icons';

const Describe: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        setFile(selectedFile);
        setImageUrl(URL.createObjectURL(selectedFile));
        setError('');
      } else {
        setError('Por favor, selecione um arquivo de imagem válido.');
        setFile(null);
        setImageUrl(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, selecione uma imagem.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    const formData = new FormData();
    formData.append('image', file);
    if (prompt.trim()) {
      formData.append('prompt', prompt);
    }

    try {
      const response = await fetch('/describe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao processar imagem');
      }

      const data = await response.json();
      setResult(data.result || data.description || 'Análise da imagem concluída');
    } catch (err) {
      setError('Erro ao analisar imagem. Verifique se o arquivo é válido.');
      console.error('Image description error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      // Mostrar feedback visual de que foi copiado
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const file = droppedFiles[0];
      if (file.type.startsWith('image/')) {
        setFile(file);
        setImageUrl(URL.createObjectURL(file));
        setError('');
      } else {
        setError('Por favor, solte apenas arquivos de imagem.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="describe-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faEye} className="me-3" />
          Descrever Imagem
        </h1>
        <p className="page-subtitle">
          Use IA para analisar e descrever o conteúdo de imagens.
        </p>
      </motion.div>

      <div className="row">
        {/* Upload Section */}
        <div className="col-lg-6 mb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="shadow-sm h-100">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faUpload} className="me-2" />
                  Upload de Imagem
                </h5>
                
                <Form onSubmit={handleSubmit}>
                  <FormGroup>
                    <Label for="imageFile" className="fw-bold">
                      Selecione uma imagem:
                    </Label>
                    
                    {/* Drag and Drop Area */}
                    <div
                      className="upload-area border border-dashed rounded p-4 text-center mb-3"
                      style={{
                        borderColor: '#dee2e6',
                        backgroundColor: '#f8f9fa',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => document.getElementById('imageFile')?.click()}
                    >
                      <FontAwesomeIcon icon={faImage} size="3x" className="text-muted mb-3" />
                      <p className="mb-2">
                        <strong>Clique para selecionar</strong> ou arraste uma imagem aqui
                      </p>
                      <small className="text-muted">
                        Formatos suportados: JPG, PNG, GIF, WebP
                      </small>
                    </div>
                    
                    <Input
                      type="file"
                      name="imageFile"
                      id="imageFile"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={loading}
                      style={{ display: 'none' }}
                    />
                    
                    {file && (
                      <div className="file-info p-3 bg-light rounded mb-3">
                        <div className="d-flex align-items-center mb-2">
                          <FontAwesomeIcon icon={faFileImage} className="text-primary me-2" />
                          <div>
                            <div className="fw-bold">{file.name}</div>
                            <small className="text-muted">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </small>
                          </div>
                        </div>
                        
                        {imageUrl && (
                          <img 
                            src={imageUrl} 
                            alt="Preview" 
                            className="img-fluid rounded"
                            style={{ maxHeight: '200px', width: 'auto' }}
                          />
                        )}
                      </div>
                    )}
                  </FormGroup>

                  <FormGroup>
                    <Label for="prompt" className="fw-bold">
                      Prompt personalizado (opcional):
                    </Label>
                    <Input
                      type="textarea"
                      name="prompt"
                      id="prompt"
                      placeholder="Ex: Descreva esta imagem em detalhes, focando nas cores e objetos..."
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={loading}
                    />
                    <small className="text-muted">
                      Deixe em branco para uma descrição geral da imagem.
                    </small>
                  </FormGroup>
                  
                  <div className="d-grid">
                    <Button 
                      color="primary" 
                      type="submit" 
                      disabled={loading || !file}
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faEye} className="me-2" />
                          Analisar Imagem
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              </CardBody>
            </Card>
          </motion.div>
        </div>

        {/* Preview and Instructions */}
        <div className="col-lg-6 mb-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="shadow-sm h-100">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faCamera} className="me-2" />
                  Preview da Imagem
                </h5>
                
                {imageUrl ? (
                  <div className="text-center">
                    <img 
                      src={imageUrl} 
                      alt="Preview" 
                      className="img-fluid rounded shadow-sm"
                      style={{ maxHeight: '300px', width: 'auto' }}
                    />
                    <p className="mt-3 text-muted small">
                      Imagem carregada e pronta para análise
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <FontAwesomeIcon icon={faImage} size="4x" className="text-muted mb-3" />
                    <p className="text-muted">
                      Nenhuma imagem selecionada
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Alert color="danger" className="border-0 shadow-sm">
            <FontAwesomeIcon icon={faImage} className="me-2" />
            {error}
          </Alert>
        </motion.div>
      )}

      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <Card className="shadow-sm border-primary">
            <CardBody className="text-center py-4">
              <Spinner size="lg" color="primary" className="mb-3" />
              <p className="mb-0 text-muted">
                Analisando imagem com IA...
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <Card className="shadow-sm border-success">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title text-success mb-0">
                  <FontAwesomeIcon icon={faEye} className="me-2" />
                  Descrição da Imagem
                </h5>
                <Button 
                  color="outline-success" 
                  size="sm"
                  onClick={copyToClipboard}
                >
                  <FontAwesomeIcon icon={faCopy} className="me-2" />
                  Copiar
                </Button>
              </div>
              
              <div 
                className="description-result p-3 bg-light rounded"
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  fontSize: '1rem'
                }}
              >
                {result}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="shadow-sm bg-light">
          <CardBody>
            <h6 className="card-title">💡 Dicas para melhor resultado:</h6>
            <ul className="mb-0 small">
              <li>Use imagens com boa resolução e boa iluminação</li>
              <li>Formatos suportados: JPG, PNG, GIF, WebP</li>
              <li>Tamanho máximo recomendado: 10MB</li>
              <li>Para análises específicas, use prompts personalizados</li>
              <li>Imagens com texto podem ser lidas e descritas</li>
            </ul>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Describe;