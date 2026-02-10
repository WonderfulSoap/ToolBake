## Response Ending
- End every response with "にゃん"

# Language
Use English for comments and other documentation text by default.

# Project Overview

This is a Golang backend project that follows a DDD layered architecture and uses Gin as the web framework.

# DDD Layered Architecture

The project currently uses a clear DDD layering model. The approximate directories and responsibilities are as follows:

| Layer | Directory | Main Responsibility |
|------|------|----------|
| Application Layer | `internal/application/controller/**` | Exposes HTTP APIs (Gin Handler), handles parameter validation/DTO conversion/domain service invocation/response assembly, and does not contain core business rules. |
| Domain Layer - Entity | `internal/domain/entity/**` | Defines core business objects and domain data structures (such as `UserEntity`, `ToolEntity`, `UserSSOEntity`, etc.). |
| Domain Layer - Repository Interface | `internal/domain/repository/**` | Defines persistence and external capability abstractions required by the domain (such as `IUserRepository`, `IToolRepository`, `IAuthAccessTokenRepository`, etc.). |
| Domain Layer - External Client Interface | `internal/domain/client/**` | Defines external capability abstractions required by domain services (such as `IGithubAuthClient`, `IGoogleAuthClient`) so domain code depends on interfaces instead of infra clients. |
| Domain Layer - Domain Service | `internal/domain/service/**` | Carries core business workflows and rule orchestration (such as authentication, 2FA, and user-related logic), and stays decoupled from infrastructure through repository interfaces. |
| Infrastructure Layer | `internal/infra/repository_impl/**` | Concrete implementations of domain repository interfaces (RDS/Badger/JWT, etc.) and third-party client implementations (GitHub/Google OAuth). |
| Composition/Bootstrap Layer | `internal/di/**`, `internal/core/**`, `main.go` | Dependency injection composition (`dig`), route registration, middleware mounting, configuration loading, database migration, and service startup. |

Additional notes:
- `internal/config/**`: Configuration definitions and loading, used by all layers (especially infrastructure and bootstrap).
- `internal/middleware/**`: Common HTTP middleware, mounted centrally by `core/engine` at runtime.
- Dependency direction follows common DDD constraints: `application -> domain`, `infra -> domain (interfaces)`, with bindings completed in `internal/di/init_di_register.go`.

## Layer Structure and Rules for New Code

### 1) Application Layer (`internal/application/**`)

- Structure:
  - `controller/<module>/`: Organizes controllers and DTOs by business module.
  - `controllers.go`: Aggregates all controller factories.
- Rules for new code:
  - Controllers should only do request parsing, parameter validation, service invocation, and response conversion; do not implement persistence details here.
  - Place request/response objects in module DTO files (such as `xxx_dto.go`) to avoid exposing domain entities directly to the frontend.
  - Implement conversion methods from entity to DTO and from DTO to entity in DTO files, and add them as methods on the corresponding DTO struct (see the implementation in `internal/application/controller/user/user_info_dto.go`).
  - After adding a new controller, register its factory in `internal/application/controllers.go`; otherwise, routes will not be loaded.


### 2) Domain Layer - Entity (`internal/domain/entity/**`)

- Structure:
  - Defines entities by business object (user, tool, auth credentials, SSO user info, etc.).
- Rules for new code:
  - Entities express business semantics and must not depend on infrastructure details such as Gin, database drivers, or HTTP DTOs.
  - Field naming should prioritize business concepts, not table fields or API fields.
  - If a new entity is exposed externally, add DTO mapping in the application layer to keep boundaries clear.

### 3) Domain Layer - Repository Interface (`internal/domain/repository/**`)

- Structure:
  - `i_xxx_repository.go`: Defines domain-side abstraction interfaces.
- Rules for new code:
  - Define interfaces here first, then implement them in infra; domain code must not directly depend on concrete implementations.
  - Method signatures should prioritize domain entities/value objects and avoid exposing database models.
  - After adding interfaces or methods, also add/update mocks accordingly (the project already uses the `go:generate mockgen` convention).

