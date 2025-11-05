/**
 * Простой logger для приложения
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}${args.length > 0 ? ' ' + JSON.stringify(args) : ''}`;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage('info', message, ...args));
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage('warn', message, ...args));
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage('error', message, ...args));
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }
}

export const logger = new Logger();


