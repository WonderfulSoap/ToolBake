import type { User } from "~/entity/user";

/** Input for updating user information. */
export interface UpdateUserInput {
  username?: string;
}

export interface IUserRepository {
  /** Fetch current user info based on access token. */
  getUserInfo(): Promise<User>;

  /** Create a new user account with username and password. */
  createUser(username: string, password: string): Promise<void>;

  /** Check if a username already exists. */
  checkUsernameExists(username: string): Promise<boolean>;

  /** Delete the current authenticated user and all related data. */
  deleteUser(): Promise<void>;

  /** Update current user's information. Only provided fields will be updated. */
  updateUserInfo(input: UpdateUserInput): Promise<void>;
}
