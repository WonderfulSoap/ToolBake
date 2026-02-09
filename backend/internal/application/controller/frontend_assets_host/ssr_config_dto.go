package frontend_assets_host

import "ya-tool-craft/internal/domain/entity"

type ssrConfigDTO struct {
	SSO struct {
		Github struct {
			ClientID    string `json:"client_id"`
			RedirectURI string `json:"redirect_uri"`
		} `json:"github"`
		Google struct {
			ClientID    string `json:"client_id"`
			RedirectURI string `json:"redirect_uri"`
		} `json:"google"`
	} `json:"sso"`
	EnablePasswordLogin bool `json:"enable_password_login"`
}

func (d *ssrConfigDTO) FromEntity(cfg entity.FrontendRuntimeConfigEntity) {
	d.SSO.Github.ClientID = cfg.SSO.Github.ClientID
	d.SSO.Github.RedirectURI = cfg.SSO.Github.RedirectURI
	d.SSO.Google.ClientID = cfg.SSO.Google.ClientID
	d.SSO.Google.RedirectURI = cfg.SSO.Google.RedirectURI
	d.EnablePasswordLogin = cfg.EnablePasswordLogin
}
