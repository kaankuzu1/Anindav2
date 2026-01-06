import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export interface MicrosoftCredentials {
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
}

export interface EmailMessage {
  id: string;
  conversationId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  inReplyTo?: string;
  messageId?: string;
  isRead: boolean;
}

export class MicrosoftClient {
  private client: Client;
  private credentials: MicrosoftCredentials;

  constructor(credentials: MicrosoftCredentials) {
    this.credentials = credentials;
    this.client = Client.init({
      authProvider: (done) => {
        done(null, credentials.accessToken);
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; conversationId: string }> {
    const message = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.to,
          },
        },
      ],
      from: {
        emailAddress: {
          address: options.from,
          name: options.fromName,
        },
      },
    };

    // If replying, use the reply endpoint
    if (options.inReplyTo) {
      const response = await this.client
        .api(`/me/messages/${options.inReplyTo}/reply`)
        .post({
          message,
          comment: options.textBody ?? '',
        });

      return {
        messageId: response?.id ?? '',
        conversationId: response?.conversationId ?? '',
      };
    }

    // Otherwise send new message
    const response = await this.client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });

    return {
      messageId: response?.id ?? '',
      conversationId: response?.conversationId ?? '',
    };
  }

  /**
   * Get messages since a specific date
   */
  async getMessages(since?: Date, maxResults = 50): Promise<EmailMessage[]> {
    let query = this.client
      .api('/me/mailFolders/inbox/messages')
      .top(maxResults)
      .select('id,conversationId,from,toRecipients,subject,body,bodyPreview,receivedDateTime,isRead,internetMessageId,internetMessageHeaders')
      .orderby('receivedDateTime desc');

    if (since) {
      query = query.filter(`receivedDateTime ge ${since.toISOString()}`);
    }

    const response = await query.get();
    const messages: EmailMessage[] = [];

    for (const msg of response.value ?? []) {
      messages.push(this.parseMessage(msg));
    }

    return messages;
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string): Promise<EmailMessage> {
    const response = await this.client
      .api(`/me/messages/${messageId}`)
      .select('id,conversationId,from,toRecipients,subject,body,bodyPreview,receivedDateTime,isRead,internetMessageId,internetMessageHeaders')
      .get();

    return this.parseMessage(response);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}`).patch({
      isRead: true,
    });
  }

  /**
   * Add flag to message (similar to starring)
   */
  async addFlag(messageId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}`).patch({
      flag: {
        flagStatus: 'flagged',
      },
    });
  }

  /**
   * Move message to deleted items
   */
  async delete(messageId: string): Promise<void> {
    await this.client.api(`/me/messages/${messageId}/move`).post({
      destinationId: 'deleteditems',
    });
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<{ email: string; displayName: string }> {
    const response = await this.client.api('/me').select('mail,displayName').get();
    return {
      email: response.mail ?? response.userPrincipalName ?? '',
      displayName: response.displayName ?? '',
    };
  }

  /**
   * Create webhook subscription for new messages
   */
  async createSubscription(notificationUrl: string, expirationMinutes = 4230): Promise<{ subscriptionId: string; expirationDateTime: string }> {
    const expirationDateTime = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

    const response = await this.client.api('/subscriptions').post({
      changeType: 'created',
      notificationUrl,
      resource: '/me/mailFolders/inbox/messages',
      expirationDateTime,
      clientState: 'aninda-webhook-secret',
    });

    return {
      subscriptionId: response.id,
      expirationDateTime: response.expirationDateTime,
    };
  }

  /**
   * Renew webhook subscription
   */
  async renewSubscription(subscriptionId: string, expirationMinutes = 4230): Promise<void> {
    const expirationDateTime = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

    await this.client.api(`/subscriptions/${subscriptionId}`).patch({
      expirationDateTime,
    });
  }

  /**
   * Delete webhook subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.client.api(`/subscriptions/${subscriptionId}`).delete();
  }

  // ============================================
  // Private Methods
  // ============================================

  private parseMessage(msg: any): EmailMessage {
    const fromEmail = msg.from?.emailAddress?.address ?? '';
    const fromName = msg.from?.emailAddress?.name;
    const toEmail = msg.toRecipients?.[0]?.emailAddress?.address ?? '';

    // Get In-Reply-To header
    let inReplyTo: string | undefined;
    let messageId: string | undefined;

    if (msg.internetMessageHeaders) {
      for (const header of msg.internetMessageHeaders) {
        if (header.name?.toLowerCase() === 'in-reply-to') {
          inReplyTo = header.value;
        }
        if (header.name?.toLowerCase() === 'message-id') {
          messageId = header.value;
        }
      }
    }

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      from: fromEmail,
      fromName,
      to: toEmail,
      subject: msg.subject ?? '',
      body: msg.body?.contentType === 'text' ? msg.body.content : this.stripHtml(msg.body?.content ?? ''),
      bodyHtml: msg.body?.contentType === 'html' ? msg.body.content : undefined,
      receivedAt: new Date(msg.receivedDateTime),
      inReplyTo,
      messageId: messageId ?? msg.internetMessageId,
      isRead: msg.isRead ?? false,
    };
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

// ============================================
// OAuth URL Generator
// ============================================

export function getMicrosoftAuthUrl(
  clientId: string,
  redirectUri: string,
  tenantId = 'common',
  state?: string
): string {
  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/User.Read',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    response_mode: 'query',
    prompt: 'consent',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tenantId = 'common'
): Promise<MicrosoftCredentials & { email: string }> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const tokens = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens');
  }

  // Get user email
  const client = new MicrosoftClient({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });

  const profile = await client.getProfile();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
    email: profile.email,
  };
}

export async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenantId = 'common'
): Promise<MicrosoftCredentials> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const tokens = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
  };
}
