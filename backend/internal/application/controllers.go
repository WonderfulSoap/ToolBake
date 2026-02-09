package application

import (
	"ya-tool-craft/internal/application/controller/auth"
	"ya-tool-craft/internal/application/controller/frontend_assets_host"
	"ya-tool-craft/internal/application/controller/global_script"
	"ya-tool-craft/internal/application/controller/healthcheck"
	"ya-tool-craft/internal/application/controller/tools"
	"ya-tool-craft/internal/application/controller/user"
)

func ControllerFactories() []any {
	return []any{
		healthcheck.NewHealthCheckController,
		auth.NewAuthLoginController,
		auth.NewAuthIssueAccessTokenController,
		auth.NewAuthLogoutController,
		auth.NewSSOLoginController,
		auth.NewSSOBindingGetController,
		auth.NewSSOBindingAddController,
		auth.NewSSOBindingDeleteController,
		auth.NewPasskeyRegisterChallengeController,
		auth.NewPasskeyRegisterVerifyController,
		auth.NewPasskeyLoginChallengeController,
		auth.NewPasskeyLoginVerifyController,
		auth.NewPasskeyGetController,
		auth.NewPasskeyDeleteController,
		auth.NewTwoFAGetController,
		auth.NewTwoFADeleteController,
		auth.NewTwoFARetrieveTOTPController,
		auth.NewTwoFATOTPAddController,
		auth.NewTwoFALoginController,
		auth.NewTwoFARecoveryController,
		user.NewCreateUserController,
		user.NewUserInfoController,
		user.NewUpdateUserController,
		user.NewDeleteUserController,
		user.NewCheckUsernameController,
		global_script.NewGetGlobalScriptController,
		global_script.NewUpdateGlobalScriptController,
		tools.NewAllToolsController,
		tools.NewCreateToolController,
		tools.NewUpdateToolController,
		tools.NewDeleteToolController,
		frontend_assets_host.NewFrontendAssetsHostController,
	}
}
