export interface ApprovedPackage {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  period: string;
}
export const monthlyPackageTerms: string;
export const packagePlans2027: {
  service_id: string;
  service_name: string;
  packages: ApprovedPackage[];
}[];
