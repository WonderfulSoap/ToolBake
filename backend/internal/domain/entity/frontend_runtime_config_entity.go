package entity

type FrontendRuntimeConfigEntity struct {
	SSO struct {
		Github struct {
			ClientID    string
			RedirectURI string
		}
		Google struct {
			ClientID    string
			RedirectURI string
		}
	}
	EnablePasswordLogin bool
	EnableRegister      bool
}
