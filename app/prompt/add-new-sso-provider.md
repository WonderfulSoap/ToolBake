# Checklist for Adding a New SSO Provider

This guide documents the changes required to add a new SSO provider (e.g., Google, Microsoft, etc.).

## Runtime Configuration

- Add the provider configuration under `public/ssr-config.js`. This configuration is read by the React dev server and is used for the development environment.
- Required fields:
  - `client_id`
  - `redirect_uri`

Example:

```js
sso: {
  github: {
    client_id: "...",
    redirect_uri: "..."
  },
}
```

## Login UI (LoginDialog)

File: `app/components/layout/login-dialog.tsx`

- Read the provider configuration from `__SSR_CONFIG__`.
- Add a `canUseXxxSso` flag (based on whether `client_id` exists).
- Add a function to build the provider's authorize URL.
- Add click handling:
  - Generate a state value
  - Write the state to `localStorage` (using a provider-specific key)
  - Redirect to the provider's authorize URL
- Only display the login button when `client_id` is present.

## OAuth Callback Page

File: `app/routes/sso-github-callback-page.tsx`

- Extend the `SsoProvider` union type.
- Update the following functions:
  - `normalizeProvider`
  - `getProviderLabel`
  - `getSsoStateStorageKey`
  - `loginWithProvider`

Notes:
- Each provider's state key must be unique, e.g., `YA_SSO_GOOGLE_STATE`.
- Callback routes are shared: `/sso/:provider/callback`.

## Auth Helper Interface and Implementation

Files:
- `app/data/interface/i-auth-helper.ts`
- `app/data/repository/auth-helper.ts`

Add and implement the new method:

```ts
loginWithXxxSso(oauthCode: string): Promise<void>
```

The implementation should call the repository method and persist the access/refresh token.

## Auth Repository Interface and HTTP Implementation

Files:
- `app/data/interface/i-auth-repository.ts`
- `app/data/repository/auth-repository-http-impl.ts`

Add the new method:

```ts
loginWithXxxSso(oauthCode: string): Promise<{ accessToken: AccessToken; refreshToken: RefreshToken }>
```

The implementation should:
- Trim the OAuth code and validate it is not empty
- Call the swagger client `postApiV1AuthSsoXxx`
- Validate the response payload
- Return `AccessToken` + `RefreshToken`

## Swagger Generated Client

- Confirm the swagger definition for `/api/v1/auth/sso/{provider}`.
- Regenerate `app/data/generated-http-client` if necessary.
- Use:
  - `postApiV1AuthSsoXxx`
  - `postApiV1AuthSsoXxxResponseTransformer`

## Testing

File: `app/data/repository/auth-repository-http-impl.test.ts`

Add test cases for the new provider:
- Successful response
- Missing OAuth code
- Invalid response payload

Also update any test stubs that reference `IAuthRepository` (e.g., `app/data/repository/auth-helper.test.ts`) to include the new method.

## Optional: Copy and Interaction

- Update the login dialog copy if needed.
- Keep the provider name consistent with the brand.

---

Quick checklist:
- [ ] Add provider configuration in `ssr-config.js`
- [ ] LoginDialog: read config + authorize URL + state key + login button
- [ ] Callback page: provider recognition + label + state key + login call
- [ ] Auth helper interface + implementation
- [ ] Auth repository interface + HTTP implementation
- [ ] Swagger client exists
- [ ] Tests updated
