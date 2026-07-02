import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "./auth-token.service";
import { PasswordService } from "./password.service";

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly authTokenService: AuthTokenService
  ) {}

  async register(body: RegisterBody) {
    const name = this.readRequiredString(body.name, "name");
    const email = this.normalizeEmail(body.email);
    const password = this.readRequiredString(body.password, "password");

    if (password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters.");
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const user = await this.prisma.$transaction(async (prisma) => {
      const createdUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: this.passwordService.hash(password),
          workspaceSlug: await this.createWorkspaceSlug(name, email)
        },
        select: this.publicUserSelect()
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceOwnerId: createdUser.id,
          userId: createdUser.id,
          role: "OWNER"
        }
      });

      return createdUser;
    });

    return {
      user,
      accessToken: this.authTokenService.sign({
        sub: user.id,
        email: user.email,
        workspaceSlug: user.workspaceSlug
      })
    };
  }

  async login(body: LoginBody) {
    const email = this.normalizeEmail(body.email);
    const password = this.readRequiredString(body.password, "password");
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !this.passwordService.verify(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        workspaceSlug: user.workspaceSlug,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      accessToken: this.authTokenService.sign({
        sub: user.id,
        email: user.email,
        workspaceSlug: user.workspaceSlug
      })
    };
  }

  private async createWorkspaceSlug(name: string, email: string) {
    const base = this.slugify(name) || this.slugify(email.split("@")[0]) || "workspace";

    for (let index = 0; index < 20; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.user.findUnique({
        where: { workspaceSlug: slug }
      });

      if (!existing) {
        return slug;
      }
    }

    return `${base}-${Date.now()}`;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private normalizeEmail(value: unknown) {
    const email = this.readRequiredString(value, "email").toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Email must be valid.");
    }

    return email;
  }

  private readRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private publicUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      workspaceSlug: true,
      createdAt: true,
      updatedAt: true
    };
  }
}