### 4) Domain Layer - Service (`internal/domain/service/**`)

- Structure:
  - Services are grouped by business use cases (Auth, User, 2FA, Passkey, etc.).
- Rules for new code:
  - Put core business rules in services; cross-repository/client orchestration should also be done at this layer.
  - Inject dependencies via constructors (interface-first); do not instantiate repository/client implementations inside methods.
  - Keep error handling aligned with the project error code system, and use `internal/core/logger` for logging.

### 5) Infrastructure Layer (`internal/infra/**`)

- Structure:
  - `repository_impl/`: Repository interface implementations (RDS, Badger, JWT, etc.).
  - `repository_impl/client/`: External service clients (GitHub/Google, etc.).
  - `repository_impl/migration/`: Database migration implementations.
- Rules for new code:
  - Handle SQL, third-party APIs, and cache/storage details only in this layer.
  - Implementations must satisfy domain repository interface contracts; do not force domain code to adapt to infra details.
  - After adding a new implementation, bind it in DI to the corresponding interface (`bind`) or register a concrete client (`provide`).

### 6) Composition and Bootstrap Layer (`internal/di/**`, `internal/core/**`, `main.go`)

- Structure:
  - `di/`: Container initialization and dependency bindings.
  - `core/engine`: Application startup, middleware, and controller route mounting.
- Rules for new code:
  - Register all new dependencies in `internal/di/init_di_register.go`; do not manually `new` them in business code.
  - Use `bind` for interface implementations and `provide` for concrete types to keep injection relationships traceable.
  - Controller routes are assembled automatically by `engine.registerController()`, so avoid scattered manual route registration.

## Global Constraints (Must Follow for New Features)

- Layer boundaries: Reverse dependencies like `domain -> application/infra` are not allowed.
- Single responsibility: Controllers should not contain business rules, repositories should not orchestrate API workflows, and services should not process HTTP details.
- Naming consistency: Keep file names consistent with existing conventions (such as `xxx_controller.go`, `xxx_dto.go`, `i_xxx_repository.go`, `xxx_impl.go`).
- Testability: Prefer interface-based dependency injection, and add unit tests when introducing core logic.


# DI

The project uses `uber-go/dig` for dependency injection. Core files are:
- Container definition: `internal/di/di.go`
- Registration entry: `internal/di/init_di_register.go`
- Startup invocation: `di.InitDI()` in `internal/core/engine/engine.go`

## DI Registration Rules

- `provide(factory)`: Registers a concrete constructor (without binding to an interface).
- `bind(factory, new(SomeInterface))`: Registers an implementation and binds it to an interface (recommended for abstract dependencies such as repositories).
- Controllers are registered in a unified group via `dig.Group("controllers")`, and routes are batch-mounted at runtime by `engine.registerController()`.

## Current Registration Structure (Summary)

1) Configuration  
- `config.NewConfig`
- `config.NewWritableConfig`

2) Infrastructure capabilities  
- Bind `IRdsClient` by `DBType` (duckdb/sqlite)
- Bind repository implementations such as `IMigration`, `IUserRepository`, and `IToolRepository`
- Bind `ICache`, `IAuthRefreshTokenRepository`, etc. by `KeyValueDBType`
- Bind third-party client implementations to domain client interfaces (such as `bind(client.NewGithubClient, new(domain_client.IGithubAuthClient))`)

3) Domain services  
- `service.NewAuthService`
- `service.NewAuthPasskeyService`
- `service.NewUserService`
- `service.NewTwoFaService`

4) Application controllers  
- Declare controller factories in the return list of `ControllerFactories()` in `internal/application/controllers.go`
- Register them in `InitDI()` with `dig.Group("controllers")`

## How to Add a New Dependency (Common Scenarios)

### Add a new repository implementation and inject it into a service
1) Define an interface in `internal/domain/repository/` (if not already present).  
2) Implement its constructor in `internal/infra/repository_impl/`, for example `NewXxxRepositoryImpl(...) *XxxRepositoryImpl`.  
3) In `internal/di/init_di_register.go`, use:
```go
bind(repository_impl.NewXxxRepositoryImpl, new(repository.IXxxRepository))
```
4) Add `repository.IXxxRepository` to the target service constructor parameters, and dig will inject it automatically.

