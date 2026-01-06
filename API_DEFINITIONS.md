# API Definitions

## Cold Email Platform - REST API Specification

This document defines all API endpoints for the cold email platform. These APIs will be implemented once API keys and secrets are provided.

---

## Base URL

```
Production: https://api.yourplatform.com/v1
Development: http://localhost:3001/v1
```

## Authentication

All endpoints (except auth) require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Tokens are obtained via Supabase Auth and validated on each request.

---

## 1. Authentication APIs

### 1.1 OAuth Callback (Google)

**Endpoint:** `GET /auth/google/callback`

**Description:** Handles OAuth callback from Google for inbox connection

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Authorization code from Google |
| state | string | Yes | CSRF token + redirect info |

**Response:**
```json
{
  "success": true,
  "inbox": {
    "id": "inbox_123",
    "email": "user@gmail.com",
    "provider": "google"
  },
  "redirect_url": "/inboxes/inbox_123"
}
```

**Error Responses:**
- `400` - Invalid or expired code
- `403` - Email already connected to another team

---

### 1.2 OAuth Callback (Microsoft)

**Endpoint:** `GET /auth/microsoft/callback`

**Description:** Handles OAuth callback from Microsoft for inbox connection

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Authorization code from Microsoft |
| state | string | Yes | CSRF token + redirect info |

**Response:**
```json
{
  "success": true,
  "inbox": {
    "id": "inbox_124",
    "email": "user@outlook.com",
    "provider": "microsoft"
  },
  "redirect_url": "/inboxes/inbox_124"
}
```

---

### 1.3 Refresh OAuth Token

**Endpoint:** `POST /auth/refresh-token`

**Description:** Manually trigger OAuth token refresh for an inbox

**Request Body:**
```json
{
  "inbox_id": "inbox_123"
}
```

**Response:**
```json
{
  "success": true,
  "expires_at": "2024-02-01T12:00:00Z"
}
```

---

## 2. Inbox APIs

### 2.1 List Inboxes

**Endpoint:** `GET /inboxes`

**Description:** Get all inboxes for the current team

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: `active`, `paused`, `error` |
| provider | string | No | Filter by provider: `google`, `microsoft`, `smtp` |
| warmup_enabled | boolean | No | Filter by warmup status |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "inbox_123",
      "email": "sales@company.com",
      "provider": "google",
      "status": "active",
      "health_score": 92,
      "warmup_enabled": true,
      "warmup_day": 15,
      "daily_send_limit": 50,
      "sent_today": 23,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

### 2.2 Get Inbox

**Endpoint:** `GET /inboxes/:id`

**Description:** Get detailed information about a specific inbox

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Inbox ID |

**Response:**
```json
{
  "id": "inbox_123",
  "email": "sales@company.com",
  "provider": "google",
  "status": "active",
  "health_score": 92,
  "health_components": {
    "deliverability": 95,
    "engagement": 88,
    "warmup_progress": 90,
    "spam_reports": 100,
    "send_volume": 85
  },
  "warmup": {
    "enabled": true,
    "day": 15,
    "daily_quota": 25,
    "sent_today": 12,
    "replies_today": 8
  },
  "settings": {
    "daily_send_limit": 50,
    "hourly_limit": 10,
    "min_delay_seconds": 60,
    "max_delay_seconds": 300,
    "send_window_start": "09:00",
    "send_window_end": "17:00",
    "send_window_timezone": "America/New_York",
    "weekends_enabled": false
  },
  "metrics": {
    "sent_today": 23,
    "sent_this_week": 156,
    "bounce_rate_7d": 0.02,
    "open_rate_7d": 0.45,
    "reply_rate_7d": 0.08
  },
  "oauth_expires_at": "2024-02-15T10:00:00Z",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-20T15:30:00Z"
}
```

---

### 2.3 Create Inbox (SMTP)

**Endpoint:** `POST /inboxes/smtp`

**Description:** Add a new SMTP/IMAP inbox (non-OAuth)

