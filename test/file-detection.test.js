import { test } from 'node:test';
import assert from 'node:assert/strict';

test('File type detection functions', async () => {
  // Função para detectar PDF por magic bytes
  const detectPdfByHeader = (buffer) => {
    if (buffer.length < 4) return false;
    const header = buffer.subarray(0, 4).toString('ascii');
    return header === '%PDF';
  };
  
  // Função para detectar DOCX por magic bytes (ZIP signature)
  const detectDocxByHeader = (buffer) => {
    if (buffer.length < 4) return false;
    const header = buffer.subarray(0, 4);
    return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
  };

  // Teste PDF magic bytes
  const pdfHeader = Buffer.from('%PDF-1.4', 'ascii');
  assert.equal(detectPdfByHeader(pdfHeader), true);
  
  // Teste ZIP/DOCX magic bytes
  const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  assert.equal(detectDocxByHeader(zipHeader), true);
  
  // Teste arquivo muito pequeno
  const smallBuffer = Buffer.from([0x50]);
  assert.equal(detectPdfByHeader(smallBuffer), false);
  assert.equal(detectDocxByHeader(smallBuffer), false);
  
  // Teste arquivo com header errado
  const wrongHeader = Buffer.from('ABCD', 'ascii');
  assert.equal(detectPdfByHeader(wrongHeader), false);
  assert.equal(detectDocxByHeader(wrongHeader), false);
});

test('File type detection logic simulation', async () => {
  const detectFileType = (filename, mimetype, buffer) => {
    // Reproduzir a lógica do whatsAppBot.js
    const detectPdfByHeader = (buffer) => {
      if (buffer.length < 4) return false;
      const header = buffer.subarray(0, 4).toString('ascii');
      return header === '%PDF';
    };
    
    const detectDocxByHeader = (buffer) => {
      if (buffer.length < 4) return false;
      const header = buffer.subarray(0, 4);
      return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
    };
    
    const filenameLower = filename ? filename.toLowerCase() : '';
    
    const isPdf = filenameLower.endsWith('.pdf') || 
                 mimetype === 'application/pdf' || 
                 (mimetype === 'application/octet-stream' && detectPdfByHeader(buffer)) ||
                 detectPdfByHeader(buffer);
                 
    const isTxt = filenameLower.endsWith('.txt') || mimetype === 'text/plain';
    const isCsv = filenameLower.endsWith('.csv') || mimetype === 'text/csv' || mimetype === 'application/csv';
    const isDocx = filenameLower.endsWith('.docx') || 
                  mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                  (mimetype === 'application/octet-stream' && detectDocxByHeader(buffer) && filenameLower.includes('docx'));

    if (isPdf) return 'PDF';
    if (isTxt) return 'TXT';
    if (isCsv) return 'CSV';
    if (isDocx) return 'DOCX';
    return 'UNKNOWN';
  };

  // Teste PDF com extensão e mime type corretos
  const pdfBuffer = Buffer.from('%PDF-1.4\nconteúdo do pdf...', 'ascii');
  assert.equal(detectFileType('documento.pdf', 'application/pdf', pdfBuffer), 'PDF');
  
  // Teste PDF apenas com extensão
  assert.equal(detectFileType('documento.pdf', 'application/octet-stream', pdfBuffer), 'PDF');
  
  // Teste PDF apenas com magic bytes
  assert.equal(detectFileType('documento', 'application/octet-stream', pdfBuffer), 'PDF');
  
  // Teste TXT
  const txtBuffer = Buffer.from('Este é um arquivo de texto', 'utf8');
  assert.equal(detectFileType('arquivo.txt', 'text/plain', txtBuffer), 'TXT');
  
  // Teste CSV
  const csvBuffer = Buffer.from('nome,idade\nJoão,30', 'utf8');
  assert.equal(detectFileType('dados.csv', 'text/csv', csvBuffer), 'CSV');
  
  // Teste DOCX
  const docxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]); // ZIP header
  assert.equal(detectFileType('documento.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer), 'DOCX');
  
  // Teste arquivo não suportado
  const unknownBuffer = Buffer.from('conteúdo desconhecido', 'utf8');
  assert.equal(detectFileType('arquivo.xyz', 'application/unknown', unknownBuffer), 'UNKNOWN');
});