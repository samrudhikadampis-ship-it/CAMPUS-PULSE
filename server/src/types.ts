export interface Department {
  dept_id: string;
  name: string;
}

export interface Committee {
  committee_id: string;
  name: string;
  tagline: string | null;
  instagram_handle: string | null;
}

export interface Venue {
  venue_id: string;
  name: string;
}

export interface EventLink {
  link_id: number;
  event_id: number;
  label: string;
  url: string;
}

export interface EventItem {
  event_id: number;
  committee_id: string;
  venue_id: string | null;
  name: string;
  description: string | null;
  start_ts: string | null;
  end_ts: string | null;
  fee: number | null;
  fee_note: string | null;
  audience: string | null;
  prize: string | null;
  contact: string | null;
  status: 'live' | 'up' | 'done';
  venue?: string | null;
  registered?: number;
  capacity?: number | null;
  remaining?: number | null;
  registration_open?: boolean | number;
  registration_closes_at?: string | null;
  eligible_dept_id?: string | null;
  registration_question?: string | null;
  links?: EventLink[];
}

export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  dept_id: string;
  study_year: 'FE' | 'SE' | 'TE' | 'BE';
  division: string;
  phone: string | null;
  email: string | null;
  gender: 'Female' | 'Male' | 'Other' | null;
  dob: string | null;
  is_active?: boolean | number;
  department_verified?: boolean | number;
}

export interface Registration {
  reg_id: number;
  student_id: string;
  event_id: number;
  registered_on: string;
  status: 'Confirmed' | 'Cancelled';
  name?: string;
  event_status?: 'live' | 'up' | 'done';
  pay_status?: string | null;
  amount?: number | null;
  check_in?: string | null;
  check_out?: string | null;
  cert_id?: number | null;
  rating?: number | null;
}

export interface Payment {
  payment_id: number;
  reg_id: number;
  txn_ref: string;
  method: 'UPI' | 'Card' | 'Cash';
  amount: number;
  status: 'Submitted' | 'Verified' | 'Rejected';
  paid_on: string;
}

export interface Attendance {
  attendance_id: number;
  reg_id: number;
  status: 'Present';
  check_in: string;
  check_out: string | null;
}

export interface Certificate {
  cert_id: number;
  reg_id: number;
  cert_type: string;
  issued_on: string;
}

export interface Feedback {
  feedback_id: number;
  reg_id: number;
  rating: number;
  comments: string | null;
  submitted_on: string;
}

export interface DeptSummary {
  dept_id: string;
  students: number;
  attended: number;
  certs: number;
}
