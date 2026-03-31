export type UserRole = 'admin' | 'user'
export type ScopeFilter = 'all' | 'mine' | 'shared'

export interface AuthUser {
  id?: string
  username: string
  role: UserRole
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresInSeconds?: number
  user: AuthUser
}

export interface StoredAuthSession {
  accessToken: string
  refreshToken: string
  user: AuthUser | null
}

export interface Category {
  id: string
  name: string
  created_at: string | null
  archived_at: string | null
}

export interface PoiShare {
  id: string
  shared_with_user_id: string
  username: string
  created_at: string | null
  archived_at: string | null
}

export interface PoiPhoto {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string | null
  archived_at: string | null
}

export interface PoiListItem {
  id: string
  owner_user_id: string
  owner_username: string
  name: string
  description: string
  category_id: string
  category: string
  lat: number | string
  lng: number | string
  is_public: boolean | number
  created_at: string | null
  updated_at: string | null
  archived_at: string | null
  owned_by_me: boolean | number
  shared_with_me: boolean | number
}

export interface PoiDetail extends PoiListItem {
  photos: PoiPhoto[]
  shares: PoiShare[]
  canShare: boolean
  canEdit: boolean
}

export interface UserListItem {
  id: string
  username: string
  role: UserRole
  created_at: string | null
  archived_at: string | null
}
