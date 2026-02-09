package client

import (
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"

	"github.com/pkg/errors"
	"resty.dev/v3"
)

func NewGoogleClient(config config.Config) (*GoogleClient, error) {
	return &GoogleClient{
		config: config,
	}, nil
}

type GoogleClient struct {
	config config.Config
}

type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
	IDToken      string `json:"id_token"`
}

type GoogleTokenErrorResponse struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

func (c *GoogleClient) OauthCodeToAccessToken(oauthCode string) (string, error) {
	clientID := c.config.SSO_GOOGLE_CLIENT_ID
	clientSecret := c.config.SSO_GOOGLE_CLIENT_SECRET
	redirectURI := c.config.SSO_GOOGLE_REDIRECT_URL

	if clientID == "" || clientSecret == "" {
		return "", errors.Errorf("google client id or client secret is empty, please check SSO_GOOGLE_CLIENT_ID and SSO_GOOGLE_CLIENT_SECRET in config")
	}

	if oauthCode == "" {
		return "", errors.New("google oauth code is empty")
	}

	client := resty.New().SetTimeout(10 * time.Second)
	defer client.Close()

	var result GoogleTokenResponse
	var errResult GoogleTokenErrorResponse

	resp, err := client.R().
		SetHeader("Content-Type", "application/x-www-form-urlencoded").
		SetFormData(map[string]string{
			"client_id":     clientID,
			"client_secret": clientSecret,
			"code":          oauthCode,
			"grant_type":    "authorization_code",
			"redirect_uri":  redirectURI,
		}).
		SetResult(&result).
		SetError(&errResult).
		Post("https://www.googleapis.com/oauth2/v4/token")
	if err != nil {
		return "", errors.Wrap(err, "fail to call google oauth endpoint")
	}

	if resp.IsError() {
		respBody := resp.String()
		if errResult.Error != "" {
			return "", error_code.NewErrorWithErrorCode(error_code.OauthTokenUnavailable, "google oauth error: %s (%s), body: %s", errResult.Error, errResult.ErrorDescription, respBody)
		}
		return "", errors.Errorf("google oauth request failed with status: %s, body: %s", resp.Status(), respBody)
	}

	if errResult.Error != "" {
		return "", error_code.NewErrorWithErrorCode(error_code.OauthTokenUnavailable, "google oauth error: %s (%s), body: %s", errResult.Error, errResult.ErrorDescription, resp.String())
	}

	if result.AccessToken == "" {
		return "", errors.New("google oauth response missing access_token")
	}

	return result.AccessToken, nil
}

func (c *GoogleClient) GetUserInfo(accessToken string) (entity.GoogleUserInfoEntity, error) {
	if accessToken == "" {
		return entity.GoogleUserInfoEntity{}, errors.New("google access token is empty")
	}

	var result GoogleUserInfo
	var apiErr struct {
		Error struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}

	client := resty.New().SetTimeout(10 * time.Second)
	defer client.Close()

	resp, err := client.R().
		SetHeader("Accept", "application/json").
		SetAuthToken(accessToken).
		SetResult(&result).
		SetError(&apiErr).
		Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return entity.GoogleUserInfoEntity{}, errors.Wrap(err, "fail to call google userinfo api")
	}

	if resp.IsError() {
		respBody := resp.String()
		if apiErr.Error.Message != "" {
			return entity.GoogleUserInfoEntity{}, errors.Errorf("google userinfo api error: %s, body: %s", apiErr.Error.Message, respBody)
		}
		return entity.GoogleUserInfoEntity{}, errors.Errorf("google userinfo api request failed with status: %s, body: %s", resp.Status(), respBody)
	}

	return entity.NewGoogleUserInfoEntity(
		result.ID,
		result.Email,
		result.VerifiedEmail,
		result.Name,
		result.GivenName,
		result.FamilyName,
		result.Picture,
		result.Locale,
	), nil
}
