const axios = require("axios");
const Client = require("./client");
const { getIDFromUrn, getUrnFromRawUpdate } = require("./utils");

class Linkedin {
  static MAX_POST_COUNT = 100;
  static MAX_UPDATE_COUNT = 100;
  static MAX_SEARCH_COUNT = 49;
  static MAX_REPEATED_REQUESTS = 200;

  constructor({
    authenticate = false,
    refreshCookies = false,
    debug = false,
    proxies = {},
    cookies = null,
    cookiesDir = null,
  } = {}) {
    this.client = new Client({
      refreshCookies,
      debug,
      proxies,
      cookiesDir,
    });

    this.client._setSessionCookies(cookies);
  }

  defaultEvade() {
    return new Promise((resolve) => {
      // Generate a random time between 2000ms (2s) and 5000ms (5s)
      const timeToSleep = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;

      setTimeout(() => {
        resolve();
      }, timeToSleep);
    });
  }

  async _fetch(uri, evade = this.defaultEvade, baseRequest = false) {
    evade();

    const url = `${
      !baseRequest ? Client.API_BASE_URL : Client.LINKEDIN_BASE_URL
    }${uri}`;
    return this.client.get(url);
  }

  async _post(uri, evade = this.defaultEvade, baseRequest = false, data = {}) {
    evade();

    const url = `${
      !baseRequest ? Client.API_BASE_URL : Client.LINKEDIN_BASE_URL
    }${uri}`;
    return this.client.post(url, data);
  }

  async getProfile(publicId = null, urnId = null) {
    // Fetch data for a given LinkedIn profile.

    const profileId = publicId || urnId;
    const res = await this._fetch(
      `/identity/profiles/${profileId}/profileView`
    );

    const data = res.data;
    if (data && data.status && data.status !== 200) {
      this.logger.info(`request failed: ${data.message}`);
      return {};
    }

    // massage [profile] data
    const profile = data.profile;
    if (profile.miniProfile) {
      if (profile.miniProfile.picture) {
        profile.displayPictureUrl =
          profile.miniProfile.picture[
            "com.linkedin.common.VectorImage"
          ].rootUrl;

        const imagesData =
          profile.miniProfile.picture["com.linkedin.common.VectorImage"]
            .artifacts;
        for (const img of imagesData) {
          const { width, height, fileIdentifyingUrlPathSegment } = img;
          profile[`img_${width}_${height}`] = fileIdentifyingUrlPathSegment;
        }
      }

      profile.profileId = getIDFromUrn(profile.miniProfile.entityUrn);
      profile.profileUrn = profile.miniProfile.entityUrn;
      profile.memberUrn = profile.miniProfile.objectUrn;
      profile.publicId = profile.miniProfile.publicIdentifier;

      delete profile.miniProfile;
    }

    delete profile.defaultLocale;
    delete profile.supportedLocales;
    delete profile.versionTag;
    delete profile.showEducationOnProfileTopCard;

    // massage [experience] data
    const experience = data.positionView.elements;
    for (const item of experience) {
      if (item.company && item.company.miniCompany) {
        if (item.company.miniCompany.logo) {
          const logo =
            item.company.miniCompany.logo["com.linkedin.common.VectorImage"];
          if (logo) {
            item.companyLogoUrl = logo.rootUrl;
          }
        }
        delete item.company.miniCompany;
      }
    }

    profile.experience = experience;

    // massage [education] data
    const education = data.educationView.elements;
    for (const item of education) {
      if (item.school && item.school.logo) {
        item.school.logoUrl =
          item.school.logo["com.linkedin.common.VectorImage"].rootUrl;
        delete item.school.logo;
      }
    }

    profile.education = education;

    // massage [languages] data
    const languages = data.languageView.elements;
    for (const item of languages) {
      delete item.entityUrn;
    }
    profile.languages = languages;

    // massage [publications] data
    const publications = data.publicationView.elements;
    for (const item of publications) {
      delete item.entityUrn;
      for (const author of item.authors || []) {
        delete author.entityUrn;
      }
    }
    profile.publications = publications;

    // massage [certifications] data
    const certifications = data.certificationView.elements;
    for (const item of certifications) {
      delete item.entityUrn;
    }
    profile.certifications = certifications;

    // massage [volunteer] data
    const volunteer = data.volunteerExperienceView.elements;
    for (const item of volunteer) {
      delete item.entityUrn;
    }
    profile.volunteer = volunteer;

    // massage [honors] data
    const honors = data.honorView.elements;
    for (const item of honors) {
      delete item.entityUrn;
    }
    profile.honors = honors;

    // massage [projects] data
    const projects = data.projectView.elements;
    for (const item of projects) {
      delete item.entityUrn;
    }
    profile.projects = projects;

    return profile;
  }

