import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  workspaceSlug: string;
}

interface SignedPayload extends AuthTokenPayload {
  exp: number;
}

@Injectable()
export class AuthTokenService {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: AuthTokenPayload) {
    const expiresInSeconds = 60 * 60 * 24;
    const signedPayload: SignedPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds
    };
    const encodedPayload = this.encodeJson(signedPayload);
    const signature = this.signValue(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  verify(token: string): AuthTokenPayload {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid access token.");
    }

    const expectedSignature = this.signValue(encodedPayload);

    if (!this.secureEqual(signature, expectedSignature)) {
      throw new UnauthorizedException("Invalid access token.");
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SignedPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Access token has expired.");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      workspaceSlug: payload.workspaceSlug
    };
  }

  private encodeJson(value: unknown) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  private signValue(value: string) {
    return createHmac("sha256", this.secret()).update(value).digest("base64url");
  }

  private secret() {
    return this.configService.get<string>("JWT_SECRET") ?? "change-this-in-development";
  }

  private secureEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
