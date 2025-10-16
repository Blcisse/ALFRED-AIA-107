import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Alfred AI',
  pageTitle: 'Alfred Ai',
  pageDescription: 'Alfred AI ',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: 'alfredlogo.png',
  accent: '#002cf2',
  logoDark: '/alfredlogo.png',
  accentDark: '#1fd5f9',
  startButtonText: 'Start call',
};
