
import {
  ForbiddenException,
  UnauthorizedException
} from "@nestjs/common";
import { of } from "rxjs";
import { RealtimeController } from "./realtime.controller";

describe("RealtimeController", () => {
  let controller: RealtimeController;
  let authTokenService: any;
  let prisma: any;
  let realtimeService: any;

  const user = { id: "user-1" };

  beforeEach(() => {
    authTokenService = {
      verify: jest.fn().mockReturnValue({
        sub: "user-1",
        email: "user@example.com"
      })
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user)
      },
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({
          workspaceOwnerId: "user-1",
          userId: "user-1",
          role: "OWNER"
        })
      }
    };

    realtimeService = {
      subscribe: jest.fn().mockReturnValue(
        of({
          type: "connected",
          data: { connected: true }
        })
      )
    };

    controller = new RealtimeController(
      authTokenService,
      prisma,
      realtimeService
    );
  });

  it("should reject requests without an access token", async () => {
    await expect(controller.events()).rejects.toThrow(
      UnauthorizedException
    );

    expect(authTokenService.verify).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("should verify the token and reject a user who no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      controller.events("valid-token")
    ).rejects.toThrow("User no longer exists.");

    expect(authTokenService.verify).toHaveBeenCalledWith("valid-token");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true }
    });

    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it("should reject users who are not members of the requested workspace", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      controller.events("valid-token", "workspace-2")
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: "workspace-2",
          userId: "user-1"
        }
      }
    });

    expect(realtimeService.subscribe).not.toHaveBeenCalled();
  });

  it("should subscribe to the user's own workspace when no workspace is requested", async () => {
    const result = await controller.events("valid-token");

    expect(realtimeService.subscribe).toHaveBeenCalledWith("user-1");
    expect(result).toBeDefined();
  });

  it("should subscribe to the requested workspace after membership verification", async () => {
    const result = await controller.events(
      "valid-token",
      "workspace-2"
    );

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: "workspace-2",
          userId: "user-1"
        }
      }
    });

    expect(realtimeService.subscribe).toHaveBeenCalledWith("workspace-2");
    expect(result).toBeDefined();
  });

  it("should propagate token verification errors", async () => {
    authTokenService.verify.mockImplementation(() => {
      throw new UnauthorizedException("Invalid access token.");
    });

    await expect(
      controller.events("invalid-token")
    ).rejects.toThrow("Invalid access token.");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
