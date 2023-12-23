const random = require("crypto");
const base64 = require("base64-js");

const getIDFromUrn = (urn) => {
  return urn.split(":")[3];
};

const getUrnFromRawUpdate = (rawString) => {
  return rawString.split("(")[1].split(",")[0];
};

const getUpdateAuthorName = (dIncluded) => {
  try {
    return dIncluded.actor.name.text;
  } catch (error) {
    return error instanceof TypeError ? "None" : "";
  }
};

const getUpdateOld = (dIncluded) => {
  try {
    return dIncluded.actor.subDescription.text;
  } catch (error) {
    return error instanceof TypeError ? "None" : "";
  }
};

const getUpdateContent = (dIncluded, baseUrl) => {
  try {
    return dIncluded.commentary.text.text;
  } catch (error) {
    if (error instanceof TypeError) {
      try {
        const urn = getUrnFromRawUpdate(dIncluded["*resharedUpdate"]);
        return `${baseUrl}/feed/update/${urn}`;
      } catch (error) {
        return error instanceof TypeError ? "None" : "IMAGE";
      }
    } else {
      return "";
    }
  }
};

const getUpdateAuthorProfile = (dIncluded, baseUrl) => {
  try {
    const urn = dIncluded.actor.urn;
    const urnId = urn.split(":").pop();
    if (urn.includes("company")) {
      return `${baseUrl}/company/${urnId}`;
    } else if (urn.includes("member")) {
      return `${baseUrl}/in/${urnId}`;
    }
  } catch (error) {
    return error instanceof TypeError ? "None" : "";
  }
};

const getUpdateURL = (dIncluded, baseUrl) => {
  try {
    const urn = dIncluded.updateMetadata.urn;
    return `${baseUrl}/feed/update/${urn}`;
  } catch (error) {
    return error instanceof TypeError ? "None" : "";
  }
};

const appendUpdatePostFieldToPostsList = (
  dIncluded,
  lPosts,
  postKey,
  postValue,
) => {
  const elementsCurrentIndex = lPosts.length - 1;

  if (elementsCurrentIndex === -1) {
    lPosts.push({ [postKey]: postValue });
  } else {
    if (!lPosts[elementsCurrentIndex].hasOwnProperty(postKey)) {
      lPosts[elementsCurrentIndex][postKey] = postValue;
    } else {
      lPosts.push({ [postKey]: postValue });
    }
  }
  return lPosts;
};

const parseListRawUrns = (lRawUrns) => {
  return lRawUrns.map((urn) => getUrnFromRawUpdate(urn));
};

const parseListRawPosts = (lRawPosts, linkedinBaseUrl) => {
  const lPosts = [];
  lRawPosts.forEach((item) => {
    const authorName = getUpdateAuthorName(item);
    if (authorName) {
      appendUpdatePostFieldToPostsList(item, lPosts, "author_name", authorName);
    }

    // ... (similar logic for other fields)

    const url = getUpdateURL(item, linkedinBaseUrl);
    if (url) {
      appendUpdatePostFieldToPostsList(item, lPosts, "url", url);
    }
  });
  return lPosts;
};

const getListPostsSortedWithoutPromoted = (lUrns, lPosts) => {
  const lPostsSortedWithoutPromoted = [];
  lPosts = lPosts.filter((d) => !d.old.includes("Promoted"));
  lUrns.forEach((urn) => {
    lPosts.forEach((post) => {
      if (post.url.includes(urn)) {
        lPostsSortedWithoutPromoted.push(post);
        lPosts = lPosts.filter((d) => !d.url.includes(urn));
      }
    });
  });
  return lPostsSortedWithoutPromoted;
};

const generateTrackingIdAsCharString = () => {
  const randomIntArray = Array.from({ length: 16 }, () =>
    random.randomInt(256),
  );
  return String.fromCharCode(...randomIntArray);
};

const generateTrackingId = () => {
  const randomIntArray = Array.from({ length: 16 }, () =>
    random.randomInt(256),
  );
  const randByteArray = Buffer.from(randomIntArray);
  return base64.fromByteArray(randByteArray).toString();
};

module.exports = {
  getIDFromUrn,
  getUrnFromRawUpdate,
  getUpdateAuthorName,
  getUpdateOld,
  getUpdateContent,
  getUpdateAuthorProfile,
  getUpdateURL,
  appendUpdatePostFieldToPostsList,
  parseListRawUrns,
  parseListRawPosts,
  getListPostsSortedWithoutPromoted,
  generateTrackingIdAsCharString,
  generateTrackingId,
};
