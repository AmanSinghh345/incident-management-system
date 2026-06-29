# Implemented Auth API

## What was added

This slice implements the first backend milestone from the Week 1 plan:

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

The API now supports creating a user, hashing the password, returning an access token, logging in with that token, and protecting routes with an auth guard.

## Files to study

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.guard.ts`
- `apps/api/src/modules/auth/auth-token.service.ts`
- `apps/api/src/modules/auth/password.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`

## Request flow

### Register

`POST /auth/register`

Body:

```json
{
  "name": "Aman",
  "email": "aman@example.com",
  "password": "password123"
}
```

Flow:

1. Controller receives the body.
2. `AuthService` validates name, email, and password.
3. Password is hashed by `PasswordService`.
4. User is stored in PostgreSQL through Prisma.
5. `AuthTokenService` signs a token containing the user id, email, and workspace slug.
6. API returns `{ user, accessToken }`.

### Login

`POST /auth/login`

Body:

```json
{
  "email": "aman@example.com",
  "password": "password123"
}
```

Flow:

1. User is found by email.
2. Password is verified against the stored hash.
3. API returns public user data and a fresh access token.

### Current user

`GET /me`

Header:

```text
Authorization: Bearer <accessToken>
```

Flow:

1. `AuthGuard` reads the bearer token.
2. `AuthTokenService` verifies the signature and expiry.
3. Guard loads the user from Prisma.
4. Controller returns `request.user`.

## Design notes

No external auth package was added. Tokens are HMAC-signed using Node's `crypto` module and the `JWT_SECRET` environment variable. Passwords are hashed with PBKDF2 using a random salt.

This is enough for local Week 1 learning and keeps the code explainable. Later, this can be replaced with `@nestjs/jwt`, Passport, refresh tokens, cookie sessions, or OAuth.

## How to test manually

1. Start PostgreSQL.
2. Run Prisma migration/generation if needed.
3. Start the API.
4. Register a user.
5. Copy `accessToken`.
6. Call `/me` with the bearer token.
