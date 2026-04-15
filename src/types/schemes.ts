export interface TrackedScheme {
  id: string;
  schemeName: string;
  description?: string;
  reason?: string;
  status: 'not_started' | 'in_progress' | 'pending' | 'submitted' | 'approved';
  lastUpdated: string;
  documents: { name: string; status: 'done' | 'pending' }[];
  officialLink: string;
}

export const AVAILABLE_SCHEMES: Record<string, Omit<TrackedScheme, 'id' | 'status' | 'lastUpdated'>> = {
  'PM-Kisan': {
    schemeName: 'PM-Kisan Samman Nidhi',
    documents: [
      { name: 'Aadhaar Card', status: 'done' },
      { name: 'Land Records', status: 'pending' },
      { name: 'Bank Passbook', status: 'pending' }
    ],
    officialLink: 'https://pmkisan.gov.in/'
  },
  'Ayushman Bharat': {
    schemeName: 'Ayushman Bharat (PM-JAY)',
    documents: [
      { name: 'Ration Card', status: 'done' },
      { name: 'Aadhaar Card', status: 'done' },
      { name: 'Income Certificate', status: 'pending' }
    ],
    officialLink: 'https://pmjay.gov.in/'
  },
  'PM Awas Yojana': {
    schemeName: 'PM Awas Yojana (Housing)',
    documents: [
      { name: 'Aadhaar Card', status: 'done' },
      { name: 'Voter ID', status: 'done' },
      { name: 'Income Proof', status: 'pending' }
    ],
    officialLink: 'https://pmaymis.gov.in/'
  },
  'PMSBY': {
    schemeName: 'PM Suraksha Bima Yojana',
    documents: [
      { name: 'Aadhaar Card', status: 'done' },
      { name: 'Bank Account', status: 'done' }
    ],
    officialLink: 'https://www.jansuraksha.gov.in/'
  }
};
