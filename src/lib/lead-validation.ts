const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'test.com',
  'email.com',
  'domain.com',
  'company.com',
  'yourmail.com',
  'placeholder.com',
]);

const PLACEHOLDER_EMAILS = new Set([
  'test@test.com',
  'user@example.com',
  'email@email.com',
  'noreply@example.com',
]);

export interface LeadValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: {
    email: string;
    phone: string;
  };
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_RE.test(trimmed)) return 'Email format is invalid.';
  const domain = trimmed.split('@')[1];
  if (PLACEHOLDER_DOMAINS.has(domain)) {
    return `Email domain "${domain}" looks like a placeholder.`;
  }
  if (PLACEHOLDER_EMAILS.has(trimmed)) {
    return 'Email looks like a placeholder address.';
  }
  return null;
}

export function validatePhone(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    return 'Phone number is too short.';
  }
  if (!/^\+?\d{10,15}$/.test(normalized.replace('+', ''))) {
    return 'Phone number format is invalid.';
  }
  return null;
}

export function validateLeadInput(input: {
  name: string;
  email: string;
  phone: string;
  confirmedByCaller: boolean;
}): LeadValidationResult {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name || name.length < 2) {
    errors.push('Name must be at least 2 characters.');
  }
  if (/^(unknown|caller|user|test|na|n\/a)$/i.test(name)) {
    errors.push('Name looks like a placeholder.');
  }

  const emailErr = validateEmail(input.email);
  if (emailErr) errors.push(emailErr);

  const phoneErr = validatePhone(input.phone);
  if (phoneErr) errors.push(phoneErr);

  if (!input.confirmedByCaller) {
    errors.push(
      'Caller must confirm email and phone aloud before saving the lead.',
    );
  }

  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    normalized: {
      email: input.email.trim().toLowerCase(),
      phone: normalizePhone(input.phone),
    },
  };
}

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(
    /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  );
  return [...new Set((matches ?? []).map((e) => e.toLowerCase()))];
}

export function extractPhonesFromText(text: string): string[] {
  const matches = text.match(/\+?\d[\d\s-]{8,14}\d/g);
  return [...new Set((matches ?? []).map((p) => normalizePhone(p)))];
}
