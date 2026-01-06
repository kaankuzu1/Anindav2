import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
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
  id: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  inReplyTo?: string;
  messageId?: string;
  labels: string[];
}

export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor(
    credentials: GmailCredentials,
    clientId: string,
    clientSecret: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiresAt?.getTime(),
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get current access token, refreshing if needed
   */
  async getAccessToken(): Promise<string> {
    const { token } = await this.oauth2Client.getAccessToken();
    if (!token) {
      throw new Error('Failed to get access token');
    }
    return token;
  }

  /**
   * Get refreshed credentials if token was refreshed
   */
  async getRefreshedCredentials(): Promise<GmailCredentials | null> {
    const credentials = this.oauth2Client.credentials;
    if (credentials.access_token && credentials.refresh_token) {
      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      };
    }
    return null;
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; threadId: string }> {
    const message = this.createMimeMessage(options);
    const encodedMessage = Buffer.from(message).toString('base64url');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: options.inReplyTo ? undefined : undefined, // Thread is auto-detected from In-Reply-To
      },
    });

    if (!response.data.id || !response.data.threadId) {
      throw new Error('Failed to send email: no message ID returned');
    }

    return {
      messageId: response.data.id,
      threadId: response.data.threadId,
    };
  }

  /**
   * Get messages since a specific date
   */
  async getMessages(since?: Date, maxResults = 50): Promise<EmailMessage[]> {
    const query = since
      ? `after:${Math.floor(since.getTime() / 1000)} in:inbox`
      : 'in:inbox';

    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages: EmailMessage[] = [];

    for (const msg of listResponse.data.messages ?? []) {
      if (!msg.id) continue;

      const fullMessage = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const parsed = this.parseMessage(fullMessage.data);
      if (parsed) {
        messages.push(parsed);
      }
    }

    return messages;
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<EmailMessage | null> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return this.parseMessage(response.data);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Add star to message
   */
  async addStar(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['STARRED'],
      },
    });
  }

  /**
   * Move message to trash
   */
  async trash(messageId: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }

  /**
   * Get user profile (email address)
   */
  async getProfile(): Promise<{ email: string; messagesTotal: number }> {
    const response = await this.gmail.users.getProfile({ userId: 'me' });
    return {
      email: response.data.emailAddress ?? '',
      messagesTotal: response.data.messagesTotal ?? 0,
    };
  }

  /**
   * Set up push notifications (for real-time reply detection)
   */
  async setupPushNotifications(topicName: string): Promise<{ historyId: string; expiration: string }> {
    const response = await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

    return {
      historyId: response.data.historyId ?? '',
      expiration: response.data.expiration ?? '',
    };
  }

  /**
   * Stop push notifications
   */
  async stopPushNotifications(): Promise<void> {
    await this.gmail.users.stop({ userId: 'me' });
  }

  // ============================================
  // Private Methods
  // ============================================

  private createMimeMessage(options: SendEmailOptions): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const headers: string[] = [
      `From: ${options.fromName ? `"${options.fromName}" <${options.from}>` : options.from}`,
      `To: ${options.to}`,
      `Subject: ${this.encodeSubject(options.subject)}`,
      `MIME-Version: 1.0`,
    ];

    if (options.replyTo) {
      headers.push(`Reply-To: ${options.replyTo}`);
    }

    if (options.inReplyTo) {
      headers.push(`In-Reply-To: ${options.inReplyTo}`);
      if (options.references) {
        headers.push(`References: ${options.references}`);
      }
    }

    // Add custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.push(`${key}: ${value}`);
      }
    }

    // Multipart message with both text and HTML
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const textBody = options.textBody ?? this.stripHtml(options.htmlBody);

    const parts = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      textBody,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      options.htmlBody,
      `--${boundary}--`,
    ];

    return parts.join('\r\n');
  }

  private encodeSubject(subject: string): string {
    // Check if subject contains non-ASCII characters
    if (/[^\x00-\x7F]/.test(subject)) {
      return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    }
    return subject;
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

  private parseMessage(message: gmail_v1.Schema$Message): EmailMessage | null {
    if (!message.id || !message.threadId) return null;

    const headers = message.payload?.headers ?? [];
    const getHeader = (name: string): string => {
      return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
    };

    // Parse from header
    const fromHeader = getHeader('from');
    const fromMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
    const fromName = fromMatch?.[1]?.trim();
    const from = fromMatch?.[2] ?? fromHeader;

    // Get body
    let body = '';
    let bodyHtml = '';

    const extractBody = (parts: gmail_v1.Schema$MessagePart[] | undefined): void => {
      if (!parts) return;

      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        } else if (part.parts) {
          extractBody(part.parts);
        }
      }
    };

    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64url').toString('utf-8');
    } else if (message.payload?.parts) {
      extractBody(message.payload.parts);
    }

    return {
      id: message.id,
      threadId: message.threadId,
      from,
      fromName,
      to: getHeader('to'),
      subject: getHeader('subject'),
      body: body || this.stripHtml(bodyHtml),
      bodyHtml: bodyHtml || undefined,
      receivedAt: new Date(parseInt(message.internalDate ?? '0', 10)),
      inReplyTo: getHeader('in-reply-to') || undefined,
      messageId: getHeader('message-id') || undefined,
      labels: message.labelIds ?? [],
    };
  }
}

// ============================================
// OAuth URL Generator
// ============================================

export function getGmailAuthUrl(clientId: string, clientSecret: string, redirectUri: string, state?: string): string {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
  });
}

export async function exchangeGmailCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GmailCredentials & { email: string }> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to exchange code for tokens');
  }

  oauth2Client.setCredentials(tokens);

  // Get user email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    email: userInfo.data.email ?? '',
  };
}
