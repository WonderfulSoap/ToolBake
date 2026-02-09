import type { Client } from "~/data/generated-http-client/client";
import { getApiV1User, postApiV1UserCheck, deleteApiV1UserDelete, putApiV1UserInfo, type UserUserInfoResponseDto } from "~/data/generated-http-client";
import type { IUserRepository, UpdateUserInput } from "~/data/interface/i-user-repository";
import type { User } from "~/entity/user";
import type { IAuthHelper } from "~/data/interface/i-auth-helper";
import { httpClient as sharedHttpClient, HttpClient } from "~/data/http-client/http-client";
import { logAndThrow } from "~/lib/utils";

export class HttpUserRepository implements IUserRepository {
  private readonly client    : Client;
  private readonly authHelper: IAuthHelper;

  constructor(authHelper: IAuthHelper, httpClient: HttpClient = sharedHttpClient) {
    this.client = httpClient.client;
    this.authHelper = authHelper;
  }

  /** Fetch current user info based on access token. */
  async getUserInfo(): Promise<User> {
    return this.authHelper.executeWithAccessToken(async (headers) => {
      const response = await getApiV1User({ client: this.client, headers, throwOnError: true });
      const payload = response.data?.data;
      if (!payload) logAndThrow("Invalid user info response.");
      return mapDtoToUser(payload);
    });
  }

  /** Check if a username already exists. No auth required. */
  async checkUsernameExists(username: string): Promise<boolean> {
    const response = await postApiV1UserCheck({ client: this.client, body: { username }, throwOnError: true });
    return response.data?.data?.exists ?? false;
  }

  /** Delete the current authenticated user and all related data. */
  async deleteUser(): Promise<void> {
    return this.authHelper.executeWithAccessToken(async (headers) => {
      await deleteApiV1UserDelete({ client: this.client, headers, throwOnError: true });
    });
  }

  /** Update current user's information. Requires auth. */
  async updateUserInfo(input: UpdateUserInput): Promise<void> {
    return this.authHelper.executeWithAccessToken(async (headers) => {
      await putApiV1UserInfo({ client: this.client, headers, body: { username: input.username }, throwOnError: true });
    });
  }
}

// Map API payload to the internal User entity with trimmed fields.
function mapDtoToUser(payload: UserUserInfoResponseDto): User {
  const id = payload.id?.trim();
  const name = payload.name?.trim();
  if (!id) logAndThrow("User id is required.");
  if (!name) logAndThrow("User name is required.");
  const mail = payload.mail?.trim();
  return { id, name, mail: mail || undefined };
}
