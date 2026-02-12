import { Controller, Get, Post, Delete, Query, Res, Body, Param, UseGuards, Req, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { AdminAuthGuard } from '../../shared/guards/admin-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { InboxesService } from '../inboxes/inboxes.service';
import { AdminInboxesService } from '../admin/admin-inboxes.service';
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
    private readonly adminInboxesService: AdminInboxesService,
    private readonly configService: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.authService.getUserById(req.user.sub);
    const teams = await this.authService.getUserTeams(req.user.sub);

    return {
      user,
      teams,
    };
  }

  // ============================================
  // Team Management
  // ============================================

  @Get('team/members')
  @UseGuards(SupabaseAuthGuard)
  async getTeamMembers(
    @Req() req: any,
    @Query('team_id') teamId: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.authService.getTeamMembers(teamId);
  }

  @Post('team/invite')
  @UseGuards(SupabaseAuthGuard)
  async inviteMember(
    @Req() req: any,
    @Body() body: { team_id: string; email: string },
  ) {
    if (!body.team_id || !body.email) {
      throw new BadRequestException('team_id and email are required');
    }
    return this.authService.inviteMember(body.team_id, req.user.sub, body.email);
  }

  @Delete('team/members/:memberId')
  @UseGuards(SupabaseAuthGuard)
  async removeMember(
    @Req() req: any,
    @Param('memberId') memberId: string,
    @Query('team_id') teamId: string,
  ) {
    if (!teamId) {
      throw new BadRequestException('team_id is required');
    }
    return this.authService.removeMember(teamId, memberId, req.user.sub);
  }

  // ============================================
  // Google OAuth for Inbox Connection
  // ============================================

  @Get('google/connect')
  @UseGuards(SupabaseAuthGuard)
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
  @UseGuards(SupabaseAuthGuard)
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

  // ============================================
  // Admin Google OAuth for Admin Inbox Connection
  // ============================================

  @Get('admin/google/connect')
  @UseGuards(AdminAuthGuard)
  async initiateAdminGoogleOAuth(
    @Res() res: Response,
  ) {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = this.configService.getOrThrow<string>('APP_URL');
    const apiUrl = this.configService.getOrThrow<string>('API_URL');

    const state = Buffer.from(JSON.stringify({
      isAdmin: true,
      returnUrl: `${appUrl}/admin/inboxes`,
    })).toString('base64');

    const redirectUri = `${apiUrl}/auth/admin/google/callback`;
    const authUrl = getGmailAuthUrl(clientId, clientSecret, redirectUri, state);

    res.redirect(authUrl);
  }

  @Get('admin/google/callback')
  async handleAdminGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.getOrThrow<string>('APP_URL');

    if (error) {
      return res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent('Missing code or state')}`);
    }

    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const { returnUrl } = stateData;

      const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
      const apiUrl = this.configService.getOrThrow<string>('API_URL');
      const redirectUri = `${apiUrl}/auth/admin/google/callback`;

      const credentials = await exchangeGmailCode(code, clientId, clientSecret, redirectUri);

      await this.adminInboxesService.createOAuthAdminInbox(
        credentials.email,
        'google',
        credentials.accessToken,
        credentials.refreshToken,
        credentials.expiresAt,
      );

      res.redirect(`${returnUrl || appUrl + '/admin/inboxes'}?success=true&email=${encodeURIComponent(credentials.email)}`);
    } catch (err) {
      console.error('Admin Google OAuth callback error:', err);
      res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent('Failed to connect admin inbox')}`);
    }
  }

  // ============================================
  // Admin Microsoft OAuth for Admin Inbox Connection
  // ============================================

  @Get('admin/microsoft/connect')
  @UseGuards(AdminAuthGuard)
  async initiateAdminMicrosoftOAuth(
    @Res() res: Response,
  ) {
    const clientId = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_ID');
    const appUrl = this.configService.getOrThrow<string>('APP_URL');
    const apiUrl = this.configService.getOrThrow<string>('API_URL');
    const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';

    const state = Buffer.from(JSON.stringify({
      isAdmin: true,
      returnUrl: `${appUrl}/admin/inboxes`,
    })).toString('base64');

    const redirectUri = `${apiUrl}/auth/admin/microsoft/callback`;
    const authUrl = getMicrosoftAuthUrl(clientId, redirectUri, tenantId, state);

    res.redirect(authUrl);
  }

  @Get('admin/microsoft/callback')
  async handleAdminMicrosoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.getOrThrow<string>('APP_URL');

    if (error) {
      return res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent('Missing code or state')}`);
    }

    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const { returnUrl } = stateData;

      const clientId = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_ID');
      const clientSecret = this.configService.getOrThrow<string>('MICROSOFT_CLIENT_SECRET');
      const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';
      const apiUrl = this.configService.getOrThrow<string>('API_URL');
      const redirectUri = `${apiUrl}/auth/admin/microsoft/callback`;

      const credentials = await exchangeMicrosoftCode(code, clientId, clientSecret, redirectUri, tenantId);

      await this.adminInboxesService.createOAuthAdminInbox(
        credentials.email,
        'microsoft',
        credentials.accessToken,
        credentials.refreshToken,
        credentials.expiresAt,
      );

      res.redirect(`${returnUrl || appUrl + '/admin/inboxes'}?success=true&email=${encodeURIComponent(credentials.email)}`);
    } catch (err) {
      console.error('Admin Microsoft OAuth callback error:', err);
      res.redirect(`${appUrl}/admin/inboxes?error=${encodeURIComponent('Failed to connect admin inbox')}`);
    }
  }
}