  async search(params, limit = -1, offset = 0) {
    const count = Linkedin.MAX_SEARCH_COUNT;
    if (limit === null) {
        limit = -1;
    }

    let results = [];
    while (true) {
        // when we're close to the limit, only fetch what we need to
        let currentCount = count;
        if (limit > -1 && limit - results.length < count) {
            currentCount = limit - results.length;
        }
        
        let defaultParams = {
            count: String(currentCount),
            filters: "List()",
            origin: "GLOBAL_SEARCH_HEADER",
            q: "all",
            start: results.length + offset,
            queryContext: "List(spellCorrectionEnabled->true,relatedSearchesEnabled->true,kcardTypes->PROFILE|COMPANY)"
        };

        Object.assign(defaultParams, params);

        let keywords = defaultParams.keywords ? `keywords:${defaultParams.keywords},` : "";

        let res;
        try {
            res = await this._fetch(`/graphql?variables=(start:${defaultParams.start},origin:${defaultParams.origin},` +
                                    `query:(${keywords}` +
                                    `flagshipSearchIntent:SEARCH_SRP,` +
                                    `queryParameters:${defaultParams.filters},` +
                                    `includeFiltersInResponse:false))&=&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`);
        } catch (error) {
            console.error(error);
            return [];
        }

        let dataClusters = res.data.data?.searchDashClustersByAll || [];

        if (!dataClusters || dataClusters._type !== "com.linkedin.restli.common.CollectionResponse") {
            return [];
        }

        let newElements = [];
        for (let it of dataClusters.elements || []) {
            if (it._type !== "com.linkedin.voyager.dash.search.SearchClusterViewModel") {
                continue;
            }

            for (let el of it.items || []) {
                if (el._type !== "com.linkedin.voyager.dash.search.SearchItem") {
                    continue;
                }

                let e = el.item?.entityResult || [];
                if (!e || e._type !== "com.linkedin.voyager.dash.search.EntityResultViewModel") {
                    continue;
                }
                newElements.push(e);
            }
        }

        results.push(...newElements);

        // break the loop if we're done searching
        if ((limit > -1 && limit <= results.length) || 
            (results.length / currentCount >= Linkedin.MAX_REPEATED_REQUESTS) || 
            newElements.length === 0) {
            break;
        }

        console.debug(`results grew to ${results.length}`);
    }

    return results;
}