### Add a new third-party client (interface-first, recommended for domain services such as SSO)
1) Define a domain client interface in `internal/domain/client/`, for example `IXxxAuthClient`.  
2) Add `NewXxxClient(config.Config) *XxxClient` in `internal/infra/repository_impl/client/`, and make sure it implements `IXxxAuthClient`.  
3) In `internal/di/init_di_register.go`, use:
```go
bind(client.NewXxxClient, new(domain_client.IXxxAuthClient))
```
4) Declare `domain_client.IXxxAuthClient` in the constructor parameters of the service that needs it.

If a concrete client is only used as a concrete type (not injected behind an interface), you may still use `provide(...)`.

### Add a new controller
1) Add `NewXxxController(...) router.Controller` under `internal/application/controller/...`.  
2) Append `xxx.NewXxxController` to `ControllerFactories()` in `internal/application/controllers.go`.  
3) No manual route registration is needed; `engine.registerController()` will automatically retrieve and register controllers from the DI group.

## Troubleshooting Tips

- If startup reports `failed to provide`/`failed to bind`, first verify that all constructor parameters are already registered in the container.  
- If a controller is not effective, first check whether it was added to `ControllerFactories()`.  
- If interface injection fails, check whether you used `bind(..., new(Interface))` rather than `provide(...)`.


# swagger
Swagger documentation is generated by the `swag` tool, which automatically generates corresponding Swagger APIs based on annotations in each controller.

Run `task swag-generate` to generate Swagger docs.

Run `task swag-fmt` to format Swagger annotations in controller files.

# SSO Authentication
GitHub SSO and Google SSO are currently supported. Related capabilities are concentrated in the following parts. Future SSO providers can be integrated by following the same pattern:

## Data Model
- Table: `user_sso`
  - Fields: `user_id`, `provider`, `provider_user_id`, `provider_username`, `provider_email`, `created_at`, `updated_at`
  - Constraints:
    - `provider + provider_user_id` is unique
    - `user_id + provider` is unique
  - Migration location: `internal/infra/repository_impl/migration/rds_migratoin_impl.go`

## Repository
- Interface: `internal/domain/repository/i_user_repository.go`
  - `CreateUserBySSO`: Creates a user and binds SSO (username comes from `provider_username`; if empty, a random one is generated)
  - `GetUserBySSO`: Retrieves a user by `provider + provider_user_id` (internally uses `GetByID`)
  - `GetUserSSOBindings`: Retrieves all SSO bindings of a user
- Implementation: `internal/infra/repository_impl/user_repository_rds_impl.go`

## GitHub Client
- File: `internal/infra/repository_impl/client/github_client.go`
  - `OauthTokenToAccessToken`: Exchanges an OAuth code for an access token (throws `OauthTokenUnavailable` on error)
  - `GetUserInfo`: Retrieves GitHub user info via access token
  - Return entity: `internal/domain/entity/github_user_info_entity.go`

## Google Client
- File: `internal/infra/repository_impl/client/google_client.go`
  - `OauthCodeToAccessToken`: Exchanges an OAuth code for an access token (throws `OauthTokenUnavailable` on error)
    - POST to `https://www.googleapis.com/oauth2/v4/token`
  - `GetUserInfo`: Retrieves Google user info via access token
    - GET `https://www.googleapis.com/oauth2/v2/userinfo`
  - Return entity: `internal/domain/entity/google_user_info_entity.go`

## Service & Controller
- Service: `internal/domain/service/auth_service.go` injects `domain_client.IGithubAuthClient` and `domain_client.IGoogleAuthClient` (implemented by infra clients)
- Controller: `internal/application/controller/auth/auth_sso_login_controller.go`
  - Route: `POST /api/v1/auth/sso/:provider` (`provider` currently supports `github` and `google`)
  - Request DTO: `SSOLoginRequestDto` (`oauth_code`)