**Request Body:**
```json
{
  "email": "outreach@company.com",
  "smtp_host": "smtp.company.com",
  "smtp_port": 587,
  "smtp_username": "outreach@company.com",
  "smtp_password": "app_password_here",
  "imap_host": "imap.company.com",
  "imap_port": 993,
  "from_name": "John from Company",
  "daily_send_limit": 100
}
```

**Response:**
```json
{
  "id": "inbox_125",
  "email": "outreach@company.com",
  "provider": "smtp",
  "status": "active",
  "created_at": "2024-01-20T10:00:00Z"
}
```

**Error Responses:**
- `400` - Invalid SMTP credentials
- `409` - Email already exists

---

### 2.4 Update Inbox Settings

**Endpoint:** `PATCH /inboxes/:id`

**Description:** Update inbox configuration

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Inbox ID |

**Request Body:**
```json
{
  "from_name": "Sales Team",
  "daily_send_limit": 75,
  "hourly_limit": 15,
  "min_delay_seconds": 90,
  "max_delay_seconds": 360,
  "send_window_start": "08:00",
  "send_window_end": "18:00",
  "send_window_timezone": "America/Los_Angeles",
  "weekends_enabled": true
}
```

**Response:**
```json
{
  "id": "inbox_123",
  "email": "sales@company.com",
  "settings": {
    "daily_send_limit": 75,
    "hourly_limit": 15,
    "min_delay_seconds": 90,
    "max_delay_seconds": 360,
    "send_window_start": "08:00",
    "send_window_end": "18:00",
    "send_window_timezone": "America/Los_Angeles",
    "weekends_enabled": true
  },
  "updated_at": "2024-01-20T16:00:00Z"
}
```

---

### 2.5 Delete Inbox

**Endpoint:** `DELETE /inboxes/:id`

**Description:** Remove an inbox and revoke OAuth tokens

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Inbox ID |

**Response:**
```json
{
  "success": true,
  "message": "Inbox deleted successfully"
}
```

**Notes:**
- Stops all active campaigns using this inbox
- Redistributes queued emails to other inboxes
- Revokes OAuth tokens if applicable

---

### 2.6 Pause/Resume Inbox

**Endpoint:** `POST /inboxes/:id/pause`

**Description:** Pause an inbox (stops sending, keeps configuration)

**Request Body:**
```json
{
  "reason": "Manual pause for review"
}
```

**Response:**
```json
{
  "id": "inbox_123",
  "status": "paused",
  "paused_at": "2024-01-20T16:00:00Z",
  "paused_reason": "Manual pause for review"
}
```

---

**Endpoint:** `POST /inboxes/:id/resume`

**Description:** Resume a paused inbox

**Response:**
```json
{
  "id": "inbox_123",
  "status": "active",
  "resumed_at": "2024-01-20T17:00:00Z"
}
```

---

### 2.7 Test Inbox Connection

**Endpoint:** `POST /inboxes/:id/test`

**Description:** Test SMTP/IMAP connectivity and send a test email

**Request Body:**
```json
{
  "test_recipient": "test@yourteam.com"
}
```

**Response:**
```json
{
  "smtp_status": "connected",
  "imap_status": "connected",
  "test_email_sent": true,
  "latency_ms": 245
}
```

---

## 3. Warm-up APIs

### 3.1 Get Warm-up Status

**Endpoint:** `GET /inboxes/:id/warmup`

**Description:** Get detailed warm-up status for an inbox

**Response:**
```json
{
  "inbox_id": "inbox_123",
  "enabled": true,
  "started_at": "2024-01-05T00:00:00Z",
  "current_day": 15,
  "phase": "ramping",
  "daily_quota": 25,
  "stats_today": {
    "sent": 12,
    "received": 14,
    "replied": 8,
    "opened": 11
  },
  "stats_total": {
    "sent": 234,
    "received": 256,
    "replied": 189,
    "opened": 245
  },
  "health_trend": [
    { "date": "2024-01-18", "score": 88 },
    { "date": "2024-01-19", "score": 90 },
    { "date": "2024-01-20", "score": 92 }
  ]
}
```

