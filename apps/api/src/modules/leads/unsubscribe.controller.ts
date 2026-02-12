import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { LeadsService } from './leads.service';

/**
 * Public unsubscribe controller - NO AUTHENTICATION REQUIRED
 * Handles one-click unsubscribe links from emails (RFC 8058 compliant)
 */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * POST /unsubscribe/:token - RFC 8058 one-click unsubscribe
   * Email clients send a POST request to this endpoint
   */
  @Post(':token')
  async unsubscribePost(@Param('token') token: string, @Res() res: Response) {
    const result = await this.leadsService.unsubscribeByToken(token);

    // Return a simple HTML page confirming unsubscribe
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 16px; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ ${result.message}</h1>
            <p>You will no longer receive emails from us.</p>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * GET /unsubscribe/:token - For direct browser link clicks
   * Users clicking the unsubscribe link in their email will hit this
   */
  @Get(':token')
  async unsubscribeGet(@Param('token') token: string, @Res() res: Response) {
    const result = await this.leadsService.unsubscribeByToken(token);

    // Return a simple HTML page confirming unsubscribe
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 16px; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ ${result.message}</h1>
            <p>You will no longer receive emails from us.</p>
          </div>
        </body>
      </html>
    `);
  }
}
