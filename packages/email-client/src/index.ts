// Gmail exports
export {
  GmailClient,
  GmailCredentials,
  SendEmailOptions as GmailSendOptions,
  EmailMessage as GmailMessage,
  getGmailAuthUrl,
  exchangeGmailCode,
} from './gmail';

// Microsoft exports
export {
  MicrosoftClient,
  MicrosoftCredentials,
  SendEmailOptions as MicrosoftSendOptions,
  EmailMessage as MicrosoftMessage,
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  refreshMicrosoftToken,
} from './microsoft';

// SMTP/IMAP exports
export {
  SmtpClient,
  ImapClient,
  SmtpConfig,
  ImapConfig,
  SendEmailOptions as SmtpSendOptions,
  EmailMessage as ImapMessage,
  testSmtpConnection,
  testImapConnection,
} from './smtp';

// Common send options type (use Gmail's as the base)
export type SendEmailOptions = {
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
};

// Common email message type
export type EmailMessage = {
  id: string;
  threadId?: string;
  conversationId?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  inReplyTo?: string;
  messageId?: string;
};
