export function gql(strings, ...args) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (args[i] || "");
  });
  return str;
}
export const SiteConfigPartsFragmentDoc = gql`
    fragment SiteConfigParts on SiteConfig {
  __typename
  brand {
    __typename
    name
    mark
  }
  contact {
    __typename
    contactEmail
    quoteEmail
  }
  announcement
  header {
    __typename
    primaryLinks {
      __typename
      label
      href
    }
    phone {
      __typename
      label
      href
    }
    quoteCta {
      __typename
      label
      href
      style
    }
  }
  footer {
    __typename
    companyText
    contactLinks {
      __typename
      label
      href
    }
    socialLinks {
      __typename
      label
      href
      icon
    }
    columns {
      __typename
      title
      links {
        __typename
        label
        href
      }
    }
    legalLinks {
      __typename
      label
      href
    }
  }
}
    `;
export const HomePartsFragmentDoc = gql`
    fragment HomeParts on Home {
  __typename
  seoTitle
  seoDescription
  hero {
    __typename
    visible
    kicker
    heading
    subheading
    backgroundImage
    primaryAction {
      __typename
      label
      href
      style
    }
    secondaryAction {
      __typename
      label
      href
      style
    }
    tertiaryAction {
      __typename
      label
      href
      style
    }
  }
  spotlightSection {
    __typename
    visible
    kicker
    title
  }
  spotlightCards {
    __typename
    id
    visible
    title
    description
    icon
  }
  capabilitySection {
    __typename
    visible
    kicker
    title
  }
  capabilityCards {
    __typename
    id
    visible
    title
    description
    icon
  }
  projectShowcase {
    __typename
    visible
    title
    ctaLabel
    ctaHref
    items {
      __typename
      id
      visible
      title
      summary
      image
      galleryImages {
        __typename
        id
        src
        alt
        caption
      }
      href
      tag
    }
  }
  resourceShowcase {
    __typename
    visible
    title
    ctaLabel
    ctaHref
    items {
      __typename
      id
      visible
      title
      summary
      image
      galleryImages {
        __typename
        id
        src
        alt
        caption
      }
      href
      tag
    }
  }
  testimonialsSection {
    __typename
    visible
    kicker
    title
    items {
      __typename
      id
      company
      quote
      person
      role
      metric
    }
  }
  trustedBySection {
    __typename
    visible
    kicker
    title
    logos {
      __typename
      id
      name
      abbreviation
    }
  }
  contactPanel {
    __typename
    visible
    kicker
    heading
    body
    primaryAction {
      __typename
      label
      href
      style
    }
    secondaryAction {
      __typename
      label
      href
      style
    }
  }
}
    `;
export const BlogPostsPartsFragmentDoc = gql`
    fragment BlogPostsParts on BlogPosts {
  __typename
  slug
  title
  excerpt
  seoTitle
  seoDescription
  publishedAt
  author {
    __typename
    name
    role
  }
  coverImage
  tags
  sections {
    __typename
    id
    heading
    body
  }
}
    `;
export const RoutePagesPartsFragmentDoc = gql`
    fragment RoutePagesParts on RoutePages {
  __typename
  slug
  navLabel
  seoTitle
  seoDescription
  pageContent {
    __typename
    elements {
      __typename
      id
      type
      text
      href
      src
    }
  }
  hero {
    __typename
    kicker
    heading
    body
    image
    galleryImages {
      __typename
      id
      src
      alt
      caption
    }
    actions {
      __typename
      label
      href
      style
    }
  }
  sections {
    __typename
    id
    title
    body
    galleryImages {
      __typename
      id
      src
      alt
      caption
    }
    cards {
      __typename
      id
      title
      description
      image
      href
      ctaLabel
    }
  }
  contactPanel {
    __typename
    heading
    body
    responseTime
  }
}
    `;
export const SiteConfigDocument = gql`
    query siteConfig($relativePath: String!) {
  siteConfig(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...SiteConfigParts
  }
}
    ${SiteConfigPartsFragmentDoc}`;
export const SiteConfigConnectionDocument = gql`
    query siteConfigConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: SiteConfigFilter) {
  siteConfigConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...SiteConfigParts
      }
    }
  }
}
    ${SiteConfigPartsFragmentDoc}`;
export const HomeDocument = gql`
    query home($relativePath: String!) {
  home(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...HomeParts
  }
}
    ${HomePartsFragmentDoc}`;
export const HomeConnectionDocument = gql`
    query homeConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: HomeFilter) {
  homeConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...HomeParts
      }
    }
  }
}
    ${HomePartsFragmentDoc}`;
export const BlogPostsDocument = gql`
    query blogPosts($relativePath: String!) {
  blogPosts(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...BlogPostsParts
  }
}
    ${BlogPostsPartsFragmentDoc}`;
export const BlogPostsConnectionDocument = gql`
    query blogPostsConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: BlogPostsFilter) {
  blogPostsConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...BlogPostsParts
      }
    }
  }
}
    ${BlogPostsPartsFragmentDoc}`;
export const RoutePagesDocument = gql`
    query routePages($relativePath: String!) {
  routePages(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...RoutePagesParts
  }
}
    ${RoutePagesPartsFragmentDoc}`;
export const RoutePagesConnectionDocument = gql`
    query routePagesConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: RoutePagesFilter) {
  routePagesConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...RoutePagesParts
      }
    }
  }
}
    ${RoutePagesPartsFragmentDoc}`;
export function getSdk(requester) {
  return {
    siteConfig(variables, options) {
      return requester(SiteConfigDocument, variables, options);
    },
    siteConfigConnection(variables, options) {
      return requester(SiteConfigConnectionDocument, variables, options);
    },
    home(variables, options) {
      return requester(HomeDocument, variables, options);
    },
    homeConnection(variables, options) {
      return requester(HomeConnectionDocument, variables, options);
    },
    blogPosts(variables, options) {
      return requester(BlogPostsDocument, variables, options);
    },
    blogPostsConnection(variables, options) {
      return requester(BlogPostsConnectionDocument, variables, options);
    },
    routePages(variables, options) {
      return requester(RoutePagesDocument, variables, options);
    },
    routePagesConnection(variables, options) {
      return requester(RoutePagesConnectionDocument, variables, options);
    }
  };
}
import { createClient } from "tinacms/dist/client";
const generateRequester = (client) => {
  const requester = async (doc, vars, options) => {
    let url = client.apiUrl;
    if (options?.branch) {
      const index = client.apiUrl.lastIndexOf("/");
      url = client.apiUrl.substring(0, index + 1) + options.branch;
    }
    const data = await client.request({
      query: doc,
      variables: vars,
      url
    }, options);
    return { data: data?.data, errors: data?.errors, query: doc, variables: vars || {} };
  };
  return requester;
};
export const ExperimentalGetTinaClient = () => getSdk(
  generateRequester(
    createClient({
      url: "/api/tina/gql",
      queries
    })
  )
);
export const queries = (client) => {
  const requester = generateRequester(client);
  return getSdk(requester);
};
