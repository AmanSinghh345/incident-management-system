
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: any;
  let passwordService: any;
  let authTokenService: any;
  let tx: any;

  const user = {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    workspaceSlug: "john-doe",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    passwordHash: "hashed-password"
  };

  beforeEach(() => {
    tx = {
      user: {
        create: jest.fn().mockResolvedValue(user)
      },
      workspaceMember: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn(async (callback) => callback(tx))
    };

    passwordService = {
      hash: jest.fn().mockReturnValue("hashed-password"),
      verify: jest.fn().mockReturnValue(true)
    };

    authTokenService = {
      sign: jest.fn().mockReturnValue("signed-token")
    };

    service = new AuthService(
      prisma,
      passwordService,
      authTokenService
    );
  });

  describe("register", () => {
    it("should register a user, create an owner membership, and return a token", async () => {
      const result = await service.register({
        name: " John Doe ",
        email: " JOHN@EXAMPLE.COM ",
        password: "password123"
      });

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { email: "john@example.com" }
      });

      expect(passwordService.hash).toHaveBeenCalledWith("password123");

      expect(tx.user.create).toHaveBeenCalledWith({
        data: {
          name: "John Doe",
          email: "john@example.com",
          passwordHash: "hashed-password",
          workspaceSlug: "john-doe"
        },
        select: {
          id: true,
          name: true,
          email: true,
          workspaceSlug: true,
          createdAt: true,
          updatedAt: true
        }
      });

      expect(tx.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceOwnerId: "user-1",
          userId: "user-1",
          role: "OWNER"
        }
      });

      expect(authTokenService.sign).toHaveBeenCalledWith({
        sub: "user-1",
        email: "john@example.com",
        workspaceSlug: "john-doe"
      });

      expect(result).toEqual({
        user,
        accessToken: "signed-token"
      });
    });

    it("should reject an empty name", async () => {
      await expect(
        service.register({
          name: " ",
          email: "john@example.com",
          password: "password123"
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject a missing name", async () => {
      await expect(
        service.register({
          email: "john@example.com",
          password: "password123"
        })
      ).rejects.toThrow("name is required.");
    });

    it("should reject an invalid email", async () => {
      await expect(
        service.register({
          name: "John",
          email: "invalid-email",
          password: "password123"
        })
      ).rejects.toThrow("Email must be valid.");
    });

    it("should reject a missing password", async () => {
      await expect(
        service.register({
          name: "John",
          email: "john@example.com"
        })
      ).rejects.toThrow("password is required.");
    });

    it("should reject passwords shorter than 8 characters", async () => {
      await expect(
        service.register({
          name: "John",
          email: "john@example.com",
          password: "short"
        })
      ).rejects.toThrow("Password must be at least 8 characters.");

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should reject an already registered email", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(
        service.register({
          name: "John",
          email: "john@example.com",
          password: "password123"
        })
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should append a suffix when the workspace slug already exists", async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.email) return null;
        if (where.workspaceSlug === "john-doe") return user;
        return null;
      });

      await service.register({
        name: "John Doe",
        email: "john@example.com",
        password: "password123"
      });

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceSlug: "john-doe-2"
          })
        })
      );
    });

    it("should use the email prefix when the name cannot produce a slug", async () => {
      await service.register({
        name: "!!!",
        email: "john@example.com",
        password: "password123"
      });

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceSlug: "john"
          })
        })
      );
    });

    it("should use workspace as the fallback slug when both name and email prefix are unusable", async () => {
      await service.register({
        name: "!!!",
        email: "123@example.com",
        password: "password123"
      });

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceSlug: "123"
          })
        })
      );
    });

    it("should use a timestamp suffix when all 20 workspace slugs are taken", async () => {
      const dateSpy = jest.spyOn(Date, "now").mockReturnValue(123456);

      prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.email) return null;
        return user;
      });

      await service.register({
        name: "John Doe",
        email: "john@example.com",
        password: "password123"
      });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(21);

      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceSlug: "john-doe-123456"
          })
        })
      );

      dateSpy.mockRestore();
    });
  });

  describe("login", () => {
    it("should log in a user with valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login({
        email: " JOHN@EXAMPLE.COM ",
        password: "password123"
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "john@example.com" }
      });

      expect(passwordService.verify).toHaveBeenCalledWith(
        "password123",
        "hashed-password"
      );

      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          workspaceSlug: user.workspaceSlug,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        accessToken: "signed-token"
      });
    });

    it("should reject login when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: "unknown@example.com",
          password: "password123"
        })
      ).rejects.toThrow(UnauthorizedException);

      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it("should reject login when the password is incorrect", async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      passwordService.verify.mockReturnValue(false);

      await expect(
        service.login({
          email: "john@example.com",
          password: "wrong-password"
        })
      ).rejects.toThrow("Invalid email or password.");

      expect(authTokenService.sign).not.toHaveBeenCalled();
    });

    it("should reject login with an invalid email", async () => {
      await expect(
        service.login({
          email: "invalid-email",
          password: "password123"
        })
      ).rejects.toThrow("Email must be valid.");
    });

    it("should reject login with a missing password", async () => {
      await expect(
        service.login({
          email: "john@example.com"
        })
      ).rejects.toThrow("password is required.");
    });
  });
});
