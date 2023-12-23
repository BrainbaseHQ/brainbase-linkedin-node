const Linkedin = require("./linkedin"); // assuming you have Linkedin class in 'linkedin.js'

// Simulating the cookiejar_from_dict functionality in Node.js
const cookies = {
  liap: "true",
  li_at:
    "AQEDAReCDjAFFoQyAAABjJOJ1koAAAGMt5ZaSk4AShb0KGczvpSmB2ovZRxgH_E4fuUBGtDbvHjilY1kCrbTp8ml6Jhu4yqYCkWePVQmzjJswGJQ677GxE4xqqFQb4S2jW-_vtziw6nB4yjTix4Z6cG4",
  JSESSIONID: "ajax:7789774023183910429",
};

// Instantiate the Linkedin client with the cookies
const linkedinApi = new Linkedin({ cookies });

async function search_people_and_parse_profiles(keywords, limit=100) {
  const search = await linkedinApi.search_people({keywords, limit})

  data = []

  /* promise all for search */
  for (s in search) {
    // get profile and contact info for each result in
    const profile = await linkedinApi.getProfile(s["urn_id"])
    const contact_info = await linkedinApi.getProfileContactInfo(s["urn_id"])
    data.push({
        "profile": profile,
        "contact_info": contact_info
    })
  }

  return data
}

(async () => {
  try {
    // GET a profile
    const data = await search_people_and_parse_profiles("yc w24", 10)

    // Uncomment to use these functionalities
    // GET a profile's contact info
    // const contactInfo = await linkedinApi.getProfileContactInfo('gokhan-egri');

    // GET 1st degree connections of a given profile
    // const connections = await linkedinApi.getProfileConnections('olivia-ellman');

    console.log(data);
    // console.log(contactInfo);
    // console.log(connections);
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