---

### 3.2 Enable Warm-up

**Endpoint:** `POST /inboxes/:id/warmup/enable`

**Description:** Enable warm-up for an inbox

**Request Body:**
```json
{
  "ramp_speed": "normal",
  "target_daily_volume": 40
}
```

**Options for `ramp_speed`:**
- `slow` - 45 days to full volume
- `normal` - 30 days to full volume
- `fast` - 14 days to full volume (higher risk)

**Response:**
```json
{
  "inbox_id": "inbox_123",
  "warmup_enabled": true,
  "started_at": "2024-01-20T00:00:00Z",
  "ramp_speed": "normal",
  "estimated_full_warmup_date": "2024-02-19"
}
```

---

### 3.3 Disable Warm-up

**Endpoint:** `POST /inboxes/:id/warmup/disable`

**Description:** Disable warm-up for an inbox

**Response:**
```json
{
  "inbox_id": "inbox_123",
  "warmup_enabled": false,
  "disabled_at": "2024-01-20T16:00:00Z",
  "warmup_day_reached": 15
}
```

---

### 3.4 Update Warm-up Settings

**Endpoint:** `PATCH /inboxes/:id/warmup`

**Description:** Adjust warm-up configuration

**Request Body:**
```json
{
  "ramp_speed": "slow",
  "target_daily_volume": 30,
  "reply_rate_target": 0.7
}
```

**Response:**
```json
{
  "inbox_id": "inbox_123",
  "ramp_speed": "slow",
  "target_daily_volume": 30,
  "reply_rate_target": 0.7,
  "updated_at": "2024-01-20T16:00:00Z"
}
```

---

### 3.5 Get Warm-up Pool Stats

**Endpoint:** `GET /warmup/pool/stats`

**Description:** Get overall warm-up pool statistics

**Response:**
```json
{
  "total_inboxes_in_pool": 156,
  "your_inboxes_in_pool": 8,
  "interactions_today": 3420,
  "your_interactions_today": 187,
  "pool_health": "healthy"
}
```

---

## 4. Campaign APIs

### 4.1 List Campaigns

**Endpoint:** `GET /campaigns`

