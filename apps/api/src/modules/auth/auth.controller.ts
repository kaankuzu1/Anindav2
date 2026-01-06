import { Controller, Get, Post, Query, Res, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { InboxesService } from '../inboxes/inboxes.service';
import {
  getGmailAuthUrl,
  exchangeGmailCode,
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
} from '@aninda/email-client';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly inboxesService: InboxesService,
    private readonly configService: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: any) {
    const user = await this.authService.getUserById(req.user.sub);
    const teams = await this.authService.getUserTeams(req.user.sub);

    return {
      user,
      teams,
    };
  }

  // ============================================
  // Google OAuth for Inbox Connection
  // ============================================

  @Get('google/connect')
  @UseGuards(AuthGuard('jwt'))
  async initiateGoogleOAuth(
    @Req() req: any,
    @Query('team_id') teamId: string,
    @Res() res: Response,
  ) {
    if (!teamId) {
      throw new HttpException('team_id is required', HttpStatus.BAD_REQUEST);
    }

    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = this.configService.getOrThrow<string>('APP_URL');
    const apiUrl = this.configService.getOrThrow<string>('API_URL');

    // Store state for CSRF protection and to pass team_id
    const state = Buffer.from(JSON.stringify({
      teamId,
      userId: req.user.sub,
      returnUrl: `${appUrl}/inboxes`,
    })).toString('base64');

    const redirectUri = `${apiUrl}/auth/google/callback`;
    const authUrl = getGmailAuthUrl(clientId, clientSecret, redirectUri, state);

    res.redirect(authUrl);
  }

  @Get('google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.getOrThrow<string>('APP_URL');

    if (error) {
      return res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent('Missing code or state')}`);
    }

    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const { teamId, returnUrl } = stateData;

      const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
      const apiUrl = this.configService.getOrThrow<string>('API_URL');
      const redirectUri = `${apiUrl}/auth/google/callback`;

      // Exchange code for tokens
      const credentials = await exchangeGmailCode(code, clientId, clientSecret, redirectUri);

      // Create inbox
      await this.inboxesService.createOAuthInbox(
        teamId,
        credentials.email,
        'google',
        credentials.accessToken,
        credentials.refreshToken,
        credentials.expiresAt,
      );

      res.redirect(`${returnUrl || appUrl + '/inboxes'}?success=true&email=${encodeURIComponent(credentials.email)}`);
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent('Failed to connect inbox')}`);
    }
  }

  // ============================================
  // Microsoft OAuth for Inbox Connection
  // ============================================

  @Get('microsoft/connect')
  @UseGuards(AuthGuard('jwt'))
  async initiateMicrosoftOAuth(
    @Req() req: any,
    @Query('team_id') teamId: string,
    @Res() res: Response,
  ) {
    if (!teamId) {
      throw new HttpException('team_id is required', HttpStatus.BAD_REQUEST);
    }

    const clientId = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_ID');
    const appUrl = this.configService.getOrThrow<string>('APP_URL');
    const apiUrl = this.configService.getOrThrow<string>('API_URL');
    const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';

    // Store state for CSRF protection and to pass team_id
    const state = Buffer.from(JSON.stringify({
      teamId,
      userId: req.user.sub,
      returnUrl: `${appUrl}/inboxes`,
    })).toString('base64');

    const redirectUri = `${apiUrl}/auth/microsoft/callback`;
    const authUrl = getMicrosoftAuthUrl(clientId, redirectUri, tenantId, state);

    res.redirect(authUrl);
  }

  @Get('microsoft/callback')
  async handleMicrosoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.getOrThrow<string>('APP_URL');

    if (error) {
      return res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent('Missing code or state')}`);
    }

    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const { teamId, returnUrl } = stateData;

      const clientId = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_SECRET');
      const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';
      const apiUrl = this.configService.getOrThrow<string>('API_URL');
      const redirectUri = `${apiUrl}/auth/microsoft/callback`;

      // Exchange code for tokens
      const credentials = await exchangeMicrosoftCode(code, clientId, clientSecret, redirectUri, tenantId);

      // Create inbox
      await this.inboxesService.createOAuthInbox(
        teamId,
        credentials.email,
        'microsoft',
        credentials.accessToken,
        credentials.refreshToken,
        credentials.expiresAt,
      );

      res.redirect(`${returnUrl || appUrl + '/inboxes'}?success=true&email=${encodeURIComponent(credentials.email)}`);
    } catch (err) {
      console.error('Microsoft OAuth callback error:', err);
      res.redirect(`${appUrl}/inboxes?error=${encodeURIComponent('Failed to connect inbox')}`);
    }
  }
}