  async search_people({
    keywords = null,
    connectionOf = null,
    networkDepths = null,
    currentCompany = null,
    pastCompanies = null,
    nonprofitInterests = null,
    profileLanguages = null,
    regions = null,
    industries = null,
    schools = null,
    contactInterests = null,
    serviceCategories = null,
    includePrivateProfiles = false, // profiles without a public id, "Linkedin Member"
    // Keywords filter
    keywordFirstName = null,
    keywordLastName = null,
    // `keywordTitle` and `title` are the same. We kept `title` for backward compatibility. Please only use one of them.
    keywordTitle = null,
    keywordCompany = null,
    keywordSchool = null,
    networkDepth = null, // DEPRECATED - use networkDepths
    title = null, // DEPRECATED - use keywordTitle
    limit = -1,
    ...kwargs
  }) {
    // Perform a LinkedIn search for people.

    let filters = ["(key:resultType,value:List(PEOPLE))"];
    if (connectionOf) {
      filters.push(`(key:connectionOf,value:List(${connectionOf}))`);
    }
    if (networkDepths) {
      let stringify = networkDepths.join(" | ");
      filters.push(`(key:network,value:List(${stringify}))`);
    } else if (networkDepth) {
      filters.push(`(key:network,value:List(${networkDepth}))`);
    }
    if (regions) {
      let stringify = regions.join(" | ");
      filters.push(`(key:geoUrn,value:List(${stringify}))`);
    }
    if (industries) {
      let stringify = industries.join(" | ");
      filters.push(`(key:industry,value:List(${stringify}))`);
    }
    if (currentCompany) {
      let stringify = currentCompany.join(" | ");
      filters.push(`(key:currentCompany,value:List(${stringify}))`);
    }
    if (pastCompanies) {
      let stringify = pastCompanies.join(" | ");
      filters.push(`(key:pastCompany,value:List(${stringify}))`);
    }
    if (profileLanguages) {
      let stringify = profileLanguages.join(" | ");
      filters.push(`(key:profileLanguage,value:List(${stringify}))`);
    }
    if (nonprofitInterests) {
      let stringify = nonprofitInterests.join(" | ");
      filters.push(`(key:nonprofitInterest,value:List(${stringify}))`);
    }
    if (schools) {
      let stringify = schools.join(" | ");
      filters.push(`(key:schools,value:List(${stringify}))`);
    }
    if (serviceCategories) {
      let stringify = serviceCategories.join(" | ");
      filters.push(`(key:serviceCategory,value:List(${stringify}))`);
    }
    // Keywords filter
    keywordTitle = keywordTitle || title;
    if (keywordFirstName) {
      filters.push(`(key:firstName,value:List(${keywordFirstName}))`);
    }
    if (keywordLastName) {
      filters.push(`(key:lastName,value:List(${keywordLastName}))`);
    }
    if (keywordTitle) {
      filters.push(`(key:title,value:List(${keywordTitle}))`);
    }
    if (keywordCompany) {
      filters.push(`(key:company,value:List(${keywordCompany}))`);
    }
    if (keywordSchool) {
      filters.push(`(key:school,value:List(${keywordSchool}))`);
    }

    let params = {
      filters: `List(${filters.join(",")})`,
      ...kwargs,
    };

    if (keywords) {
      params.keywords = keywords;
    }

    let data = await this.search(params, limit, 0);

    let results = [];
    for (let item of data) {
      if (
        !includePrivateProfiles &&
        (item.entityCustomTrackingInfo?.memberDistance ?? "") ===
          "OUT_OF_NETWORK"
      ) {
        continue;
      }
      results.push({
        urnId: getIDFromUrn(getUrnFromRawUpdate(item.entityUrn)),
        distance: item.entityCustomTrackingInfo?.memberDistance ?? null,
        jobTitle: item.primarySubtitle?.text ?? null,
        location: item.secondarySubtitle?.text ?? null,
        name: item.title?.text ?? null,
      });
    }

    return results;
  }

