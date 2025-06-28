import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Resumir command flow - two step process', async () => {
  // Mock basic functionality to test two-step flow
  const resumirFlow = {
    modes: new Map(),
    
    setMode(contactId, mode) {
      this.modes.set(contactId, mode);
    },
    
    getMode(contactId) {
      return this.modes.get(contactId);
    },
    
    handleResumirCommand(hasMedia, hasText) {
      // Simulate the new two-step logic
      if (hasMedia || hasText) {
        return 'warning_message'; // Should show warning about using two-step process
      }
      
      this.setMode('user123', 'RESUMIR');
      return 'mode_activated'; // Should activate RESUMIR mode
    },
    
    handleResumirMode(hasMedia, hasText) {
      // Simulate mode handling
      if (!hasMedia && !hasText) {
        return 'waiting_message'; // Should ask for document
      }
      
      this.setMode('user123', null); // Exit mode after processing
      return 'processing_complete';
    }
  };

  // Test 1: !resumir with text should show warning
  const result1 = resumirFlow.handleResumirCommand(false, true);
  assert.equal(result1, 'warning_message');
  
  // Test 2: !resumir with media should show warning  
  const result2 = resumirFlow.handleResumirCommand(true, false);
  assert.equal(result2, 'warning_message');
  
  // Test 3: !resumir alone should activate mode
  const result3 = resumirFlow.handleResumirCommand(false, false);
  assert.equal(result3, 'mode_activated');
  assert.equal(resumirFlow.getMode('user123'), 'RESUMIR');
  
  // Test 4: Empty message in RESUMIR mode should ask for document
  const result4 = resumirFlow.handleResumirMode(false, false);
  assert.equal(result4, 'waiting_message');
  assert.equal(resumirFlow.getMode('user123'), 'RESUMIR'); // Mode should remain active
  
  // Test 5: Document in RESUMIR mode should process and exit
  const result5 = resumirFlow.handleResumirMode(true, false);
  assert.equal(result5, 'processing_complete');
  assert.equal(resumirFlow.getMode('user123'), null); // Mode should be cleared
  
  // Test 6: Text in RESUMIR mode should process and exit
  resumirFlow.setMode('user123', 'RESUMIR'); // Reset mode
  const result6 = resumirFlow.handleResumirMode(false, true);
  assert.equal(result6, 'processing_complete');
  assert.equal(resumirFlow.getMode('user123'), null); // Mode should be cleared
});

test('Resumir text processing simulation', async () => {
  // Simulate text processing logic
  const processText = (text, fileType) => {
    if (!text || text.trim().length === 0) {
      return { success: false, error: 'empty_content' };
    }
    
    const originalLength = text.length;
    const processedText = text.slice(0, 8000);
    const truncated = originalLength > 8000;
    
    return {
      success: true,
      originalLength,
      processedLength: processedText.length,
      truncated,
      fileType: fileType || 'text'
    };
  };

  // Test empty text
  const result1 = processText('');
  assert.equal(result1.success, false);
  assert.equal(result1.error, 'empty_content');
  
  // Test normal text
  const normalText = 'Este é um texto normal para teste';
  const result2 = processText(normalText, 'TXT');
  assert.equal(result2.success, true);
  assert.equal(result2.originalLength, normalText.length);
  assert.equal(result2.truncated, false);
  assert.equal(result2.fileType, 'TXT');
  
  // Test long text (should be truncated)
  const longText = 'a'.repeat(10000);
  const result3 = processText(longText, 'PDF');
  assert.equal(result3.success, true);
  assert.equal(result3.originalLength, 10000);
  assert.equal(result3.processedLength, 8000);
  assert.equal(result3.truncated, true);
  assert.equal(result3.fileType, 'PDF');
});