/**
 * SMTP Error Parser - Classifies raw SMTP error messages into
 * user-friendly, actionable error descriptions.
 * 
 * Used both in the frontend (to parse error messages from the API)
 * and as reference for the Supabase Edge Functions.
 */

export type SmtpErrorCategory =
  | 'auth_failed'
  | 'app_password_required'
  | 'connection_timeout'
  | 'connection_refused'
  | 'tls_error'
  | 'recipient_rejected'
  | 'mailbox_full'
  | 'rate_limited'
  | 'blocked_spam'
  | 'daily_limit'
  | 'smtp_not_configured'
  | 'missing_email'
  | 'invalid_domain'
  | 'profile_incomplete'
  | 'no_template'
  | 'unknown';

export interface ParsedSmtpError {
  category: SmtpErrorCategory;
  /** i18n key for the user-friendly title */
  titleKey: string;
  /** i18n key for the user-friendly description */
  descriptionKey: string;
  /** Raw original error message for debugging */
  rawMessage: string;
}

/**
 * Classify a raw SMTP/send error message into a user-friendly category.
 * The returned keys can be used with i18n t() to get localized messages.
 */
export function parseSmtpError(rawMessage: string): ParsedSmtpError {
  const m = (rawMessage ?? '').toLowerCase();

  // --- Authentication errors ---
  if (
    m.includes('535') ||
    m.includes('username and password not accepted') ||
    m.includes('invalid credentials') ||
    (m.includes('auth') && (m.includes('fail') || m.includes('falhou') || m.includes('erro')))
  ) {
    return {
      category: 'auth_failed',
      titleKey: 'smtp_errors.auth_failed.title',
      descriptionKey: 'smtp_errors.auth_failed.description',
      rawMessage,
    };
  }

  // App password required (Gmail specific)
  if (
    m.includes('534') ||
    m.includes('application-specific password') ||
    m.includes('app password') ||
    m.includes('less secure')
  ) {
    return {
      category: 'app_password_required',
      titleKey: 'smtp_errors.app_password_required.title',
      descriptionKey: 'smtp_errors.app_password_required.description',
      rawMessage,
    };
  }

  // --- Connection errors ---
  if (m.includes('timeout') || m.includes('timed out') || m.includes('após') && m.includes('ms')) {
    return {
      category: 'connection_timeout',
      titleKey: 'smtp_errors.connection_timeout.title',
      descriptionKey: 'smtp_errors.connection_timeout.description',
      rawMessage,
    };
  }

  if (m.includes('connection refused') || m.includes('conexão recusada') || m.includes('econnrefused')) {
    return {
      category: 'connection_refused',
      titleKey: 'smtp_errors.connection_refused.title',
      descriptionKey: 'smtp_errors.connection_refused.description',
      rawMessage,
    };
  }

  if (
    m.includes('tls') ||
    m.includes('ssl') ||
    m.includes('handshake') ||
    m.includes('certificate') ||
    m.includes('starttls')
  ) {
    return {
      category: 'tls_error',
      titleKey: 'smtp_errors.tls_error.title',
      descriptionKey: 'smtp_errors.tls_error.description',
      rawMessage,
    };
  }

  // --- Recipient errors ---
  if (
    m.includes('550') ||
    m.includes('551') ||
    m.includes('553') ||
    m.includes('recipient rejected') ||
    m.includes('user unknown') ||
    m.includes('unknown user') ||
    m.includes('mailbox not found') ||
    m.includes('no such user')
  ) {
    return {
      category: 'recipient_rejected',
      titleKey: 'smtp_errors.recipient_rejected.title',
      descriptionKey: 'smtp_errors.recipient_rejected.description',
      rawMessage,
    };
  }

  if (m.includes('552') || m.includes('mailbox full') || m.includes('over quota') || m.includes('storage')) {
    return {
      category: 'mailbox_full',
      titleKey: 'smtp_errors.mailbox_full.title',
      descriptionKey: 'smtp_errors.mailbox_full.description',
      rawMessage,
    };
  }

  // --- Rate limiting ---
  if (
    m.includes('421') ||
    m.includes('429') ||
    m.includes('too many') ||
    m.includes('rate limit') ||
    m.includes('try again later') ||
    m.includes('daily_limit_reached') ||
    m.includes('limite diário')
  ) {
    return {
      category: 'rate_limited',
      titleKey: 'smtp_errors.rate_limited.title',
      descriptionKey: 'smtp_errors.rate_limited.description',
      rawMessage,
    };
  }

  // --- Spam/Block ---
  if (
    m.includes('554') ||
    m.includes('blocked') ||
    m.includes('blacklisted') ||
    m.includes('spam') ||
    m.includes('rejected') ||
    m.includes('policy') ||
    m.includes('abuse')
  ) {
    return {
      category: 'blocked_spam',
      titleKey: 'smtp_errors.blocked_spam.title',
      descriptionKey: 'smtp_errors.blocked_spam.description',
      rawMessage,
    };
  }

  // --- Config errors ---
  if (m.includes('smtp config not found') || m.includes('smtp não configurado') || m.includes('smtp password not found')) {
    return {
      category: 'smtp_not_configured',
      titleKey: 'smtp_errors.smtp_not_configured.title',
      descriptionKey: 'smtp_errors.smtp_not_configured.description',
      rawMessage,
    };
  }

  if (m.includes('email ausente') || m.includes('destino') && m.includes('ausente')) {
    return {
      category: 'missing_email',
      titleKey: 'smtp_errors.missing_email.title',
      descriptionKey: 'smtp_errors.missing_email.description',
      rawMessage,
    };
  }

  if (m.includes('domínio') && m.includes('inválido') || m.includes('invalid domain')) {
    return {
      category: 'invalid_domain',
      titleKey: 'smtp_errors.invalid_domain.title',
      descriptionKey: 'smtp_errors.invalid_domain.description',
      rawMessage,
    };
  }

  if (m.includes('perfil incompleto') || m.includes('profile incomplete')) {
    return {
      category: 'profile_incomplete',
      titleKey: 'smtp_errors.profile_incomplete.title',
      descriptionKey: 'smtp_errors.profile_incomplete.description',
      rawMessage,
    };
  }

  if (m.includes('nenhum template') || m.includes('no template')) {
    return {
      category: 'no_template',
      titleKey: 'smtp_errors.no_template.title',
      descriptionKey: 'smtp_errors.no_template.description',
      rawMessage,
    };
  }

  // --- Connection closed unexpectedly ---
  if (m.includes('conexão smtp encerrada') || m.includes('connection closed') || m.includes('eof') || m.includes('broken pipe')) {
    return {
      category: 'connection_refused',
      titleKey: 'smtp_errors.connection_closed.title',
      descriptionKey: 'smtp_errors.connection_closed.description',
      rawMessage,
    };
  }

  // --- Unknown ---
  return {
    category: 'unknown',
    titleKey: 'smtp_errors.unknown.title',
    descriptionKey: 'smtp_errors.unknown.description',
    rawMessage,
  };
}

/**
 * Get a short user-friendly summary for display in badges/tooltips.
 * Falls back to truncated raw message if no category matches.
 */
export function getShortErrorLabel(rawMessage: string): string {
  const parsed = parseSmtpError(rawMessage);
  // Return the titleKey which the caller should pass through t()
  return parsed.titleKey;
}
