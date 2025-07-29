import { test } from 'node:test';
import assert from 'node:assert';
import { COMMANDS, NAVIGATION_STATES } from '../src/constants/commands.js';

test('Flow stop commands should be defined', () => {
  // Verificar se os comandos de flow estão definidos
  assert(COMMANDS.FLOW_STOP === '!flow stop', 'FLOW_STOP command should be defined');
  assert(COMMANDS.FLOW_SAIR === '!flow sair', 'FLOW_SAIR command should be defined');
  assert(COMMANDS.FLOW_RESTART === '!flow restart', 'FLOW_RESTART command should be defined');
  assert(COMMANDS.FLOW_STATUS === '!flow status', 'FLOW_STATUS command should be defined');
});

test('Navigation states should include main menu', () => {
  // Verificar se o estado do menu principal existe
  assert(NAVIGATION_STATES.MAIN_MENU === 'main_menu', 'Main menu navigation state should exist');
});

test('Commands should follow correct pattern', () => {
  // Verificar padrão dos comandos de flow
  const flowCommands = [
    COMMANDS.FLOW_STOP,
    COMMANDS.FLOW_SAIR, 
    COMMANDS.FLOW_RESTART,
    COMMANDS.FLOW_STATUS
  ];
  
  flowCommands.forEach(cmd => {
    assert(cmd.startsWith('!flow '), `Command ${cmd} should start with '!flow '`);
  });
});

// Teste para verificar se outros comandos são comandos do sistema
test('System commands should start with !', () => {
  const systemCommands = [
    COMMANDS.AGENDA,
    COMMANDS.DEEP,
    COMMANDS.TRANSCREVER,
    COMMANDS.LINKEDIN,
    COMMANDS.AJUDA
  ];
  
  systemCommands.forEach(cmd => {
    assert(cmd.startsWith('!'), `System command ${cmd} should start with '!'`);
    assert(!cmd.startsWith('!flow '), `System command ${cmd} should not be a flow command`);
  });
});