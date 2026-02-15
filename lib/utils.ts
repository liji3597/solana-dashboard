import { PublicKey } from '@solana/web3.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatApiError(error: unknown, context: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(`${context}: ${(error as { message: string }).message}`);
  }

  return new Error(`${context}: Unknown error`);
}

export function validateSolanaAddress(address: string): void {
  try {
    // PublicKey constructor throws automatically for invalid inputs
    new PublicKey(address);
  } catch (error) {
    throw formatApiError(error, 'Invalid Solana address');
  }
}
