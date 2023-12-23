const { Client } = require("https://github.com/egrigokhan/linkedin-private-api.git#master");

(async () => {
  const client = new Client();
  const res = await client.login.userCookie({
    cookies: {
      liap: "true",
      liat: "AQEDAReCDjAApM2VAAABjI6Ih1IAAAGMspULUk0ATK_B0MYzb4O2i3W-Xpl5gU1kaoymXzjm44dSrx9_I2FQ9ftOtK_7G9GyhkZJ41SiWrm05-BNoqSTcH2Ybp-gd0GYQZbO0oh0oLskjiN3y3a1CMYC",
      JSESSIONID: '"ajax:7789774023183910429"',
      "csrf-token": "ajax:7789774023183910429",
    },
    useCache: false,
  });

  console.log(await res.profile.getOwnProfile());
})();