**Description:** Get all campaigns for the current team

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter: `draft`, `active`, `paused`, `completed` |
| page | number | No | Page number |
| limit | number | No | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": "camp_123",
      "name": "Q1 Outreach",
      "status": "active",
      "lead_count": 2450,
      "sent": 1234,
      "opened": 567,
      "replied": 89,
      "bounced": 12,
      "open_rate": 0.46,
      "reply_rate": 0.072,
      "created_at": "2024-01-10T10:00:00Z",
      "started_at": "2024-01-12T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "total_pages": 1
  }
}
```

---

### 4.2 Get Campaign

**Endpoint:** `GET /campaigns/:id`

**Description:** Get detailed campaign information

**Response:**
```json
{
  "id": "camp_123",
  "name": "Q1 Outreach",
  "status": "active",
  "settings": {
    "timezone": "America/New_York",
    "send_days": ["mon", "tue", "wed", "thu", "fri"],
    "stop_on_reply": true,
    "stop_on_bounce": true,
    "track_opens": true,
    "track_clicks": true,
    "esp_matching": true,
    "min_health_score": 70
  },
  "assigned_inboxes": [
    {
      "id": "inbox_123",
      "email": "sales@company.com",
      "health_score": 92
    }
  ],
  "lead_list": {
    "id": "list_456",
    "name": "Q1 Prospects",
    "total_leads": 2450
  },
  "sequences": [
    {
      "id": "seq_1",
      "step_number": 1,
      "delay_days": 0,
      "delay_hours": 0,
      "subject": "{{firstName}}, quick question",
      "body": "<p>Hi {{firstName}},...</p>",
      "variants": []
    },
    {
      "id": "seq_2",
      "step_number": 2,
      "delay_days": 3,
      "delay_hours": 0,
      "subject": "Re: {{firstName}}, quick question",
      "body": "<p>Following up...</p>",
      "variants": []
    }
  ],
  "stats": {
    "leads_pending": 1216,
    "leads_in_sequence": 890,
    "leads_completed": 344,
    "leads_replied": 89,
    "leads_bounced": 12,
    "leads_unsubscribed": 3
  },
  "created_at": "2024-01-10T10:00:00Z",
  "started_at": "2024-01-12T09:00:00Z"
}
```

---

### 4.3 Create Campaign

**Endpoint:** `POST /campaigns`

**Description:** Create a new campaign

**Request Body:**
```json
{
  "name": "Product Launch Campaign",
  "lead_list_id": "list_456",
  "inbox_ids": ["inbox_123", "inbox_124"],
  "settings": {
    "timezone": "America/New_York",
    "send_days": ["mon", "tue", "wed", "thu", "fri"],
    "stop_on_reply": true,
    "stop_on_bounce": true,
    "track_opens": true,
    "track_clicks": false,
    "esp_matching": true,
    "min_health_score": 70
  },
  "sequences": [
    {
      "step_number": 1,
      "delay_days": 0,
      "delay_hours": 0,
      "subject": "{{firstName}}, introducing {{product}}",
      "body": "<p>Hi {{firstName}},</p><p>I noticed {{company}} is...</p>"
    },
    {
      "step_number": 2,
      "delay_days": 3,
      "delay_hours": 0,
      "subject": "Re: {{firstName}}, introducing {{product}}",
      "body": "<p>Just following up on my previous email...</p>"
    }
  ]
}
```

**Response:**
```json
{
  "id": "camp_124",
  "name": "Product Launch Campaign",
  "status": "draft",
  "created_at": "2024-01-20T10:00:00Z"
}
```

---

### 4.4 Update Campaign

**Endpoint:** `PATCH /campaigns/:id`

**Description:** Update campaign settings (only when draft or paused)

**Request Body:**
```json
{
  "name": "Product Launch Campaign v2",
  "settings": {
    "send_days": ["mon", "tue", "wed", "thu"],
    "min_health_score": 80
  }
}
```

**Response:**
```json
{
  "id": "camp_124",
  "name": "Product Launch Campaign v2",
  "updated_at": "2024-01-20T11:00:00Z"
}
```

---

### 4.5 Start Campaign

**Endpoint:** `POST /campaigns/:id/start`

**Description:** Start a draft campaign (begins sending)

**Request Body:**
```json
{
  "schedule_start": "2024-01-21T09:00:00Z"
}
```

**Response:**
```json
{
  "id": "camp_124",
  "status": "active",
  "started_at": "2024-01-21T09:00:00Z",
  "estimated_completion": "2024-02-15T17:00:00Z"
}
```

**Validation:**
- At least one inbox assigned
- Lead list not empty
- At least one sequence step
- Sequences have subject and body

---

### 4.6 Pause Campaign

**Endpoint:** `POST /campaigns/:id/pause`

**Description:** Pause an active campaign

**Response:**
```json
{
  "id": "camp_124",
  "status": "paused",
  "paused_at": "2024-01-22T10:00:00Z",
  "queued_emails_held": 156
}
```

---

### 4.7 Resume Campaign

**Endpoint:** `POST /campaigns/:id/resume`

**Description:** Resume a paused campaign

**Response:**
```json
{
  "id": "camp_124",
  "status": "active",
  "resumed_at": "2024-01-22T14:00:00Z"
}
```

---

### 4.8 Delete Campaign

**Endpoint:** `DELETE /campaigns/:id`

**Description:** Delete a campaign (removes from queue, keeps history)

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted",
  "emails_cancelled": 1216
}
```

---

### 4.9 Add/Update Sequence Step

**Endpoint:** `POST /campaigns/:id/sequences`

**Description:** Add a new sequence step