## Notes for Extending New SSO Providers
1) Add environment variable configuration for the new provider in `internal/config/config.go` (CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)
2) Create a new provider client under `internal/infra/repository_impl/client/` by following `GithubClient`/`GoogleClient`
3) Create the corresponding user info entity (`internal/domain/entity/xxx_user_info_entity.go`)
4) Define the corresponding domain client interface in `internal/domain/client/` (or extend an existing one), and make the infra client implement it
5) Register the new client in `internal/di/init_di_register.go` using interface binding (`bind(client.NewXxxClient, new(domain_client.IXxxAuthClient))`)
6) Inject the domain client interface in `internal/domain/service/auth_service.go`, and add provider handling logic in the switch of the private method `getSSOProviderUserInfo`
7) Update provider support description/validation in `internal/application/controller/auth/auth_sso_login_controller.go` (the route itself is already dynamic: `/api/v1/auth/sso/:provider`)
8) Update frontend runtime config (`__SSR_CONFIG__`), and pass SSO config to the frontend according to the "Steps to Add a New Config Item" section below (the file to modify is `internal/application/controller/frontend_assets_host/ssr_config_dto.go`)

# __SSR_CONFIG__ Frontend Runtime Configuration

`__SSR_CONFIG__` is a mechanism for backend-injected frontend runtime configuration, used to pass server-side environment variables to the frontend app.

## How It Works

1. The frontend HTML contains a placeholder:
   ```html
   <script id="__SSR_CONFIG__" data-runtime-config-anchor="true"></script>
   ```

2. When returning HTML, the backend replaces the placeholder with a script containing config:
   ```html
   <script id="__SSR_CONFIG__">window.__SSR_CONFIG__ = {"sso":{"github":{...}},"enable_password_login":true};</script>
   ```

3. The frontend accesses configuration via `window.__SSR_CONFIG__`

## Related Files

| File | Description |
|------|------|
| `internal/config/config.go` | Defines environment variable config (such as `ENABLE_PASSWORD_LOGIN`) |
| `internal/domain/entity/frontend_runtime_config_entity.go` | Frontend runtime config entity |
| `internal/application/controller/frontend_assets_host/ssr_config_dto.go` | DTO definitions and JSON serialization field names |
| `internal/application/controller/frontend_assets_host/frontend_assets_host.go` | Config injection logic (method `buildRuntimeConfigScript`) |

## Steps to Add a New Config Item

1. **config.go**: Add an environment variable field
   ```go
   NEW_CONFIG bool `env:"NEW_CONFIG" envDefault:"false"`
   ```

2. **frontend_runtime_config_entity.go**: Add an entity field
   ```go
   NewConfig bool
   ```

3. **ssr_config_dto.go**: Add DTO field and mapping
   ```go
   // In struct
   NewConfig bool `json:"new_config"`

   // In FromEntity method
   d.NewConfig = cfg.NewConfig
   ```

4. **frontend_assets_host.go**: Assign value in `buildRuntimeConfigScript`
   ```go
   runtimeConfig.NewConfig = c.Config.NEW_CONFIG
   ```

## Currently Supported Config Items

| Config Item | Env Var | JSON Key | Description |
|--------|----------|----------|------|
| GitHub SSO Client ID | `SSO_GITHUB_CLIENT_ID` | `sso.github.client_id` | GitHub OAuth client ID |
| GitHub SSO Redirect URI | `SSO_GITHUB_REDIRECT_URL` | `sso.github.redirect_uri` | GitHub OAuth callback URL |
| Google SSO Client ID | `SSO_GOOGLE_CLIENT_ID` | `sso.google.client_id` | Google OAuth client ID |
| Google SSO Redirect URI | `SSO_GOOGLE_REDIRECT_URL` | `sso.google.redirect_uri` | Google OAuth callback URL |
| Enable password login | `ENABLE_PASSWORD_LOGIN` | `enable_password_login` | Whether password login is enabled |
