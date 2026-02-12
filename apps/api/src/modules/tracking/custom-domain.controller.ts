import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../shared/guards/supabase-auth.guard';
import { CustomDomainService } from './custom-domain.service';

@Controller('tracking/custom-domain')
@UseGuards(SupabaseAuthGuard)
export class CustomDomainController {
  constructor(private readonly customDomainService: CustomDomainService) {}

  /**
   * GET /tracking/custom-domain
   * Get current custom domain configuration
   */
  @Get()
  async getConfig(@Request() req: any) {
    const teamId = req.user.team_id;
    const config = await this.customDomainService.getConfig(teamId);
    
    // Include DNS instructions if domain is set but not verified
    let dns_instructions = null;
    if (config.tracking_domain && !config.tracking_domain_verified) {
      dns_instructions = this.customDomainService.getDnsInstructions(config.tracking_domain);
    }

    return { 
      data: {
        ...config,
        dns_instructions,
      }
    };
  }

  /**
   * POST /tracking/custom-domain
   * Set custom tracking domain
   */
  @Post()
  async setDomain(@Request() req: any, @Body() body: { domain: string }) {
    const teamId = req.user.team_id;
    const config = await this.customDomainService.setDomain(teamId, body.domain);
    const dns_instructions = this.customDomainService.getDnsInstructions(config.tracking_domain!);

    return { 
      data: {
        ...config,
        dns_instructions,
      },
      message: 'Domain configured. Please add the CNAME record and verify.',
    };
  }

  /**
   * POST /tracking/custom-domain/verify
   * Verify DNS CNAME record
   */
  @Post('verify')
  async verifyDomain(@Request() req: any) {
    const teamId = req.user.team_id;
    const result = await this.customDomainService.verifyDomain(teamId);

    if (result.verified) {
      return {
        data: result,
        message: 'Domain verified successfully! Your tracking links will now use your custom domain.',
      };
    } else {
      return {
        data: result,
        message: result.error || 'Domain verification failed. Please check your DNS settings.',
      };
    }
  }

  /**
   * DELETE /tracking/custom-domain
   * Remove custom domain
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDomain(@Request() req: any) {
    const teamId = req.user.team_id;
    await this.customDomainService.removeDomain(teamId);
  }

  /**
   * GET /tracking/custom-domain/instructions
   * Get DNS setup instructions (without setting domain)
   */
  @Get('instructions')
  async getInstructions(@Request() req: any) {
    const config = await this.customDomainService.getConfig(req.user.team_id);
    
    if (!config.tracking_domain) {
      return {
        data: null,
        message: 'No domain configured. Set a domain first to get instructions.',
      };
    }

    const instructions = this.customDomainService.getDnsInstructions(config.tracking_domain);
    return { data: instructions };
  }

  /**
   * GET /tracking/custom-domain/base-url
   * Get the tracking base URL for this team
   */
  @Get('base-url')
  async getBaseUrl(@Request() req: any) {
    const teamId = req.user.team_id;
    const baseUrl = await this.customDomainService.getTrackingBaseUrl(teamId);
    return { data: { base_url: baseUrl } };
  }
}
