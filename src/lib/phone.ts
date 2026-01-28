import { parsePhoneNumberFromString, isValidPhoneNumber } from "libphonenumber-js";

/**
 * Checks if a phone number is likely a mobile number (not landline).
 * Uses libphonenumber-js to parse and detect phone type.
 * 
 * Note: For some countries (like US), it's not always possible to distinguish
 * mobile from landline with 100% accuracy. We use heuristics.
 */
export function isMobileNumber(phone: string): boolean {
  if (!phone) return false;
  
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) return false;
    
    const type = parsed.getType();
    
    // These types are considered mobile/WhatsApp-capable
    const mobileTypes = ["MOBILE", "FIXED_LINE_OR_MOBILE"];
    
    if (type && mobileTypes.includes(type)) {
      return true;
    }
    
    // For US numbers, check if it's not a toll-free or special number
    // If type is undefined but number is valid, we assume it could be mobile
    if (parsed.country === "US" && !type) {
      const nationalNumber = parsed.nationalNumber;
      // Exclude known toll-free prefixes
      const tollFreePrefixes = ["800", "888", "877", "866", "855", "844", "833"];
      const areaCode = nationalNumber.slice(0, 3);
      
      if (tollFreePrefixes.includes(areaCode)) {
        return false;
      }
      
      // For US, we can't reliably distinguish mobile from landline
      // but most recruiters use mobile, so we'll show WhatsApp option
      return true;
    }
    
    // For other countries where type couldn't be determined
    // but number is valid, assume it could be mobile
    return type === undefined;
  } catch {
    return false;
  }
}

/**
 * Checks if a phone number is a landline (definitely not mobile).
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
    
    // Check for toll-free numbers (US)
    const parsed2 = parsePhoneNumberFromString(phone);
    if (parsed2?.country === "US") {
      const nationalNumber = parsed2.nationalNumber;
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
