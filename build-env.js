/**
 * build-env.js
 * Gera src/js/core/config.env.js a partir das variáveis do .env ou ambiente Vercel.
 * Esse arquivo gerado é ignorado pelo Git para NUNCA expor chaves no repositório.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

let envVars = {};

// Carrega .env ou .env.staging
const isStaging = process.argv.includes('--staging') || process.env.NODE_ENV === 'staging';
const envFile = isStaging ? 'testes/.env.staging' : '.env';
const envPath = resolve(process.cwd(), envFile);

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }
  }
}

const APP_ID = (isStaging ? (process.env.STAGING_APP_ID || envVars.STAGING_APP_ID) : '') ||
  process.env.APP_ID ||
  process.env.PARSE_APP_ID ||
  process.env.BACK4APP_APP_ID ||
  process.env.VITE_APP_ID ||
  process.env.NEXT_PUBLIC_APP_ID ||
  envVars.APP_ID ||
  '';

const JS_KEY = (isStaging ? (process.env.STAGING_JAVASCRIPT_KEY || envVars.STAGING_JAVASCRIPT_KEY) : '') ||
  process.env.JAVASCRIPT_KEY ||
  process.env.JS_KEY ||
  process.env.PARSE_JAVASCRIPT_KEY ||
  process.env.BACK4APP_JAVASCRIPT_KEY ||
  process.env.VITE_JAVASCRIPT_KEY ||
  process.env.NEXT_PUBLIC_JAVASCRIPT_KEY ||
  envVars.JAVASCRIPT_KEY ||
  '';

const SERVER_URL = (isStaging ? (process.env.STAGING_SERVER_URL || envVars.STAGING_SERVER_URL) : '') ||
  process.env.SERVER_URL ||
  process.env.PARSE_SERVER_URL ||
  process.env.BACK4APP_SERVER_URL ||
  envVars.SERVER_URL ||
  'https://parseapi.back4app.com/parse/';



const fileContent = `/**
 * ARQUIVO GERADO AUTOMATICAMENTE - NÃO COMMITAR NO GIT
 * Gerado por build-env.js a partir do .env / variáveis da Vercel
 */

export const ENV_CONFIG = {
  APP_ID: '${APP_ID}',
  JS_KEY: '${JS_KEY}',
  SERVER_URL: '${SERVER_URL}'
};
`;

const outputPath = resolve(process.cwd(), 'src/js/core/config.env.js');
writeFileSync(outputPath, fileContent, 'utf-8');
console.log('✅ [build-env] src/js/core/config.env.js gerado com sucesso!');
