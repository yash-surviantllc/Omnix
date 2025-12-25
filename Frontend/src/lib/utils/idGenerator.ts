/**
 * Generate a unique ID for inventory items
 * Uses timestamp + random string for uniqueness
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `inv_${timestamp}_${randomStr}`;
}

/**
 * Validate if a string is a valid inventory ID format
 */
export function isValidInventoryId(id: string): boolean {
  return /^inv_[a-z0-9]+_[a-z0-9]+$/.test(id);
}
