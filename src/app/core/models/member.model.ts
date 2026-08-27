// src/app/core/models/member.model.ts
// In member.model.ts
export interface Member {
  id: string;
  member_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  nationality?: string;
  gender?: string;
  birth_date?: string;
  age?: number;
  registration_date?: string;
  status: string;
  is_child: boolean;
  phone?: string;
  email?: string;
  contact?: any;
  maritalStatus?: string;
  smallTeam?: any; // Existing field
  hyaw_mahider_id?: string; // 🆕 NEW: Add this field
  departments?: any[];
  created_at?: string;
  updated_at?: string;
  role: UserRole;
  firebase_uid?: string;

    // 🆕 NEW: UI state properties
  isUpdating?: boolean;
  isSelected?: boolean;
}
export interface MemberContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface MaritalStatus {
  id: string;
  status: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  spouse_name?: string;
}

export interface SmallTeam {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
}

export type UserRole = 'Admin' | 'Member' | 'Pastor' | 'Deputy Pastor' | 'Zone Coordinator';

export interface MemberFilters {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: 'Male' | 'Female';
  status?: 'active' | 'inactive' | 'suspended';
  is_child?: boolean;
  age_min?: number;
  age_max?: number;
  search?: string;
  // Filter by a specific Hiyaw Mahider (small team) ID
  hiyawMahiderId?: string;
  page?: number;
  pageSize?: number; 
  includes?: string[];
}
