import { parsePhoneNumberFromString } from "libphonenumber-js";

// Countries where WhatsApp is commonly used for business communication
const WHATSAPP_COMMON_COUNTRIES = [
  "BR", // Brazil
  "IN", // India
  "MX", // Mexico
  "CO", // Colombia
  "AR", // Argentina
  "PE", // Peru
  "VE", // Venezuela
  "CL", // Chile
  "EC", // Ecuador
  "GT", // Guatemala
  "BO", // Bolivia
  "PY", // Paraguay
  "UY", // Uruguay
  "HN", // Honduras
  "SV", // El Salvador
  "NI", // Nicaragua
  "CR", // Costa Rica
  "PA", // Panama
  "DO", // Dominican Republic
  "ID", // Indonesia
  "PH", // Philippines
  "MY", // Malaysia
  "TH", // Thailand
  "VN", // Vietnam
  "ZA", // South Africa
  "NG", // Nigeria
  "KE", // Kenya
  "ES", // Spain
  "IT", // Italy
  "PT", // Portugal
  "DE", // Germany
];

/**
 * Checks if a phone number is likely a mobile number AND from a country
 * where WhatsApp is commonly used for business.
 * 
 * For US numbers: WhatsApp is NOT common for business, so returns false.
 * For other countries: checks if the number type is mobile.
 */
export function isMobileNumber(phone: string): boolean {
  if (!phone) return false;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return false;
    
    const country = parsed.country;
    
    // US numbers: WhatsApp is not common for business
    // We cannot reliably distinguish mobile from landline anyway
    if (country === "US" || country === "CA") {
      return false;
    }
    
    // For non-WhatsApp-common countries, don't show WhatsApp
    if (country && !WHATSAPP_COMMON_COUNTRIES.includes(country)) {
      return false;
    }
    
    const type = parsed.getType();
    
    // These types are considered mobile/WhatsApp-capable
    const mobileTypes = ["MOBILE", "FIXED_LINE_OR_MOBILE"];
    
    if (type && mobileTypes.includes(type)) {
      return true;
    }
    
    // If we can't determine the type but the country uses WhatsApp commonly,
    // we'll assume it could be mobile
    if (!type && country && WHATSAPP_COMMON_COUNTRIES.includes(country)) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a phone number is a landline or toll-free (definitely not mobile).
 */
export function isLandline(phone: string): boolean {
  if (!phone) return false;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return false;
    
    const type = parsed.getType();
    
    // These types are definitely landlines
    const landlineTypes = ["FIXED_LINE", "TOLL_FREE", "PREMIUM_RATE", "SHARED_COST", "VOIP", "PERSONAL_NUMBER", "PAGER", "UAN", "VOICEMAIL"];
    
    if (type && landlineTypes.includes(type)) {
      return true;
    }
    
    // Check for toll-free numbers (US/CA)
    if (parsed.country === "US" || parsed.country === "CA") {
      const nationalNumber = parsed.nationalNumber;
      const tollFreePrefixes = ["800", "888", "877", "866", "855", "844", "833"];
      const areaCode = nationalNumber.slice(0, 3);
      
      if (tollFreePrefixes.includes(areaCode)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Formats a phone number for WhatsApp URL (digits only, with country code).
 */
export function formatPhoneForWhatsApp(phone: string): string | null {
  if (!phone) return null;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return null;
    
    // Return just the digits (country code + national number)
    return parsed.countryCallingCode + parsed.nationalNumber;
  } catch {
    return null;
  }
}

/**
 * Generates a WhatsApp chat URL for the given phone number.
 */
export function getWhatsAppUrl(phone: string): string | null {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  
  return `https://wa.me/${formatted}`;
}

/**
 * Generates a tel: URL for making phone calls.
 */
export function getPhoneCallUrl(phone: string): string | null {
  if (!phone) return null;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return null;
    
    return `tel:${parsed.format("E.164")}`;
  } catch {
    return null;
  }
}

/**
 * Generates an sms: URL for sending text messages.
 * On iOS, this opens iMessage if the recipient has it enabled.
 */
export function getSmsUrl(phone: string): string | null {
  if (!phone) return null;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return null;
    
    return `sms:${parsed.format("E.164")}`;
  } catch {
    return null;
  }
}
