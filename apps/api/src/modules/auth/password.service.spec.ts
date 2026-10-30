
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it("should generate a password hash in the expected format", () => {
    const hash = service.hash("password123");

    const parts = hash.split("$");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2_sha256");
    expect(parts[1]).toBe("100000");
    expect(parts[2]).toBeTruthy();
    expect(parts[3]).toBeTruthy();
  });

  it("should generate different hashes for the same password because of random salts", () => {
    const firstHash = service.hash("password123");
    const secondHash = service.hash("password123");

    expect(firstHash).not.toBe(secondHash);
  });

  it("should verify a correct password", () => {
    const hash = service.hash("password123");

    expect(service.verify("password123", hash)).toBe(true);
  });

  it("should reject an incorrect password", () => {
    const hash = service.hash("password123");

    expect(service.verify("wrong-password", hash)).toBe(false);
  });

  it("should reject an unsupported hashing algorithm", () => {
    expect(
      service.verify("password123", "bcrypt$100000$salt$digest")
    ).toBe(false);
  });

  it("should reject an incorrect iteration count", () => {
    expect(
      service.verify("password123", "pbkdf2_sha256$50000$salt$digest")
    ).toBe(false);
  });

  it("should reject a hash with a missing salt", () => {
    expect(
      service.verify("password123", "pbkdf2_sha256$100000$$digest")
    ).toBe(false);
  });

  it("should reject a hash with a missing digest", () => {
    expect(
      service.verify("password123", "pbkdf2_sha256$100000$salt$")
    ).toBe(false);
  });

  it("should reject a hash with an incorrect digest length", () => {
    expect(
      service.verify("password123", "pbkdf2_sha256$100000$salt$abc")
    ).toBe(false);
  });
});
