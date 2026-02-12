import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TrackingService } from './tracking.service';
import { TRANSPARENT_GIF_BUFFER, isValidTrackingUrl } from '@aninda/shared';

/**
 * Tracking Controller
 *
 * Handles email open and click tracking.
 * These endpoints are PUBLIC (no auth) since they are called by email clients.
 */
@Controller('t')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  /**
   * Track email open (pixel tracking)
   * GET /api/v1/t/o/:trackingId
   *
   * Returns a 1x1 transparent GIF and records the open event.
   */
  @Get('o/:trackingId')
  async trackOpen(
    @Param('trackingId') trackingId: string,
    @Res() res: Response,
  ) {
    // Record the open event asynchronously (don't wait)
    this.trackingService.recordOpen(trackingId).catch((err) => {
      console.error('Failed to record open:', err);
    });

    // Return the tracking pixel immediately
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': TRANSPARENT_GIF_BUFFER.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    res.send(TRANSPARENT_GIF_BUFFER);
  }

  /**
   * Track link click
   * GET /api/v1/t/c/:trackingId?url=...
   *
   * Records the click event and redirects to the original URL.
   */
  @Get('c/:trackingId')
  async trackClick(
    @Param('trackingId') trackingId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    // Validate URL to prevent open redirect vulnerability
    if (!url || !isValidTrackingUrl(url)) {
      return res.status(400).send('Invalid URL');
    }

    // Decode the URL
    const decodedUrl = decodeURIComponent(url);

    // Validate decoded URL as well
    if (!isValidTrackingUrl(decodedUrl)) {
      return res.status(400).send('Invalid URL');
    }

    // Record the click event asynchronously (don't wait)
    this.trackingService.recordClick(trackingId, decodedUrl).catch((err) => {
      console.error('Failed to record click:', err);
    });

    // Redirect to the original URL
    res.redirect(302, decodedUrl);
  }
}
