import { Injectable } from "@nestjs/common";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

@Injectable()
export class PasswordService {
  hash(password: string) {
    const salt = randomBytes(16).toString("base64url");
    const digest = this.digest(password, salt);

    return `pbkdf2_sha256$100000$${salt}$${digest}`;
  }

  verify(password: string, storedHash: string) {
    const [algorithm, iterations, salt, digest] = storedHash.split("$");

    if (algorithm !== "pbkdf2_sha256" || iterations !== "100000" || !salt || !digest) {
      return false;
    }

    const actual = Buffer.from(this.digest(password, salt), "base64url");
    const expected = Buffer.from(digest, "base64url");

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }

  private digest(password: string, salt: string) {
    return pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64url");
  }
}