**Request Body:**
```json
{
  "step_number": 3,
  "delay_days": 4,
  "delay_hours": 0,
  "subject": "Last follow-up: {{firstName}}",
  "body": "<p>Hi {{firstName}}, final follow-up...</p>",
  "variants": [
    {
      "subject": "{{firstName}}, one more thing",
      "body": "<p>Alternative body...</p>",
      "weight": 50
    }
  ]
}
```

---

**Endpoint:** `PATCH /campaigns/:id/sequences/:step_id`

**Description:** Update an existing sequence step

---

**Endpoint:** `DELETE /campaigns/:id/sequences/:step_id`

**Description:** Remove a sequence step

---

### 4.10 Preview Email for Lead

**Endpoint:** `POST /campaigns/:id/preview`

**Description:** Preview how an email will look for a specific lead

**Request Body:**
```json
{
  "lead_id": "lead_789",
  "sequence_step": 1,
  "variant_index": 0
}
```

**Response:**
```json
{
  "subject": "John, introducing Acme Product",
  "body": "<p>Hi John,</p><p>I noticed Acme Corp is...</p>",
  "from": "Sales Team <sales@company.com>",
  "to": "john@acmecorp.com",
  "variables_used": {
    "firstName": "John",
    "company": "Acme Corp",
    "product": "Acme Product"
  }
}
```

---

## 5. Lead APIs

### 5.1 List Lead Lists

**Endpoint:** `GET /lead-lists`

**Description:** Get all lead lists

**Response:**
```json
{
  "data": [
    {
      "id": "list_456",
      "name": "Q1 Prospects",
      "lead_count": 2450,
      "created_at": "2024-01-08T10:00:00Z"
    }
  ]
}
```

---

### 5.2 Create Lead List

**Endpoint:** `POST /lead-lists`

**Description:** Create a new lead list

**Request Body:**
```json
{
  "name": "Product Launch Targets",
  "description": "Leads for Q1 product launch"
}
```

**Response:**
```json
{
  "id": "list_457",
  "name": "Product Launch Targets",
  "lead_count": 0,
  "created_at": "2024-01-20T10:00:00Z"
}
```

---

### 5.3 Import Leads (CSV)

**Endpoint:** `POST /lead-lists/:id/import`

**Description:** Import leads from CSV

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | CSV file |
| mapping | json | Yes | Column mapping |
| skip_duplicates | boolean | No | Skip existing emails |

**Mapping Example:**
```json
{
  "email": "Email Address",
  "firstName": "First Name",
  "lastName": "Last Name",
  "company": "Company",
  "title": "Job Title",
  "customFields": {
    "linkedin": "LinkedIn URL",
    "phone": "Phone"
  }
}
```

**Response:**
```json
{
  "imported": 2340,
  "skipped_duplicates": 110,
  "skipped_invalid": 15,
  "errors": [
    { "row": 156, "error": "Invalid email format" }
  ]
}
```

---

### 5.4 List Leads

**Endpoint:** `GET /lead-lists/:id/leads`

