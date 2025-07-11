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
  Spinner,
  Badge
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faAppleAlt, 
  faCalculator, 
  faSpinner, 
  faImage,
  faFileImage,
  faUtensils,
  faFire
} from '@fortawesome/free-solid-svg-icons';

const Calories: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState<'image' | 'text'>('image');

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
    
    if (inputMethod === 'image' && !file) {
      setError('Por favor, selecione uma imagem da comida.');
      return;
    }
    
    if (inputMethod === 'text' && !textDescription.trim()) {
      setError('Por favor, descreva a comida.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      let response;
      
      if (inputMethod === 'image') {
        const formData = new FormData();
        formData.append('image', file!);
        
        response = await fetch('/calories', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/calories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: textDescription }),
        });
      }

      if (!response.ok) {
        throw new Error('Erro ao calcular calorias');
      }

      const data = await response.json();
      setResult(data.result || data.calories || 'Cálculo de calorias concluído');
    } catch (err) {
      setError('Erro ao calcular calorias. Tente novamente.');
      console.error('Calories calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="calories-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faAppleAlt} className="me-3" />
          Estimativa de Calorias
        </h1>
        <p className="page-subtitle">
          Calcule as calorias dos seus alimentos usando IA para análise de imagens ou descrições.
        </p>
      </motion.div>

      {/* Method Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-4"
      >
        <Card className="shadow-sm">
          <CardBody>
            <h5 className="mb-3">Método de Análise</h5>
            <div className="d-flex gap-3">
              <Button
                color={inputMethod === 'image' ? 'primary' : 'outline-primary'}
                onClick={() => setInputMethod('image')}
              >
                <FontAwesomeIcon icon={faImage} className="me-2" />
                Foto da Comida
              </Button>
              <Button
                color={inputMethod === 'text' ? 'primary' : 'outline-primary'}
                onClick={() => setInputMethod('text')}
              >
                <FontAwesomeIcon icon={faUtensils} className="me-2" />
                Descrição Textual
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <div className="row">
        {/* Input Section */}
        <div className="col-lg-6 mb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="shadow-sm h-100">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faCalculator} className="me-2" />
                  {inputMethod === 'image' ? 'Upload da Imagem' : 'Descrição da Comida'}
                </h5>
                
                <Form onSubmit={handleSubmit}>
                  {inputMethod === 'image' ? (
                    <FormGroup>
                      <Label for="imageFile" className="fw-bold">
                        Selecione uma foto da comida:
                      </Label>
                      <Input
                        type="file"
                        name="imageFile"
                        id="imageFile"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={loading}
                        className="mb-3"
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
                  ) : (
                    <FormGroup>
                      <Label for="textDescription" className="fw-bold">
                        Descreva os alimentos:
                      </Label>
                      <Input
                        type="textarea"
                        name="textDescription"
                        id="textDescription"
                        placeholder="Ex: 1 prato de arroz com feijão, 200g de frango grelhado, salada verde..."
                        rows={6}
                        value={textDescription}
                        onChange={(e) => setTextDescription(e.target.value)}
                        disabled={loading}
                        className="mb-3"
                      />
                      <small className="text-muted">
                        Seja específico com quantidades e métodos de preparo para melhor precisão.
                      </small>
                    </FormGroup>
                  )}
                  
                  <div className="d-grid">
                    <Button 
                      color="success" 
                      type="submit" 
                      disabled={loading || (inputMethod === 'image' && !file) || (inputMethod === 'text' && !textDescription.trim())}
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
                          Calculando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faFire} className="me-2" />
                          Calcular Calorias
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              </CardBody>
            </Card>
          </motion.div>
        </div>

        {/* Preview Section */}
        <div className="col-lg-6 mb-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="shadow-sm h-100">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faUtensils} className="me-2" />
                  Preview
                </h5>
                
                {inputMethod === 'image' ? (
                  imageUrl ? (
                    <div className="text-center">
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="img-fluid rounded shadow-sm"
                        style={{ maxHeight: '300px', width: 'auto' }}
                      />
                      <p className="mt-3 text-muted small">
                        Imagem da comida carregada
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <FontAwesomeIcon icon={faImage} size="4x" className="text-muted mb-3" />
                      <p className="text-muted">
                        Selecione uma imagem da comida
                      </p>
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-light rounded">
                    {textDescription ? (
                      <>
                        <h6 className="text-success">Descrição inserida:</h6>
                        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                          {textDescription}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted mb-0">
                        Digite a descrição dos alimentos no campo ao lado
                      </p>
                    )}
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
            <FontAwesomeIcon icon={faAppleAlt} className="me-2" />
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
                Analisando alimentos e calculando calorias...
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
              <h5 className="card-title text-success mb-3">
                <FontAwesomeIcon icon={faFire} className="me-2" />
                Resultado do Cálculo de Calorias
              </h5>
              
              <div 
                className="calories-result p-3 bg-light rounded"
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6'
                }}
              >
                {result}
              </div>
              
              <div className="mt-3">
                <small className="text-muted">
                  <strong>Aviso:</strong> Esta é uma estimativa baseada em IA. 
                  Para cálculos precisos, consulte um nutricionista.
                </small>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="shadow-sm bg-light">
          <CardBody>
            <h6 className="card-title">🍎 Dicas para melhor estimativa:</h6>
            <ul className="mb-0 small">
              <li>Tire fotos claras mostrando todo o prato</li>
              <li>Inclua objetos de referência (garfo, moeda) para escala</li>
              <li>Seja específico nas descrições (tamanhos, quantidades, preparo)</li>
              <li>Para pratos complexos, liste cada ingrediente separadamente</li>
              <li>Lembre-se: estas são estimativas, não valores exatos</li>
            </ul>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Calories;