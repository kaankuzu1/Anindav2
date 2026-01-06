import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  username: string;
  password: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls?: boolean;
}

export interface SendEmailOptions {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface EmailMessage {
  uid: number;
  messageId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  inReplyTo?: string;
}

export class SmtpClient {
  private transporter: Transporter;
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: options.fromName
        ? `"${options.fromName}" <${options.from}>`
        : options.from,
      to: options.to,
      subject: options.subject,
      text: options.textBody ?? this.stripHtml(options.htmlBody),
      html: options.htmlBody,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
      headers: options.headers,
    });

    return {
      messageId: info.messageId,
    };
  }

  /**
   * Close connection
   */
  close(): void {
    this.transporter.close();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

export class ImapClient {
  private config: ImapConfig;
  private imap: Imap | null = null;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.username,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls ?? true,
        tlsOptions: { rejectUnauthorized: false },
      });

      this.imap.once('ready', () => resolve());
      this.imap.once('error', (err: Error) => reject(err));
      this.imap.connect();
    });
  }

  /**
   * Get messages since a specific date
   */
  async getMessages(since?: Date, maxResults = 50): Promise<EmailMessage[]> {
    if (!this.imap) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        const searchCriteria: any[] = since
          ? [['SINCE', since]]
          : ['ALL'];

        this.imap!.search(searchCriteria, (searchErr, uids) => {
          if (searchErr) {
            reject(searchErr);
            return;
          }

          if (uids.length === 0) {
            resolve([]);
            return;
          }

          // Get the most recent messages
          const targetUids = uids.slice(-maxResults);
          const messages: EmailMessage[] = [];

          const fetch = this.imap!.fetch(targetUids, {
            bodies: '',
            struct: true,
          });

          fetch.on('message', (msg, seqno) => {
            let uid = 0;

            msg.on('attributes', (attrs) => {
              uid = attrs.uid;
            });

            msg.on('body', (stream) => {
              let buffer = '';

              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const email = this.parseMessage(uid, parsed);
                  if (email) {
                    messages.push(email);
                  }
                } catch (parseErr) {
                  console.error('Failed to parse message:', parseErr);
                }
              });
            });
          });

          fetch.once('error', (fetchErr) => {
            reject(fetchErr);
          });

          fetch.once('end', () => {
            resolve(messages);
          });
        });
      });
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(uid: number): Promise<void> {
    if (!this.imap) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.imap!.addFlags(uid, ['\\Seen'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Add star (flagged) to message
   */
  async addStar(uid: number): Promise<void> {
    if (!this.imap) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.imap!.addFlags(uid, ['\\Flagged'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Move message to trash
   */
  async moveToTrash(uid: number): Promise<void> {
    if (!this.imap) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.imap!.move(uid, 'Trash', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private parseMessage(uid: number, parsed: ParsedMail): EmailMessage | null {
    const from = parsed.from?.value?.[0];
    const toField = parsed.to;
    const toAddress = Array.isArray(toField)
      ? toField[0]?.value?.[0]
      : toField?.value?.[0];

    if (!from || !toAddress) return null;

    return {
      uid,
      messageId: parsed.messageId ?? '',
      from: from.address ?? '',
      fromName: from.name,
      to: toAddress.address ?? '',
      subject: parsed.subject ?? '',
      body: parsed.text ?? '',
      bodyHtml: parsed.html || undefined,
      receivedAt: parsed.date ?? new Date(),
      inReplyTo: parsed.inReplyTo as string | undefined,
    };
  }
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SmtpClient(config);
    const verified = await client.verify();
    client.close();
    return { success: verified };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Test IMAP connection
 */
export async function testImapConnection(config: ImapConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new ImapClient(config);
    await client.connect();
    client.disconnect();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