**Description:** Get leads in a list

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter: `pending`, `in_sequence`, `replied`, `bounced`, `unsubscribed` |
| search | string | No | Search email, name, company |
| page | number | No | Page number |
| limit | number | No | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": "lead_789",
      "email": "john@acmecorp.com",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "title": "VP Sales",
      "status": "in_sequence",
      "current_step": 2,
      "last_contacted": "2024-01-18T14:30:00Z",
      "customFields": {
        "linkedin": "https://linkedin.com/in/johndoe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2450,
    "total_pages": 49
  }
}
```

---

### 5.5 Get Lead

**Endpoint:** `GET /leads/:id`

**Description:** Get detailed lead information

**Response:**
```json
{
  "id": "lead_789",
  "email": "john@acmecorp.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Corp",
  "title": "VP Sales",
  "status": "replied",
  "reply_intent": "interested",
  "timezone": "America/New_York",
  "customFields": {
    "linkedin": "https://linkedin.com/in/johndoe",
    "phone": "+1234567890"
  },
  "activity": [
    {
      "type": "email_sent",
      "campaign_id": "camp_123",
      "step": 1,
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "type": "email_opened",
      "timestamp": "2024-01-15T14:30:00Z"
    },
    {
      "type": "reply_received",
      "intent": "interested",
      "timestamp": "2024-01-16T09:15:00Z"
    }
  ],
  "created_at": "2024-01-08T10:00:00Z"
}
```

---

### 5.6 Update Lead

**Endpoint:** `PATCH /leads/:id`

**Description:** Update lead information

**Request Body:**
```json
{
  "firstName": "Jonathan",
  "status": "contacted",
  "customFields": {
    "notes": "Had a call, interested in Q2"
  }
}
```

---

### 5.7 Delete Lead

**Endpoint:** `DELETE /leads/:id`

**Description:** Remove a lead from all lists

---

### 5.8 Add to Suppression List

**Endpoint:** `POST /suppression-list`

**Description:** Add email to global suppression list

**Request Body:**
```json
{
  "email": "noemail@example.com",
  "reason": "hard_bounce"
}
```

---

## 6. Reply & Events APIs

### 6.1 List Replies (Unified Inbox)

**Endpoint:** `GET /replies`

**Description:** Get all replies across campaigns

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| intent | string | No | Filter: `interested`, `not_interested`, `question`, `out_of_office`, `bounce` |
| campaign_id | string | No | Filter by campaign |
| inbox_id | string | No | Filter by inbox |
| is_read | boolean | No | Filter read/unread |
| date_from | string | No | Start date (ISO) |
| date_to | string | No | End date (ISO) |
| page | number | No | Page number |
| limit | number | No | Items per page |

**Response:**
```json
{
  "data": [
    {
      "id": "reply_123",
      "lead": {
        "id": "lead_789",
        "email": "john@acmecorp.com",
        "firstName": "John",
        "company": "Acme Corp"
      },
      "campaign": {
        "id": "camp_123",
        "name": "Q1 Outreach"
      },
      "inbox": {
        "id": "inbox_123",
        "email": "sales@company.com"
      },
      "subject": "Re: John, quick question",
      "body_preview": "Hi, this sounds interesting. Can we schedule...",
      "body_full": "<html>...</html>",
      "intent": "interested",
      "intent_confidence": 0.92,
      "is_read": false,
      "received_at": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 89,
    "total_pages": 5
  }
}
```

---

### 6.2 Get Reply

**Endpoint:** `GET /replies/:id`

**Description:** Get full reply details

---

### 6.3 Mark Reply as Read

**Endpoint:** `POST /replies/:id/read`

**Description:** Mark a reply as read

---

### 6.4 Update Reply Intent

**Endpoint:** `PATCH /replies/:id/intent`

**Description:** Manually correct intent classification

**Request Body:**
```json
{
  "intent": "meeting_request"
}
```

---

### 6.5 Reply to Lead

**Endpoint:** `POST /replies/:id/respond`

**Description:** Send a reply from the unified inbox

**Request Body:**
```json
{
  "body": "<p>Hi John, great to hear from you! How about Tuesday at 2pm?</p>",
  "inbox_id": "inbox_123"
}
```

---

### 6.6 List Events

**Endpoint:** `GET /events`

**Description:** Get email events (opens, clicks, bounces)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | Filter: `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained` |
| campaign_id | string | No | Filter by campaign |
| lead_id | string | No | Filter by lead |
| date_from | string | No | Start date |
| date_to | string | No | End date |

**Response:**
```json
{
  "data": [
    {
      "id": "evt_123",
      "type": "opened",
      "lead_id": "lead_789",
      "campaign_id": "camp_123",
      "email_id": "email_456",
      "metadata": {
        "user_agent": "Mozilla/5.0...",
        "ip_country": "US"
      },
      "timestamp": "2024-01-20T15:00:00Z"
    }
  ]
}
```

---

## 7. Analytics APIs

### 7.1 Dashboard Stats

**Endpoint:** `GET /analytics/dashboard`

**Description:** Get high-level dashboard statistics

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | No | `7d`, `30d`, `90d` (default: 7d) |

**Response:**
```json
{
  "period": "7d",
  "emails": {
    "sent": 4567,
    "delivered": 4432,
    "opened": 2043,
    "clicked": 456,
    "replied": 234,
    "bounced": 67,
    "unsubscribed": 12
  },
  "rates": {
    "delivery_rate": 0.97,
    "open_rate": 0.46,
    "click_rate": 0.10,
    "reply_rate": 0.053,
    "bounce_rate": 0.015
  },
  "trends": {
    "sent": [
      { "date": "2024-01-14", "value": 612 },
      { "date": "2024-01-15", "value": 689 },
      { "date": "2024-01-16", "value": 701 }
    ]
  },
  "top_campaigns": [
    {
      "id": "camp_123",
      "name": "Q1 Outreach",
      "reply_rate": 0.072
    }
  ],
  "inbox_health": {
    "healthy": 42,
    "warning": 3,
    "critical": 1
  }
}
```

---

### 7.2 Campaign Analytics

**Endpoint:** `GET /analytics/campaigns/:id`

**Description:** Get detailed analytics for a campaign

**Response:**
```json
{
  "campaign_id": "camp_123",
  "period": "all_time",
  "funnel": {
    "total_leads": 2450,
    "contacted": 1234,
    "opened": 567,
    "clicked": 123,
    "replied": 89,
    "interested": 34,
    "meetings_booked": 12
  },
  "by_step": [
    {
      "step": 1,
      "sent": 1234,
      "opened": 456,
      "replied": 67,
      "open_rate": 0.37,
      "reply_rate": 0.054
    },
    {
      "step": 2,
      "sent": 890,
      "opened": 312,
      "replied": 22,
      "open_rate": 0.35,
      "reply_rate": 0.025
    }
  ],
  "by_inbox": [
    {
      "inbox_id": "inbox_123",
      "email": "sales@company.com",
      "sent": 650,
      "reply_rate": 0.062
    }
  ],
  "by_day": [
    { "date": "2024-01-15", "sent": 123, "replies": 8 }
  ],
  "ab_test_results": [
    {
      "step": 1,
      "variants": [
        { "index": 0, "sent": 617, "reply_rate": 0.058 },
        { "index": 1, "sent": 617, "reply_rate": 0.051 }
      ],
      "winner": 0,
      "confidence": 0.78
    }
  ]
}
```

---

### 7.3 Inbox Analytics

**Endpoint:** `GET /analytics/inboxes/:id`

**Description:** Get analytics for a specific inbox

---

### 7.4 Deliverability Report

**Endpoint:** `GET /analytics/deliverability`

**Description:** Get deliverability health report

**Response:**
```json
{
  "overall_score": 92,
  "by_provider": {
    "gmail.com": {
      "sent": 2345,
      "delivered": 2290,
      "bounced": 23,
      "delivery_rate": 0.977
    },
    "outlook.com": {
      "sent": 1456,
      "delivered": 1398,
      "bounced": 34,
      "delivery_rate": 0.960
    }
  },
  "issues": [
    {
      "severity": "warning",
      "inbox_id": "inbox_125",
      "issue": "High bounce rate (4.2%)",
      "recommendation": "Review lead list quality"
    }
  ],
  "domain_health": [
    {
      "domain": "company.com",
      "spf": true,
      "dkim": true,
      "dmarc": true,
      "score": 100
    }
  ]
}
```

---

## 8. Team APIs

### 8.1 Get Team

**Endpoint:** `GET /team`

**Description:** Get current team information

**Response:**
```json
{
  "id": "team_123",
  "name": "Acme Sales",
  "plan": "pro",
  "limits": {
    "daily_emails": 50000,
    "active_inboxes": 100,
    "active_campaigns": 50,
    "team_members": 10
  },
  "usage": {
    "daily_emails_used": 4567,
    "active_inboxes": 45,
    "active_campaigns": 8,
    "team_members": 4
  },
  "members": [
    {
      "id": "user_123",
      "email": "admin@company.com",
      "role": "admin",
      "joined_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 8.2 Invite Team Member

**Endpoint:** `POST /team/invite`

**Description:** Invite a new team member

**Request Body:**
```json
{
  "email": "newmember@company.com",
  "role": "member"
}
```

---

### 8.3 Update Team Member Role

**Endpoint:** `PATCH /team/members/:id`

**Request Body:**
```json
{
  "role": "admin"
}
```

---

### 8.4 Remove Team Member

**Endpoint:** `DELETE /team/members/:id`

---

## 9. Webhook APIs

### 9.1 List Webhooks

**Endpoint:** `GET /webhooks`

**Description:** Get configured webhooks

**Response:**
```json
{
  "data": [
    {
      "id": "wh_123",
      "url": "https://yourapp.com/webhook",
      "events": ["reply.received", "lead.bounced"],
      "active": true,
      "created_at": "2024-01-10T10:00:00Z"
    }
  ]
}
```

---

### 9.2 Create Webhook

**Endpoint:** `POST /webhooks`

**Request Body:**
```json
{
  "url": "https://yourapp.com/webhook",
  "events": [
    "reply.received",
    "reply.interested",
    "lead.bounced",
    "lead.unsubscribed",
    "campaign.completed"
  ],
  "secret": "your_webhook_secret"
}
```

**Available Events:**
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `reply.received`
- `reply.interested`
- `reply.not_interested`
- `lead.bounced`
- `lead.unsubscribed`
- `campaign.started`
- `campaign.completed`
- `inbox.health_warning`
- `inbox.paused`

---

### 9.3 Webhook Payload Format

**Example: Reply Received**
```json
{
  "event": "reply.received",
  "timestamp": "2024-01-20T14:30:00Z",
  "data": {
    "reply_id": "reply_123",
    "lead": {
      "id": "lead_789",
      "email": "john@acmecorp.com",
      "firstName": "John"
    },
    "campaign_id": "camp_123",
    "intent": "interested",
    "body_preview": "Hi, this sounds interesting..."
  }
}
```

**Webhook Signature:**
```
X-Webhook-Signature: sha256=<hmac_sha256(body, secret)>
```

---

## 10. System APIs

### 10.1 Health Check

**Endpoint:** `GET /health`

**Description:** System health check (no auth required)

**Response:**
```json
{
  "status": "healthy",
  "version": "1.2.3",
  "components": {
    "database": "healthy",
    "redis": "healthy",
    "email_providers": "healthy"
  }
}
```

---

### 10.2 API Rate Limits

All API endpoints are rate limited:

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | 1000 | 100 |

Rate limit headers:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 295
X-RateLimit-Reset: 1705762800
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "not-an-email"
    }
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `QUOTA_EXCEEDED` | 402 | Plan limit reached |

---

## SDK Examples

### Node.js

```typescript
import { ColdEmailClient } from '@yourplatform/sdk';

const client = new ColdEmailClient({
  apiKey: process.env.API_KEY,
});

// Create campaign
const campaign = await client.campaigns.create({
  name: 'Q1 Outreach',
  leadListId: 'list_456',
  inboxIds: ['inbox_123'],
  sequences: [
    {
      stepNumber: 1,
      delayDays: 0,
      subject: '{{firstName}}, quick question',
      body: '<p>Hi {{firstName}},...</p>',
    },
  ],
});

// Start campaign
await client.campaigns.start(campaign.id);

// Listen for replies
client.webhooks.on('reply.interested', (data) => {
  console.log('Interested reply:', data.lead.email);
});
```

### Python

```python
from cold_email_sdk import ColdEmailClient

client = ColdEmailClient(api_key=os.environ['API_KEY'])

# List campaigns
campaigns = client.campaigns.list(status='active')

# Get analytics
analytics = client.analytics.dashboard(period='7d')
print(f"Reply rate: {analytics.rates.reply_rate}")
```
