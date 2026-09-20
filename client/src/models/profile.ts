export interface PastCompany {
  company: string;
  company_type: string;
  title: string;
  years: number;
}

export interface Profile {
  id: string;
  name: string;
  current_title: string;
  years_experience: number;
  location: string;
  current_company: string;
  current_company_type: string;
  skills: string[];
  past_companies: PastCompany[];
  education: string;
  summary: string;
}

export interface Catalog {
  skills: string[];
  locations: string[];
  companyTypes: string[];
  minYears: number;
  maxYears: number;
}