  async searchCompanies(keywords = null, ...kwargs) {
    const filters = ["(key:resultType,value:List(COMPANIES))"];

    let params = {
        filters: `List(${filters.join(',')})`,
        queryContext: "List(spellCorrectionEnabled->true)"
    };

    if (keywords) {
        params.keywords = keywords;
    }

    const data = await this.search(params, ...kwargs);

    let results = [];
    for (let item of data) {
        if (!item.trackingUrn.includes("company")) {
            continue;
        }

        const urnId = getIdFromUrn(item.trackingUrn || null);
        const name = item.title?.text || null;
        const headline = item.primarySubtitle?.text || null;
        const subline = item.secondarySubtitle?.text || null;

        results.push({ urnId, name, headline, subline });
    }

    return results;
}


async searchJobs(
  keywords = null,
  companies = null,
  experience = null,
  jobType = null,
  jobTitle = null,
  industries = null,
  locationName = null,
  remote = null,
  listedAt = 24 * 60 * 60,
  distance = null,
  limit = -1,
  offset = 0,
  ...kwargs
) {
  const MAX_SEARCH_COUNT = Linkedin.MAX_SEARCH_COUNT;
  if (limit === null) {
      limit = -1;
  }

  let query = { origin: "JOB_SEARCH_PAGE_QUERY_EXPANSION" };
  if (keywords) {
      query.keywords = "KEYWORD_PLACEHOLDER";
  }
  if (locationName) {
      query.locationFallback = "LOCATION_PLACEHOLDER";
  }

  query.selectedFilters = {};
  if (companies) {
      query.selectedFilters.company = `List(${companies.join(',')})`;
  }
  if (experience) {
      query.selectedFilters.experience = `List(${experience.join(',')})`;
  }
  if (jobType) {
      query.selectedFilters.jobType = `List(${jobType.join(',')})`;
  }
  if (jobTitle) {
      query.selectedFilters.title = `List(${jobTitle.join(',')})`;
  }
  if (industries) {
      query.selectedFilters.industry = `List(${industries.join(',')})`;
  }
  if (distance) {
      query.selectedFilters.distance = `List(${distance})`;
  }
  if (remote) {
      query.selectedFilters.workplaceType = `List(${remote.join(',')})`;
  }

  query.selectedFilters.timePostedRange = `List(r${listedAt})`;
  query.spellCorrectionEnabled = "true";

  query = JSON.stringify(query)
              .replace(/ /g, '')
              .replace(/'/g, '')
              .replace("KEYWORD_PLACEHOLDER", keywords || '')
              .replace("LOCATION_PLACEHOLDER", locationName || '')
              .replace(/{/g, '(')
              .replace(/}/g, ')');

  let results = [];
  while (true) {
      if (limit > -1 && limit - results.length < MAX_SEARCH_COUNT) {
          count = limit - results.length;
      }
      const defaultParams = {
          decorationId: "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-174",
          count: count,
          q: "jobSearch",
          query: query,
          start: results.length + offset,
      };

      const res = await this._fetch(`/voyagerJobsDashJobCards?${encodeURIComponent(JSON.stringify(defaultParams))}`,
          { headers: {"accept": "application/vnd.linkedin.normalized+json+2.1"} }
      );
      const data = await res.json();

      const elements = data.included || [];
      const new_data = elements.filter(i => i["$type"] === 'com.linkedin.voyager.dash.jobs.JobPosting');

      if (!new_data.length) {
          break;
      }

      results.push(...new_data);
      if ((limit > -1 && limit <= results.length) || (results.length / count >= MAX_SEARCH_COUNT)) {
          break;
      }

      console.debug(`results grew to ${results.length}`);
  }

  return results;
}


async getProfileContactInfo(publicId = null, urnId = null) {
  const res = await this._fetch(`/identity/profiles/${publicId || urnId}/profileContactInfo`);
  const data = res.data;

  let contactInfo = {
      emailAddress: data.emailAddress,
      websites: [],
      twitter: data.twitterHandles,
      birthdate: data.birthDateOn,
      ims: data.ims,
      phoneNumbers: data.phoneNumbers || []
  };

  const websites = data.websites || [];
  for (let item of websites) {
      if ("com.linkedin.voyager.identity.profile.StandardWebsite" in item.type) {
          item.label = item.type["com.linkedin.voyager.identity.profile.StandardWebsite"].category;
      } else if ("" in item.type) {
          item.label = item.type["com.linkedin.voyager.identity.profile.CustomWebsite"].label;
      }

      delete item.type;
  }

  contactInfo.websites = websites;

  return contactInfo;
}


async getProfileSkills(publicId = null, urnId = null) {
  const params = { count: 100, start: 0 };
  const res = await this._fetch(`/identity/profiles/${publicId || urnId}/skills`, { params });
  const data = res.data;
  
  const skills = data.elements || [];
  for (let item of skills) {
      delete item.entityUrn;
  }

  return skills;
}



}

module.exports = Linkedin;
