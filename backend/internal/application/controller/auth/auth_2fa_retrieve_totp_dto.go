package auth

type TwoFARetrieveTOTPResponseDto struct {
	Token  string `json:"token"` // token for verification
	Secret string `json:"secret"`
	URL    string `json:"url"`
	QRCode string `json:"qr_code"` // base64 encoded PNG image
}
