// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-13
// Descripton: Логгер для бота, использующий Winston и Day.js


// utils/logger.ts
import { createLogger, format, transports } from 'winston';
import dayjs from 'dayjs';
import util from 'util';

// Простой объект с цветами (избегаем сложных типов Chalk)
const COLORS = {
  error: '\x1b[31m',     // red
  warn: '\x1b[33m',      // yellow
  info: '\x1b[34m',      // blue
  debug: '\x1b[35m',     // magenta
  verbose: '\x1b[36m',   // cyan
  reset: '\x1b[0m',      // reset color
  gray: '\x1b[90m'       // gray
};

// Форматирование объекта
const formatObject = (obj: any): string => {
  if (obj instanceof Error) {
    return obj.stack || obj.message;
  }
  if (typeof obj === 'object') {
    return util.inspect(obj, {
      colors: false,
      depth: 5,
      compact: true,
      breakLength: 80
    });
  }
  return String(obj);
};

// Формат для консоли
const consoleFormat = format.printf(({ level, message, timestamp, ...meta }) => {
  const color = COLORS[level as keyof typeof COLORS] || '';
  const gray = COLORS.gray;
  const reset = COLORS.reset;
  
  let output = `${gray}[${timestamp}]${reset} ${color}[${level.toUpperCase()}]${reset}: `;
  
  output += typeof message === 'string' ? message : formatObject(message);
  
  if (meta && Object.keys(meta).length > 0) {
    output += `\n${formatObject(meta)}`;
  }
  
  return output;
});

// Создаем логгер
const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        consoleFormat
      )
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Простой API
export const logger = {
  error: (message: string, meta?: any) => winstonLogger.log('error', message, meta),
  warn: (message: string, meta?: any) => winstonLogger.log('warn', message, meta),
  info: (message: string, meta?: any) => winstonLogger.log('info', message, meta),
  debug: (message: string, meta?: any) => winstonLogger.log('debug', message, meta),
  
  logSQL: (query: string, params?: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      winstonLogger.debug('SQL Query', { 
        query: query.replace(/\s+/g, ' ').trim(),
        parameters: params 
      });
    }
  }
};