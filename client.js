const axios = require("axios");
const fs = require("fs");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const { JSDOM } = require("jsdom");

class ChallengeException extends Error {}

class UnauthorizedException extends Error {}

class Client {
  static LINKEDIN_BASE_URL = "https://www.linkedin.com";
  static API_BASE_URL = `${Client.LINKEDIN_BASE_URL}/voyager/api`;
  static REQUEST_HEADERS = {
    "user-agent": [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5)",
      "AppleWebKit/537.36 (KHTML, like Gecko)",
      "Chrome/83.0.4103.116 Safari/537.36",
    ].join(" "),
    "accept-language": "en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
    "x-li-lang": "en_US",
    "x-restli-protocol-version": "2.0.0",
  };
  static AUTH_REQUEST_HEADERS = {
    "X-Li-User-Agent":
      "LIAuthLibrary:3.2.4 com.linkedin.LinkedIn:8.8.1 iPhone:8.3",
    "User-Agent": "LinkedIn/8.8.1 CFNetwork/711.3.18 Darwin/14.0.0",
    "X-User-Language": "en",
    "X-User-Locale": "en_US",
    "Accept-Language": "en-us",
  };

  constructor({ proxies = {} } = {}) {
    this.proxy = proxies;
    this.headers = Client.REQUEST_HEADERS;
    this.metadata = {};
  }

  async _requestSessionCookies() {
    console.debug("Requesting new cookies.");
    const response = await axios.get(
      `${Client.LINKEDIN_BASE_URL}/uas/authenticate`,
      {
        headers: Client.AUTH_REQUEST_HEADERS,
        // proxy: this.client.defaults.proxy,
      },
    );
    return response.cookies;
  }

  _setSessionCookies(cookies) {
    /* cookies is a dict */
    this.headers["Cookie"] = Object.keys(cookies)
      .map((key, index) => `${key}=${cookies[key]}`)
      .join("; ");

    this.headers["csrf-token"] = cookies["JSESSIONID"].replace(/"/g, "");
  }

  async _fetchMetadata() {
    const response = await axios.get(`${Client.LINKEDIN_BASE_URL}`, {
      cookies: this.client.defaults.cookies,
      headers: Client.AUTH_REQUEST_HEADERS,
      proxy: this.client.defaults.proxy,
    });
    const dom = new JSDOM(response.data);
    const metadata = {};
    const applicationInstanceMeta = dom.window.document.querySelector(
      'meta[name="applicationInstance"]',
    );
    if (applicationInstanceMeta) {
      metadata.clientApplicationInstance = JSON.parse(
        applicationInstanceMeta.content,
      );
    }
    const clientPageInstanceIdMeta = dom.window.document.querySelector(
      'meta[name="clientPageInstanceId"]',
    );
    if (clientPageInstanceIdMeta) {
      metadata.clientPageInstanceId = clientPageInstanceIdMeta.content;
    }
    this.metadata = metadata;
  }

  async get(url) {
    return axios.get(url, {
      headers: { ...Client.REQUEST_HEADERS, ...this.headers },
      // proxy: this.proxy,
    });
  }

  async post(url, data) {
    return axios.post(url, data, {
      headers: { ...Client.REQUEST_HEADERS, ...this.headers },
      proxy: this.proxy,
    });
  }
}

module.exports = Client;
