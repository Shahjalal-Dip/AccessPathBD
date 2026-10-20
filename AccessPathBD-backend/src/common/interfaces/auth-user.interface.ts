export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  roles: string[];
  /** JWT id and expiry (seconds since epoch); used for logout blacklisting */
  jti?: string;
  exp?: number;
}
