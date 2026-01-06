# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@aninda/email-client` is a unified email client library providing adapters for Gmail API, Microsoft Graph API, and SMTP/IMAP protocols. It's part of the cold email platform monorepo and is consumed by the workers and API apps.

## Commands

```bash
# Build the package
pnpm --filter @aninda/email-client build

# Watch mode during development
pnpm --filter @aninda/email-client dev

# Clean build artifacts
pnpm --filter @aninda/email-client clean
```

## Architecture

### Client Adapters

Three email providers with consistent interfaces:

- **GmailClient** (`gmail.ts`) - Google Gmail API via `googleapis`
  - OAuth2 authentication with automatic token refresh
  - MIME message construction for multipart emails
  - Push notification setup via Gmail watch API

- **MicrosoftClient** (`microsoft.ts`) - Microsoft Graph API via `@microsoft/microsoft-graph-client`
  - OAuth2 with refresh token support
  - Webhook subscriptions for real-time notifications
  - Reply threading via `/messages/{id}/reply` endpoint

- **SmtpClient** / **ImapClient** (`smtp.ts`) - Traditional SMTP/IMAP via `nodemailer` and `imap`
  - Fallback for non-OAuth providers
  - Connection testing utilities

### Common Types

`index.ts` exports unified types (`SendEmailOptions`, `EmailMessage`) alongside provider-specific versions. This allows workers to use consistent interfaces regardless of the underlying provider.

### OAuth Flow Functions

Each OAuth provider exports standalone functions for the auth flow:
- `getGmailAuthUrl()` / `exchangeGmailCode()`
- `getMicrosoftAuthUrl()` / `exchangeMicrosoftCode()` / `refreshMicrosoftToken()`

These are used by the web app's OAuth callback routes.

## Key Dependencies

- `googleapis` / `google-auth-library` - Gmail API
- `@microsoft/microsoft-graph-client` - Microsoft Graph
- `nodemailer` / `imap` / `mailparser` - SMTP/IMAP protocols
- `@aninda/shared` - Shared utilities (encryption, validation)

## Module Resolution

Package exports compiled JS from `dist/` folder. After making changes, run `pnpm build` before changes are visible to consuming packages.
