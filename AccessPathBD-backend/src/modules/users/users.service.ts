import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "@/modules/users/entities/user.entity";
import { Role } from "@/common/enums/role.enum";
import { AuditService } from "@/modules/audit/audit.service";
import {
  Paginated,
  paginated,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { ListUsersQueryDto } from "@/modules/users/dto/user-admin.dto";

export type PublicUser = Pick<
  User,
  | "id"
  | "fullName"
  | "email"
  | "role"
  | "isActive"
  | "createdAt"
  | "emailVerifiedAt"
  | "affiliation"
  | "institution"
  | "phone"
  | "preferredLanguage"
  | "textSize"
  | "highContrast"
  | "reduceMotion"
>;

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  emailVerifiedAt: u.emailVerifiedAt,
  affiliation: u.affiliation,
  institution: u.institution,
  phone: u.phone,
  preferredLanguage: u.preferredLanguage,
  textSize: u.textSize,
  highContrast: u.highContrast,
  reduceMotion: u.reduceMotion,
});

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Includes the password hash. Only the login flow should call this. */
  findForLogin(email: string) {
    return this.users
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.email = :email", { email: email.toLowerCase() })
      .getOne();
  }

  /** Includes the password hash. Only password-change flows should call this. */
  findForPassword(id: string) {
    return this.users
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.id = :id", { id })
      .getOne();
  }

  async setPasswordHash(id: string, passwordHash: string) {
    await this.users.update({ id }, { passwordHash });
  }

  async markEmailVerified(id: string) {
    await this.users.update({ id }, { emailVerifiedAt: new Date() });
  }

  async updateProfile(id: string, patch: Partial<User>) {
    const user = await this.mustFind(id);
    Object.assign(user, patch);
    await this.users.save(user);
    return toPublicUser(user);
  }

  async createContributor(data: {
    fullName: string;
    email: string;
    passwordHash: string;
    affiliation?: string | null;
  }) {
    if (await this.findByEmail(data.email))
      throw new ConflictException("An account with this email already exists");
    try {
      // role is always CONTRIBUTOR here: clients can never choose their role
      return await this.users.save(
        this.users.create({ ...data, role: Role.CONTRIBUTOR }),
      );
    } catch (e: any) {
      if (e?.code === "23505")
        throw new ConflictException(
          "An account with this email already exists",
        );
      throw e;
    }
  }

  async list(q: ListUsersQueryDto): Promise<Paginated<PublicUser>> {
    const qb = this.users
      .createQueryBuilder("u")
      .orderBy("u.createdAt", "DESC");
    if (q.role) qb.andWhere("u.role = :role", { role: q.role });
    if (q.search) {
      const s = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
      qb.andWhere("(u.fullName ILIKE :s OR u.email ILIKE :s)", { s });
    }
    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();
    return paginated(rows.map(toPublicUser), total, q);
  }

  async changeRole(actorId: string, targetId: string, role: Role) {
    if (actorId === targetId)
      throw new BadRequestException("You cannot change your own role");
    const user = await this.mustFind(targetId);
    const previous = user.role;
    user.role = role;
    await this.users.save(user);
    await this.audit.log({
      actorUserId: actorId,
      action: "USER_ROLE_CHANGED",
      entityType: "user",
      entityId: targetId,
      metadata: { from: previous, to: role },
    });
    return toPublicUser(user);
  }

  async setActive(actorId: string, targetId: string, isActive: boolean) {
    if (actorId === targetId)
      throw new BadRequestException("You cannot deactivate your own account");
    const user = await this.mustFind(targetId);
    user.isActive = isActive;
    await this.users.save(user);
    await this.audit.log({
      actorUserId: actorId,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "user",
      entityId: targetId,
    });
    return toPublicUser(user);
  }

  private async mustFind(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }
}
