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
  Progress
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone, 
  faUpload, 
  faSpinner, 
  faDownload,
  faFileAudio,
  faPlay,
  faPause,
  faStop
} from '@fortawesome/free-solid-svg-icons';

const Transcribe: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/')) {
        setFile(selectedFile);
        setAudioUrl(URL.createObjectURL(selectedFile));
        setError('');
      } else {
        setError('Por favor, selecione um arquivo de áudio válido.');
        setFile(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, selecione um arquivo de áudio.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao processar arquivo de áudio');
      }

      const data = await response.json();
      setResult(data.result || data.transcription || 'Transcrição realizada com sucesso');
    } catch (err) {
      setError('Erro ao transcrever áudio. Verifique se o arquivo é válido.');
      console.error('Transcription error:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Implementar gravação de áudio
      setIsRecording(true);
      setError('Gravação iniciada. Esta funcionalidade será implementada completamente em breve.');
    } catch (err) {
      setError('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Implementar parada da gravação
  };

  const downloadTranscription = () => {
    if (!result) return;

    const element = document.createElement('a');
    const file = new Blob([result], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcricao_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="transcribe-page"
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="page-title">
          <FontAwesomeIcon icon={faMicrophone} className="me-3" />
          Transcrever Áudio
        </h1>
        <p className="page-subtitle">
          Converta arquivos de áudio em texto usando tecnologia de IA.
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
                  Upload de Arquivo
                </h5>
                
                <Form onSubmit={handleSubmit}>
                  <FormGroup>
                    <Label for="audioFile" className="fw-bold">
                      Selecione um arquivo de áudio:
                    </Label>
                    <Input
                      type="file"
                      name="audioFile"
                      id="audioFile"
                      accept="audio/*"
                      onChange={handleFileChange}
                      disabled={loading}
                      className="mb-3"
                    />
                    
                    {file && (
                      <div className="file-info p-3 bg-light rounded mb-3">
                        <div className="d-flex align-items-center">
                          <FontAwesomeIcon icon={faFileAudio} className="text-primary me-2" />
                          <div>
                            <div className="fw-bold">{file.name}</div>
                            <small className="text-muted">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </small>
                          </div>
                        </div>
                        
                        {audioUrl && (
                          <audio controls className="mt-2 w-100">
                            <source src={audioUrl} type={file.type} />
                            Seu navegador não suporta o elemento de áudio.
                          </audio>
                        )}
                      </div>
                    )}
                  </FormGroup>
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mb-3">
                      <Label>Progresso do upload:</Label>
                      <Progress value={uploadProgress} className="mb-2" />
                      <small className="text-muted">{uploadProgress}% completado</small>
                    </div>
                  )}
                  
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
                          Transcrevendo...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faMicrophone} className="me-2" />
                          Transcrever Áudio
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              </CardBody>
            </Card>
          </motion.div>
        </div>

        {/* Recording Section */}
        <div className="col-lg-6 mb-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="shadow-sm h-100">
              <CardBody>
                <h5 className="card-title">
                  <FontAwesomeIcon icon={faMicrophone} className="me-2" />
                  Gravação Direta
                </h5>
                
                <div className="text-center py-4">
                  <div className="mb-4">
                    <FontAwesomeIcon 
                      icon={faMicrophone} 
                      size="3x" 
                      className={`text-${isRecording ? 'danger' : 'muted'}`}
                    />
                  </div>
                  
                  {!isRecording ? (
                    <Button 
                      color="danger" 
                      size="lg"
                      onClick={startRecording}
                      className="mb-3"
                    >
                      <FontAwesomeIcon icon={faPlay} className="me-2" />
                      Iniciar Gravação
                    </Button>
                  ) : (
                    <Button 
                      color="secondary" 
                      size="lg"
                      onClick={stopRecording}
                      className="mb-3"
                    >
                      <FontAwesomeIcon icon={faStop} className="me-2" />
                      Parar Gravação
                    </Button>
                  )}
                  
                  <p className="text-muted">
                    {isRecording ? 
                      'Gravando... Fale claramente no microfone.' : 
                      'Clique para iniciar a gravação de áudio.'
                    }
                  </p>
                </div>
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
            <FontAwesomeIcon icon={faMicrophone} className="me-2" />
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
                Processando áudio e gerando transcrição...
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
                  <FontAwesomeIcon icon={faMicrophone} className="me-2" />
                  Transcrição Concluída
                </h5>
                <Button 
                  color="outline-success" 
                  size="sm"
                  onClick={downloadTranscription}
                >
                  <FontAwesomeIcon icon={faDownload} className="me-2" />
                  Baixar Texto
                </Button>
              </div>
              
              <div 
                className="transcription-result p-3 bg-light rounded"
                style={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  lineHeight: '1.6'
                }}
              >
                {result}
              </div>
              
              <div className="mt-3 text-muted small">
                <strong>Dica:</strong> Você pode copiar o texto acima ou baixá-lo como arquivo .txt
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
              <li>Use arquivos de áudio com boa qualidade (sem muito ruído de fundo)</li>
              <li>Formatos suportados: MP3, WAV, M4A, OGG</li>
              <li>Tamanho máximo recomendado: 50MB</li>
              <li>Para gravações longas, divida em arquivos menores</li>
              <li>Fale de forma clara e pausada para melhor precisão</li>
            </ul>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Transcribe;