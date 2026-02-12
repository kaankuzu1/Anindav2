import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../shared/database/database.module';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

export interface CustomDomainConfig {
  tracking_domain: string | null;
  tracking_domain_verified: boolean;
  tracking_domain_verified_at: string | null;
}

export interface DomainVerificationResult {
  verified: boolean;
  domain: string;
  expected_target: string;
  actual_targets: string[];
  error?: string;
}

// The target domain that custom domains should point to
const TRACKING_TARGET_DOMAIN = process.env.TRACKING_DOMAIN || 'tracking.aninda.app';

@Injectable()
export class CustomDomainService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get current custom domain configuration
   */
  async getConfig(teamId: string): Promise<CustomDomainConfig> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('tracking_domain, tracking_domain_verified, tracking_domain_verified_at')
      .eq('id', teamId)
      .single();

    if (error) throw error;

    return {
      tracking_domain: data?.tracking_domain || null,
      tracking_domain_verified: data?.tracking_domain_verified || false,
      tracking_domain_verified_at: data?.tracking_domain_verified_at || null,
    };
  }

  /**
   * Set custom tracking domain
   */
  async setDomain(teamId: string, domain: string): Promise<CustomDomainConfig> {
    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.)*[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      throw new BadRequestException('Invalid domain format. Example: track.yourcompany.com');
    }

    // Clean domain
    const cleanDomain = domain.toLowerCase().trim();

    // Check if domain is already used by another team
    const { data: existing } = await this.supabase
      .from('teams')
      .select('id')
      .eq('tracking_domain', cleanDomain)
      .neq('id', teamId)
      .single();

    if (existing) {
      throw new BadRequestException('This domain is already in use by another team');
    }

    // Set domain (unverified initially)
    const { data, error } = await this.supabase
      .from('teams')
      .update({
        tracking_domain: cleanDomain,
        tracking_domain_verified: false,
        tracking_domain_verified_at: null,
      })
      .eq('id', teamId)
      .select('tracking_domain, tracking_domain_verified, tracking_domain_verified_at')
      .single();

    if (error) throw error;

    return {
      tracking_domain: data.tracking_domain,
      tracking_domain_verified: data.tracking_domain_verified,
      tracking_domain_verified_at: data.tracking_domain_verified_at,
    };
  }

  /**
   * Verify custom domain CNAME record
   */
  async verifyDomain(teamId: string): Promise<DomainVerificationResult> {
    // Get current domain config
    const config = await this.getConfig(teamId);

    if (!config.tracking_domain) {
      throw new BadRequestException('No tracking domain configured');
    }

    const domain = config.tracking_domain;
    
    try {
      // Resolve CNAME record
      const cnameRecords = await resolveCname(domain);
      
      // Check if any CNAME points to our tracking domain
      const isValid = cnameRecords.some(
        (record) => record.toLowerCase() === TRACKING_TARGET_DOMAIN.toLowerCase()
      );

      if (isValid) {
        // Update verification status
        await this.supabase
          .from('teams')
          .update({
            tracking_domain_verified: true,
            tracking_domain_verified_at: new Date().toISOString(),
          })
          .eq('id', teamId);

        return {
          verified: true,
          domain,
          expected_target: TRACKING_TARGET_DOMAIN,
          actual_targets: cnameRecords,
        };
      } else {
        return {
          verified: false,
          domain,
          expected_target: TRACKING_TARGET_DOMAIN,
          actual_targets: cnameRecords,
          error: `CNAME record found but points to ${cnameRecords.join(', ')} instead of ${TRACKING_TARGET_DOMAIN}`,
        };
      }
    } catch (err: any) {
      // DNS lookup failed
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        return {
          verified: false,
          domain,
          expected_target: TRACKING_TARGET_DOMAIN,
          actual_targets: [],
          error: 'No CNAME record found. Please add the CNAME record and try again.',
        };
      }
      
      throw new BadRequestException(`DNS lookup failed: ${err.message}`);
    }
  }

  /**
   * Remove custom domain
   */
  async removeDomain(teamId: string): Promise<void> {
    const { error } = await this.supabase
      .from('teams')
      .update({
        tracking_domain: null,
        tracking_domain_verified: false,
        tracking_domain_verified_at: null,
      })
      .eq('id', teamId);

    if (error) throw error;
  }

  /**
   * Get DNS instructions for domain setup
   */
  getDnsInstructions(domain: string): {
    type: string;
    name: string;
    value: string;
    ttl: number;
    instructions: string;
  } {
    return {
      type: 'CNAME',
      name: domain,
      value: TRACKING_TARGET_DOMAIN,
      ttl: 3600,
      instructions: `Add a CNAME record pointing ${domain} to ${TRACKING_TARGET_DOMAIN}. 
This may take up to 24 hours to propagate, but usually completes within a few minutes.`,
    };
  }

  /**
   * Get the tracking base URL for a team
   * Returns custom domain if verified, otherwise returns default
   */
  async getTrackingBaseUrl(teamId: string): Promise<string> {
    const config = await this.getConfig(teamId);

    if (config.tracking_domain_verified && config.tracking_domain) {
      return `https://${config.tracking_domain}`;
    }

    // Default tracking URL
    return process.env.DEFAULT_TRACKING_URL || 'https://tracking.aninda.app';
  }

  /**
   * Check if a domain is verified for a team
   */
  async isDomainVerified(teamId: string): Promise<boolean> {
    const config = await this.getConfig(teamId);
    return config.tracking_domain_verified;
  }
}
