export enum Role {
  CONTRIBUTOR = "CONTRIBUTOR",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}

// Higher number = more privileges (visitors are unauthenticated and have no role)
export const RoleHierarchy: { [key in Role]: number } = {
  [Role.ADMIN]: 3,
  [Role.MODERATOR]: 2,
  [Role.CONTRIBUTOR]: 1,
};
