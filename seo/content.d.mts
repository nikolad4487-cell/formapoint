import type { Service } from '../src/lib/domain';
export const faqs: [string, string][];
export const buySteps: [string, string][];
export const publicPages: Record<string, { title: string; heading: string; description: string }>;
export const legalSlugs: string[];
export function servicePreparation(service: Service): string[];
