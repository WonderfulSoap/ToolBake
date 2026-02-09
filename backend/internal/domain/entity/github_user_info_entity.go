package entity

type GithubUserInfoEntity struct {
	ID        int64
	Login     string
	Name      string
	Email     *string
	AvatarURL string
}

func NewGithubUserInfoEntity(id int64, login string, name string, email *string, avatarURL string) GithubUserInfoEntity {
	return GithubUserInfoEntity{
		ID:        id,
		Login:     login,
		Name:      name,
		Email:     email,
		AvatarURL: avatarURL,
	}
}
