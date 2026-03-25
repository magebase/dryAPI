export type SocialProvider = "google" | "github"

type SocialSignInRequestBodyInput = {
  provider: SocialProvider
  callbackURL: string
  errorCallbackURL?: string
  newUserCallbackURL?: string
  requestSignUp?: boolean
}

export type SocialSignInRequestBody = SocialSignInRequestBodyInput & {
  disableRedirect: true
}

export function buildSocialSignInRequestBody(
  input: SocialSignInRequestBodyInput,
): SocialSignInRequestBody {
  return {
    ...input,
    disableRedirect: true,
  }
}