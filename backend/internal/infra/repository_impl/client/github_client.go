package client

import (
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/error_code"

	"github.com/pkg/errors"
	_ "modernc.org/sqlite"
	"resty.dev/v3"
)

func NewGithubClient(config config.Config) (*GithubClient, error) {
	return &GithubClient{
		config: config,
	}, nil
}

type GithubClient struct {
	config config.Config
}

type GithubUserInfo struct {
	ID        int64   `json:"id"`
	Login     string  `json:"login"`
	Name      string  `json:"name"`
	Email     *string `json:"email"`
	AvatarURL string  `json:"avatar_url"`
}

func (c *GithubClient) OauthTokenToAccessToken(oauthToken string) (string, error) {
	clientID := c.config.SSO_GITHUB_CLIENT_ID
	clientSecret := c.config.SSO_GITHUB_CLIENT_SECRET

	if clientID == "" || clientSecret == "" {
		return "", errors.Errorf("github client id or client secret is empty, please check SSO_GITHUB_CLIENT_ID and SSO_GITHUB_CLIENT_SECRET in config")
	}

	if oauthToken == "" {
		return "", errors.New("github oauth token is empty")
	}

	payload := map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          oauthToken,
	}

	var result struct {
		AccessToken      string `json:"access_token"`
		Scope            string `json:"scope"`
		TokenType        string `json:"token_type"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
		ErrorURI         string `json:"error_uri"`
	}

	client := resty.New().SetTimeout(10 * time.Second)
	defer client.Close()

	resp, err := client.R().
		SetHeader("Accept", "application/json").
		SetHeader("User-Agent", "ya-tool-craft").
		SetBody(payload).
		SetResult(&result).
		Post("https://github.com/login/oauth/access_token")
	if err != nil {
		return "", errors.Wrap(err, "fail to call github oauth endpoint")
	}

	if resp.IsError() {
		respBody := resp.String()
		if result.Error != "" {
			return "", error_code.NewErrorWithErrorCode(error_code.OauthTokenUnavailable, "github oauth error: %s (%s), body: %s", result.Error, result.ErrorDescription, respBody)
		}
		return "", errors.Errorf("github oauth request failed with status: %s, body: %s", resp.Status(), respBody)
	}

	if result.Error != "" {
		return "", error_code.NewErrorWithErrorCode(error_code.OauthTokenUnavailable, "github oauth error: %s (%s), body: %s", result.Error, result.ErrorDescription, resp.String())
	}

	if result.AccessToken == "" {
		return "", errors.New("github oauth response missing access_token")
	}

	return result.AccessToken, nil
}

func (c *GithubClient) GetUserInfo(accessToken string) (entity.GithubUserInfoEntity, error) {
	if accessToken == "" {
		return entity.GithubUserInfoEntity{}, errors.New("github access token is empty")
	}

	var result GithubUserInfo
	var apiErr struct {
		Message string `json:"message"`
	}

	client := resty.New().SetTimeout(10 * time.Second)
	defer client.Close()

	resp, err := client.R().
		SetHeader("Accept", "application/json").
		SetHeader("User-Agent", "ya-tool-craft").
		SetAuthToken(accessToken).
		SetResult(&result).
		SetError(&apiErr).
		Get("https://api.github.com/user")
	if err != nil {
		return entity.GithubUserInfoEntity{}, errors.Wrap(err, "fail to call github user api")
	}

	if resp.IsError() {
		respBody := resp.String()
		if apiErr.Message != "" {
			return entity.GithubUserInfoEntity{}, errors.Errorf("github user api error: %s, body: %s", apiErr.Message, respBody)
		}
		return entity.GithubUserInfoEntity{}, errors.Errorf("github user api request failed with status: %s, body: %s", resp.Status(), respBody)
	}

	return entity.NewGithubUserInfoEntity(
		result.ID,
		result.Login,
		result.Name,
		result.Email,
		result.AvatarURL,
	), nil
}
