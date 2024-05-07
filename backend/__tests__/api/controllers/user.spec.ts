import request from "supertest";
import app from "../../../src/app";
import * as Configuration from "../../../src/init/configuration";

import { getCurrentTestActivity } from "../../../src/api/controllers/user";
import * as UserDal from "../../../src/dal/user";
import _ from "lodash";
import * as AuthUtils from "../../../src/utils/auth";
import * as AdminUuids from "../../../src/dal/admin-uids";
import * as BlocklistDal from "../../../src/dal/blocklist";
import GeorgeQueue from "../../../src/queues/george-queue";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";

const mockApp = request(app);
const configuration = Configuration.getCachedConfiguration();

const mockDecodedToken: DecodedIdToken = {
  uid: "uid",
  email: "newuser@mail.com",
  iat: 0,
} as DecodedIdToken;

describe("user controller test", () => {
  describe("user creation flow", () => {
    const blocklistContainsMock = vi.spyOn(BlocklistDal, "contains");
    beforeEach(async () => {
      await enableSignup(true);
    });
    afterEach(() => {
      blocklistContainsMock.mockReset();
    });

    it("should be able to check name, sign up, and get user data", async () => {
      await mockApp
        .get("/users/checkName/NewUser")
        .set({
          Accept: "application/json",
        })
        .expect(200);

      const newUser = {
        name: "NewUser",
        uid: "123456789",
        email: "newuser@mail.com",
        captcha: "captcha",
      };

      await mockApp
        .post("/users/signup")
        .set("authorization", "Uid 123456789|newuser@mail.com")
        .send(newUser)
        .set({
          Accept: "application/json",
        })
        .expect(200);

      const response = await mockApp
        .get("/users")
        .set("authorization", "Uid 123456789")
        .send()
        .set({
          Accept: "application/json",
        })
        .expect(200);

      const {
        body: { data: userData },
      } = response;

      expect(userData.name).toBe(newUser.name);
      expect(userData.email).toBe(newUser.email);
      expect(userData.uid).toBe(newUser.uid);

      await mockApp
        .get("/users/checkName/NewUser")
        .set({
          Accept: "application/json",
        })
        .expect(409);
    });
    it("should not create user if blocklisted", async () => {
      //GIVEN
      blocklistContainsMock.mockResolvedValue(true);
      const newUser = {
        name: "NewUser",
        uid: "123456789",
        email: "newuser@mail.com",
        captcha: "captcha",
      };

      //WHEN

      const result = await mockApp
        .post("/users/signup")
        .set("authorization", "Uid 123456789|newuser@mail.com")
        .send(newUser)
        .set({
          Accept: "application/json",
        })
        .expect(409);
      expect(result.body.message).toEqual("Username or email blocked");
      expect(blocklistContainsMock).toHaveBeenCalledWith({
        name: "NewUser",
        email: "newuser@mail.com",
      });
    });
  });

  describe("toggle ban", () => {
    const getUserMock = vi.spyOn(UserDal, "getUser");
    const setBannedMock = vi.spyOn(UserDal, "setBanned");
    const georgeUserBannedMock = vi.spyOn(GeorgeQueue, "userBanned");
    const isAdminMock = vi.spyOn(AdminUuids, "isAdmin");
    const blocklistAddMock = vi.spyOn(BlocklistDal, "add");
    const blocklistRemoveMock = vi.spyOn(BlocklistDal, "remove");

    beforeEach(async () => {
      await enableAdminFeatures(true);
      vi.spyOn(AuthUtils, "verifyIdToken").mockResolvedValue(mockDecodedToken);
      isAdminMock.mockResolvedValue(true);
    });
    afterEach(() => {
      [
        getUserMock,
        setBannedMock,
        georgeUserBannedMock,
        isAdminMock,
        blocklistAddMock,
        blocklistRemoveMock,
      ].forEach((it) => it.mockReset());
    });

    it("bans user with discord", async () => {
      //GIVEN
      const uid = "myUid";
      const user = {
        uid,
        name: "name",
        email: "email",
        discordId: "discordId",
      } as unknown as MonkeyTypes.DBUser;
      getUserMock.mockResolvedValue(user);

      //WHEN
      await mockApp
        .post("/admin/toggleBan")
        .set("Authorization", "Bearer 123456789")
        .send({ uid })
        .set({
          Accept: "application/json",
        })
        .expect(200);

      //THEN
      expect(getUserMock).toHaveBeenLastCalledWith(uid, "toggle ban");
      expect(setBannedMock).toHaveBeenCalledWith(uid, true);
      expect(georgeUserBannedMock).toHaveBeenCalledWith("discordId", true);
      expect(blocklistAddMock).toHaveBeenCalledWith(user);
      expect(blocklistRemoveMock).not.toHaveBeenCalled();
    });
    it("bans user without discord", async () => {
      //GIVEN
      const uid = "myUid";
      const user = {
        uid,
        name: "name",
        email: "email",
        discordId: "",
      } as unknown as MonkeyTypes.DBUser;
      getUserMock.mockResolvedValue(user);

      //WHEN
      await mockApp
        .post("/admin/toggleBan")
        .set("Authorization", "Bearer 123456789")
        .send({ uid })
        .set({
          Accept: "application/json",
        })
        .expect(200);

      //THEN
      expect(georgeUserBannedMock).not.toHaveBeenCalled();
    });
    it("unbans user with discord", async () => {
      //GIVEN
      const uid = "myUid";

      const user = {
        uid,
        name: "name",
        email: "email",
        discordId: "discordId",
        banned: true,
      } as unknown as MonkeyTypes.DBUser;
      getUserMock.mockResolvedValue(user);

      //WHEN
      await mockApp
        .post("/admin/toggleBan")
        .set("Authorization", "Bearer 123456789")
        .send({ uid })
        .set({
          Accept: "application/json",
        })
        .expect(200);

      //THEN
      expect(getUserMock).toHaveBeenLastCalledWith(uid, "toggle ban");
      expect(setBannedMock).toHaveBeenCalledWith(uid, false);
      expect(georgeUserBannedMock).toHaveBeenCalledWith("discordId", false);
      expect(blocklistRemoveMock).toHaveBeenCalledWith(user);
      expect(blocklistAddMock).not.toHaveBeenCalled();
    });
    it("unbans user without discord", async () => {
      //GIVEN
      const uid = "myUid";

      const user = {
        uid,
        name: "name",
        email: "email",
        discordId: "",
        banned: true,
      } as unknown as MonkeyTypes.DBUser;
      getUserMock.mockResolvedValue(user);

      //WHEN
      await mockApp
        .post("/admin/toggleBan")
        .set("Authorization", "Bearer 123456789")
        .send({ uid })
        .set({
          Accept: "application/json",
        })
        .expect(200);

      //THEN
      expect(georgeUserBannedMock).not.toHaveBeenCalled();
    });
  });

  describe("getTestActivity", () => {
    it("should return 503 for non premium users", async () => {
      //given
      vi.spyOn(UserDal, "getUser").mockResolvedValue({
        testActivity: { "2023": [1, 2, 3], "2024": [4, 5, 6] },
      } as unknown as MonkeyTypes.DBUser);

      //when
      const response = await mockApp
        .get("/users/testActivity")
        .set("authorization", "Uid 123456789")
        .send()
        .expect(503);
    });
    it("should send data for premium users", async () => {
      //given
      vi.spyOn(UserDal, "getUser").mockResolvedValue({
        testActivity: { "2023": [1, 2, 3], "2024": [4, 5, 6] },
      } as unknown as MonkeyTypes.DBUser);
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);
      await enablePremiumFeatures(true);

      //when
      const response = await mockApp
        .get("/users/testActivity")
        .set("authorization", "Uid 123456789")
        .send()
        .expect(200);

      //%hen
      const result = response.body.data;
      expect(result["2023"]).toEqual([1, 2, 3]);
      expect(result["2024"]).toEqual([4, 5, 6]);
    });
  });

  describe("getCurrentTestActivity", () => {
    beforeAll(() => {
      vi.useFakeTimers().setSystemTime(1712102400000);
    });
    it("without any data", () => {
      expect(getCurrentTestActivity(undefined)).toBeUndefined();
    });
    it("with current year only", () => {
      //given
      const data = {
        "2024": fillYearWithDay(94).map((it) => 2024000 + it),
      };

      //when
      const testActivity = getCurrentTestActivity(data);

      //then
      expect(testActivity?.lastDay).toEqual(1712102400000);

      const testsByDays = testActivity?.testsByDays ?? [];
      expect(testsByDays).toHaveLength(366);
      expect(testsByDays[0]).toEqual(undefined); //2023-04-04
      expect(testsByDays[271]).toEqual(undefined); //2023-12-31
      expect(testsByDays[272]).toEqual(2024001); //2024-01-01
      expect(testsByDays[365]).toEqual(2024094); //2024-01
    });
    it("with current and last year", () => {
      //given
      const data = {
        "2023": fillYearWithDay(365).map((it) => 2023000 + it),
        "2024": fillYearWithDay(94).map((it) => 2024000 + it),
      };

      //when
      const testActivity = getCurrentTestActivity(data);

      //then
      expect(testActivity?.lastDay).toEqual(1712102400000);

      const testsByDays = testActivity?.testsByDays ?? [];
      expect(testsByDays).toHaveLength(366);
      expect(testsByDays[0]).toEqual(2023094); //2023-04-04
      expect(testsByDays[271]).toEqual(2023365); //2023-12-31
      expect(testsByDays[272]).toEqual(2024001); //2024-01-01
      expect(testsByDays[365]).toEqual(2024094); //2024-01
    });
    it("with current and missing days of last year", () => {
      //given
      const data = {
        "2023": fillYearWithDay(20).map((it) => 2023000 + it),
        "2024": fillYearWithDay(94).map((it) => 2024000 + it),
      };

      //when
      const testActivity = getCurrentTestActivity(data);

      //then
      expect(testActivity?.lastDay).toEqual(1712102400000);

      const testsByDays = testActivity?.testsByDays ?? [];
      expect(testsByDays).toHaveLength(366);
      expect(testsByDays[0]).toEqual(undefined); //2023-04-04
      expect(testsByDays[271]).toEqual(undefined); //2023-12-31
      expect(testsByDays[272]).toEqual(2024001); //2024-01-01
      expect(testsByDays[365]).toEqual(2024094); //2024-01
    });
  });
});

function fillYearWithDay(days: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < days; i++) {
    result.push(i + 1);
  }
  return result;
}

async function enablePremiumFeatures(premium: boolean): Promise<void> {
  const mockConfig = _.merge(await configuration, {
    users: { premium: { enabled: premium } },
  });

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig
  );
}

async function enableAdminFeatures(enabled: boolean): Promise<void> {
  const mockConfig = _.merge(await configuration, {
    admin: { endpointsEnabled: enabled },
  });

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig
  );
}

async function enableSignup(enabled: boolean): Promise<void> {
  const mockConfig = _.merge(await configuration, {
    users: { signUp: enabled },
  });

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig
  );
}
