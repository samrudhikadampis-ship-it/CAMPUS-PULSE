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
  registration_open?: number | boolean;
  registration_closes_at?: string | null;
  eligible_dept_id?: string | null;
  registration_question?: string | null;
  links?: EventLink[];
}

export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  dept_id: string | null;
  study_year: 'FE' | 'SE' | 'TE' | 'BE' | null;
  division: string | null;
  phone: string | null;
  email: string | null;
  gender: 'Female' | 'Male' | 'Other' | null;
  dob: string | null;
  is_active?: boolean | number;
  department_verified?: boolean | number;
  reg_count?: number;
  att_count?: number;
}

export interface StudentRegistration {
  reg_id: number;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  dept_id?: string;
  email?: string | null;
  phone?: string | null;
  department_verified?: boolean | number;
  registered_on: string;
  registration_status?: 'Confirmed' | 'Cancelled';
  application_answer?: string | null;
  event_id: number;
  committee_id: string;
  name: string;
  event_status: 'live' | 'up' | 'done';
  payment_id?: number | null;
  pay_status?: string | null;
  amount?: number | null;
  txn_ref?: string | null;
  method?: string | null;
  attendance_id?: number | null;
  check_in?: string | null;
  check_out?: string | null;
  cert_id?: number | null;
  cert_type?: string | null;
  issued_on?: string | null;
  feedback_id?: number | null;
  rating?: number | null;
  comments?: string | null;
}

export interface DeptSummary {
  dept_id: string;
  students: number;
  attended: number;
  certs: number;
}

export interface FeedbackItem {
  feedback_id: number;
  reg_id: number | null;
  student_id: string;
  first_name: string;
  last_name: string;
  committee_id: string;
  committee_name: string;
  event_id: number | null;
  event_name: string | null;
  rating: number;
  comments: string | null;
  submitted_on?: string;
}

export interface CertificateItem {
  cert_id: number;
  reg_id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  dept_id: string;
  study_year: string;
  division: string;
  event_name: string;
  committee_id: string;
  committee_name: string;
  cert_type: string;
  issued_on: string;
}
