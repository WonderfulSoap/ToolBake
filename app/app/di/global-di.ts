import type { IToolRepository } from "../data/interface/i-tool-repository";
import type { ITokenLocalStorageRepository } from "../data/interface/i-token-local-storage-repository";
import { TokenLocalStorageRepository } from "../data/repository/token-local-storage-repository-impl";
import { HttpToolRepository } from "../data/repository/tool-repository-http-impl";
import { LocalToolRepository } from "../data/repository/tool-repository-local-storage-impl";
import type { IAuthRepository } from "../data/interface/i-auth-repository";
import { HttpAuthRepository } from "../data/repository/auth-repository-http-impl";
import type { IAuthHelper } from "../data/interface/i-auth-helper";
import { AuthHelper } from "../data/repository/auth-helper";
import type { IUserRepository } from "../data/interface/i-user-repository";
import { HttpUserRepository } from "../data/repository/user-repository-http-impl";
import { ToolSandboxRequirePackage } from "~/components/tool/tool-sandbox-require-package";
import { SettingLocalStorageRepository } from "~/data/repository/setting-local-storage-repository-impl";
import type { ISettingRepository } from "~/data/interface/i-setting-repository";


export class GlobalDI {
  public httpToolRepository : IToolRepository;
  public localToolRepository: IToolRepository;
  
  public tokenRepository: ITokenLocalStorageRepository;
  public authRepository : IAuthRepository;
  public authHelper     : IAuthHelper;
  public userRepository : IUserRepository;

  public toolSandboxRequirePackage: ToolSandboxRequirePackage;

  public localStorageSettingsRepository: ISettingRepository;

  constructor() {
    this.tokenRepository = new TokenLocalStorageRepository();
    // Wire auth helper into auth repository so it can resolve access tokens internally.
    const authRepository = new HttpAuthRepository();
    this.authRepository = authRepository;
    this.authHelper = new AuthHelper(authRepository, this.tokenRepository);
    authRepository.setAuthHelper(this.authHelper);
    this.userRepository = new HttpUserRepository(this.authHelper);

    this.httpToolRepository = new HttpToolRepository(this.authHelper);
    this.localToolRepository = new LocalToolRepository();

    this.toolSandboxRequirePackage = new ToolSandboxRequirePackage();

    this.localStorageSettingsRepository = new SettingLocalStorageRepository();
  }

  get toolRepository(): IToolRepository {
    const mode = this.authHelper.getMode();
    if (mode === "logined") {
      return this.httpToolRepository;
    }else{
      return this.localToolRepository;
    }
  }

  get settingRepository(): ISettingRepository {
    // todo: if plan to sync settings to server in future, change implementation here
    return this.localStorageSettingsRepository;
  }
}


export const globalDI = new GlobalDI();
