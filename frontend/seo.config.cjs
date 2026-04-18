const SITE = {
  name: "AfricaRentalGrid",
  url: "https://www.tst-plotconnect.com",
  description: "AfricaRentalGrid helps people discover verified hostels, bedsitters, lodges, and rentals across Kenya with trusted listings and local search pages.",
  image: "/favicon.svg",
  imageAlt: "AfricaRentalGrid logo",
  locale: "en_KE",
  twitterCard: "summary_large_image",
  author: "AfricaRentalGrid"
};

const TODAY = new Date().toISOString().slice(0, 10);

function absoluteUrl(path = "/") {
  return new URL(path, SITE.url).toString();
}

function dedupeKeywords(values = []) {
  return [...new Set(values.flat().filter(Boolean).map((value) => String(value).trim()))];
}

function breadcrumbSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

function pageSchema(page, type = "WebPage") {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: "en-KE",
    isPartOf: {
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url
    }
  };
}

function homeSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: absoluteUrl(SITE.image),
      sameAs: [
        "https://web.facebook.com/profile.php?id=61586345377148",
        "https://www.instagram.com/techswifttrix/?hl=en",
        "https://wa.me/254768622994"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE.url}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }
  ];
}

function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    telephone: "+254768622994",
    email: "support@tst-plotconnect.com",
    address: {
      "@type": "PostalAddress",
      addressCountry: "KE",
      addressLocality: "Kenya",
      addressRegion: "Kenya"
    },
    areaServed: ["KE"],
    priceRange: "$",
    sameAs: [
      "https://web.facebook.com/profile.php?id=61586345377148",
      "https://www.instagram.com/techswifttrix/?hl=en",
      "https://wa.me/254768622994"
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+254768622994",
      contactType: "customer support",
      email: "support@tst-plotconnect.com",
      areaServed: "KE",
      availableLanguage: ["en", "sw"]
    }
  };
}

function faqSchema(faqs = []) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer
      }
    }))
  };
}

function articleSchema(article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: article.image || absoluteUrl(SITE.image),
    datePublished: article.datePublished || TODAY,
    dateModified: article.dateModified || TODAY,
    author: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: absoluteUrl(SITE.image)
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(SITE.image)
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(article.path)
    }
  };
}

function publicPage(options) {
  const page = {
    ogType: "website",
    robots: "index,follow,max-image-preview:large",
    twitterCard: SITE.twitterCard,
    includeInSitemap: true,
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY,
    schemas: [],
    ...options
  };

  page.keywords = dedupeKeywords(page.keywords || []);
  return page;
}

function privatePage(options) {
  return {
    ogType: "website",
    robots: "noindex,nofollow,noarchive",
    twitterCard: "summary",
    includeInSitemap: false,
    changefreq: "never",
    priority: 0,
    lastmod: TODAY,
    schemas: [],
    ...options
  };
}

function cityPage({ file, path, city, category, title, description, priority = 0.8, keywords = [], extraDescription = "" }) {
  const lowerCategory = category.toLowerCase();
  return publicPage({
    file,
    path,
    title,
    description,
    keywords: dedupeKeywords([
      `${lowerCategory} in ${city}`,
      `${city} ${lowerCategory}`,
      `affordable ${lowerCategory} ${city}`,
      `verified ${lowerCategory} ${city}`,
      `AfricaRentalGrid ${city}`,
      ...keywords
    ]),
    changefreq: "weekly",
    priority,
    schemas: [
      pageSchema({ title, description, path }, "CollectionPage"),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${category} in ${city}`,
        description: extraDescription || description,
        url: absoluteUrl(path)
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: title.replace(" | AfricaRentalGrid", ""), path }
      ])
    ]
  });
}

const pages = [
  publicPage({
    file: "index.html",
    path: "/",
    title: "AfricaRentalGrid | Find Hostels, Bedsitters & Lodges Near You",
    description: "AfricaRentalGrid helps students and travelers find verified hostels, bedsitters, lodges, and affordable rentals across Kenya with trusted local listings.",
    keywords: [
      "hostels Kenya",
      "bedsitters Kenya",
      "lodges Kenya",
      "affordable rentals Kenya",
      "verified accommodation Kenya",
      "AfricaRentalGrid"
    ],
    changefreq: "weekly",
    priority: 1,
    schemas: homeSchemas()
  }),
  publicPage({
    file: "about.html",
    path: "/about",
    title: "About AfricaRentalGrid | Verified Listings Across Kenya",
    description: "Learn how AfricaRentalGrid helps renters, students, and travelers discover verified plots and accommodation listings across Kenya.",
    keywords: [
      "about AfricaRentalGrid",
      "verified listings Kenya",
      "rental platform Kenya",
      "property discovery Kenya"
    ],
    priority: 0.7,
    schemas: [
      pageSchema({ title: "About AfricaRentalGrid", description: "Learn how AfricaRentalGrid helps renters, students, and travelers discover verified plots and accommodation listings across Kenya.", path: "/about" }, "AboutPage"),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" }
      ])
    ]
  }),
  publicPage({
    file: "plots.html",
    path: "/plots",
    title: "Plots & Rentals | AfricaRentalGrid",
    description: "Browse verified plots and rental listings across Kenya, then open the main PlotConnect experience for full filters, maps, and listing details.",
    keywords: [
      "plots Kenya",
      "rentals Kenya",
      "verified plots",
      "property listings Kenya",
      "AfricaRentalGrid listings"
    ],
    changefreq: "weekly",
    priority: 0.8,
    schemas: [
      pageSchema({ title: "Plots & Rentals", description: "Browse verified plots and rental listings across Kenya.", path: "/plots" }, "CollectionPage"),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Plots & Rentals", path: "/plots" }
      ])
    ]
  }),
  publicPage({
    file: "contact.html",
    path: "/contacts",
    title: "Contact AfricaRentalGrid",
    description: "Contact AfricaRentalGrid for support, listing questions, WhatsApp help, and partnership inquiries across Kenya.",
    keywords: [
      "contact AfricaRentalGrid",
      "PlotConnect support",
      "listing support Kenya",
      "PlotConnect WhatsApp"
    ],
    schemas: [
      pageSchema({ title: "Contact AfricaRentalGrid", description: "Contact AfricaRentalGrid for support and partnership inquiries.", path: "/contacts" }, "ContactPage"),
      localBusinessSchema(),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Contact", path: "/contacts" }
      ])
    ]
  }),
  publicPage({
    file: "privacy.html",
    path: "/privacy",
    title: "Privacy Policy | AfricaRentalGrid",
    description: "Read the AfricaRentalGrid privacy policy for information about account data, listing activity, payments, and support communications.",
    keywords: [
      "AfricaRentalGrid privacy policy",
      "PlotConnect data policy",
      "privacy policy Kenya property app"
    ],
    schemas: [
      pageSchema({ title: "Privacy Policy", description: "Read the AfricaRentalGrid privacy policy.", path: "/privacy" }),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Privacy Policy", path: "/privacy" }
      ])
    ]
  }),
  publicPage({
    file: "account-deletion.html",
    path: "/account-deletion",
    title: "Account Deletion | AfricaRentalGrid",
    description: "Request deletion of your AfricaRentalGrid account and understand what user data may be deleted or retained for operational or legal reasons.",
    keywords: [
      "AfricaRentalGrid account deletion",
      "delete PlotConnect account",
      "Google Play account deletion PlotConnect"
    ],
    schemas: [
      pageSchema({ title: "Account Deletion", description: "Request deletion of your AfricaRentalGrid account and associated user data.", path: "/account-deletion" }),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Account Deletion", path: "/account-deletion" }
      ])
    ]
  }),
  publicPage({
    file: "blog.html",
    path: "/blogs",
    title: "Blog | AfricaRentalGrid",
    description: "Read AfricaRentalGrid guides on hostels, bedsitters, lodges, student housing, and affordable rentals across Kenya.",
    keywords: [
      "AfricaRentalGrid blog",
      "hostels Kenya guide",
      "bedsitters Nairobi tips",
      "student accommodation Kenya",
      "affordable rental guides"
    ],
    changefreq: "weekly",
    priority: 0.7,
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "AfricaRentalGrid Blog",
        description: "Tips and guides on hostels, bedsitters, lodges, and affordable rentals from AfricaRentalGrid.",
        url: absoluteUrl("/blogs"),
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          logo: {
            "@type": "ImageObject",
            url: absoluteUrl(SITE.image)
          }
        }
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blogs" }
      ])
    ]
  }),
  publicPage({
    file: "blog-post.html",
    path: "/blog-post",
    title: "Blog Post | AfricaRentalGrid",
    description: "Read the latest hostels, bedsitters, lodges, and rental tips from AfricaRentalGrid.",
    keywords: [
      "AfricaRentalGrid article",
      "Kenya rental guide",
      "hostels and bedsitters blog"
    ],
    includeInSitemap: false,
    schemas: []
  }),
  cityPage({
    file: "nairobi-hostels.html",
    path: "/nairobi-hostels",
    city: "Nairobi",
    category: "Hostels",
    title: "Hostels in Nairobi - Affordable Rooms | AfricaRentalGrid",
    description: "Find affordable hostels in Nairobi with photos, prices, map view, and direct listing access on AfricaRentalGrid.",
    priority: 0.9,
    keywords: ["cheap hostels Nairobi", "student hostels Nairobi", "budget rooms Nairobi"],
    extraDescription: "Browse verified hostels in Nairobi with live prices and map view."
  }),
  cityPage({
    file: "machakos-hostels.html",
    path: "/machakos-hostels",
    city: "Machakos",
    category: "Hostels",
    title: "Hostels in Machakos - Affordable Rooms | AfricaRentalGrid",
    description: "Browse hostels in Machakos with verified listing details, local map view, and live prices on AfricaRentalGrid.",
    priority: 0.9,
    keywords: ["cheap hostels Machakos", "student hostels Machakos", "budget rooms Machakos"]
  }),
  cityPage({
    file: "kiambu-hostels.html",
    path: "/kiambu-hostels",
    city: "Kiambu",
    category: "Hostels",
    title: "Hostels in Kiambu - Affordable Rooms | AfricaRentalGrid",
    description: "Find hostels in Kiambu with photos, prices, and map view. Browse verified listings on AfricaRentalGrid.",
    priority: 0.8,
    keywords: ["cheap rooms Kiambu", "student hostels Kiambu"]
  }),
  cityPage({
    file: "thika-hostels.html",
    path: "/thika-hostels",
    city: "Thika",
    category: "Hostels",
    title: "Hostels in Thika - Affordable Rooms | AfricaRentalGrid",
    description: "Discover hostels in Thika with live pricing, verified listings, and map-based browsing on AfricaRentalGrid.",
    priority: 0.8,
    keywords: ["cheap hostels Thika", "student rooms Thika"]
  }),
  cityPage({
    file: "mombasa-hostels.html",
    path: "/mombasa-hostels",
    city: "Mombasa",
    category: "Hostels",
    title: "Hostels in Mombasa - Affordable Rooms | AfricaRentalGrid",
    description: "Find verified hostels in Mombasa with direct listing access, photos, and price comparisons on AfricaRentalGrid.",
    priority: 0.8,
    keywords: ["cheap hostels Mombasa", "budget rooms Mombasa", "student hostels Mombasa"]
  }),
  cityPage({
    file: "nairobi-bedsitters.html",
    path: "/nairobi-bedsitters",
    city: "Nairobi",
    category: "Bedsitters",
    title: "Bedsitters in Nairobi - Affordable Rentals | AfricaRentalGrid",
    description: "Browse affordable bedsitters in Nairobi with verified prices, photos, and local listing access on AfricaRentalGrid.",
    priority: 0.9,
    keywords: ["bedsitters Nairobi", "cheap bedsitters Nairobi", "student bedsitters Nairobi"]
  }),
  cityPage({
    file: "machakos-lodges.html",
    path: "/machakos-lodges",
    city: "Machakos",
    category: "Lodges",
    title: "Lodges in Machakos - Affordable Short Stay Rooms | AfricaRentalGrid",
    description: "Compare Machakos lodges and short-stay rooms with verified listings, photos, and live prices on AfricaRentalGrid.",
    priority: 0.9,
    keywords: ["lodges Machakos", "short stay rooms Machakos", "cheap lodge Machakos"]
  }),
  cityPage({
    file: "nairobi-lodges.html",
    path: "/nairobi-lodges",
    city: "Nairobi",
    category: "Lodges",
    title: "Lodges in Nairobi - Affordable Short Stay Rooms | AfricaRentalGrid",
    description: "Find affordable lodges in Nairobi with map view, verified room details, and direct listing access on AfricaRentalGrid.",
    priority: 0.8,
    keywords: ["lodges Nairobi", "short stay Nairobi", "cheap lodges Nairobi"]
  }),
  cityPage({
    file: "kitui-hostels.html",
    path: "/kitui-hostels",
    city: "Kitui",
    category: "Hostels",
    title: "Hostels in Kitui - Affordable Rooms | AfricaRentalGrid",
    description: "Search for hostels in Kitui with verified local listings, prices, and map view on AfricaRentalGrid.",
    priority: 0.7,
    keywords: ["hostels Kitui", "cheap rooms Kitui", "student hostels Kitui"]
  }),
  cityPage({
    file: "embu-hostels.html",
    path: "/embu-hostels",
    city: "Embu",
    category: "Hostels",
    title: "Hostels in Embu - Affordable Rooms | AfricaRentalGrid",
    description: "Find verified hostels in Embu with live prices, local search filters, and map view on AfricaRentalGrid.",
    priority: 0.7,
    keywords: ["hostels Embu", "cheap rooms Embu", "student hostels Embu"]
  }),
  cityPage({
    file: "makueni-hostels.html",
    path: "/makueni-hostels",
    city: "Makueni",
    category: "Hostels",
    title: "Hostels in Makueni - Affordable Rooms | AfricaRentalGrid",
    description: "Browse hostels in Makueni with verified listings, photos, and local accommodation search filters on AfricaRentalGrid.",
    priority: 0.7,
    keywords: ["hostels Makueni", "cheap rooms Makueni", "student hostels Makueni"]
  }),
  cityPage({
    file: "kajiado-hostels.html",
    path: "/kajiado-hostels",
    city: "Kajiado",
    category: "Hostels",
    title: "Hostels in Kajiado - Affordable Rooms | AfricaRentalGrid",
    description: "Search verified hostels in Kajiado with live pricing, local map view, and direct listing access on AfricaRentalGrid.",
    priority: 0.7,
    keywords: ["hostels Kajiado", "cheap rooms Kajiado", "student hostels Kajiado"]
  }),
  cityPage({
    file: "uasin-gishu-hostels.html",
    path: "/uasin-gishu-hostels",
    city: "Uasin Gishu",
    category: "Hostels",
    title: "Hostels in Uasin Gishu - Affordable Rooms | AfricaRentalGrid",
    description: "Find hostels in Uasin Gishu with verified accommodation listings, map view, and local pricing on AfricaRentalGrid.",
    priority: 0.7,
    keywords: ["hostels Uasin Gishu", "cheap rooms Uasin Gishu", "student hostels Eldoret"]
  }),
  privatePage({
    file: "admin.html",
    path: "/admin.html",
    title: "AfricaRentalGrid Admin",
    description: "Private admin dashboard for managing AfricaRentalGrid content and listings.",
    keywords: ["AfricaRentalGrid admin"],
    disallowPaths: ["/admin", "/admin.html"]
  }),
  privatePage({
    file: "superadmin.html",
    path: "/superadmin.html",
    title: "AfricaRentalGrid Super Admin",
    description: "Private super admin dashboard for managing platform-wide AfricaRentalGrid settings.",
    keywords: ["AfricaRentalGrid super admin"],
    disallowPaths: ["/superadmin", "/superadmin.html"]
  }),
  privatePage({
    file: "blog-admin.html",
    path: "/blog-admin.html",
    title: "Blog Admin | AfricaRentalGrid",
    description: "Private blog administration dashboard for AfricaRentalGrid.",
    keywords: ["AfricaRentalGrid blog admin"],
    disallowPaths: ["/blog-admin", "/blog-admin.html"]
  })
];

const blogPosts = [
  {
    slug: "best-student-hostels-near-university-of-nairobi",
    title: "Best Student Hostels Near University of Nairobi",
    description: "Find affordable and safe student hostels near the University of Nairobi with verified options.",
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY
  },
  {
    slug: "affordable-bedsitters-in-nairobi-for-students",
    title: "Affordable Bedsitters in Nairobi for Students",
    description: "Bedsitters balance privacy and affordability for students; explore top areas and tips.",
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY
  },
  {
    slug: "how-to-find-a-lodge-for-one-night-in-nairobi",
    title: "How to Find a Lodge for One Night in Nairobi",
    description: "Need a one-night stay? Here are affordable Nairobi lodge options and how to book safely.",
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY
  },
  {
    slug: "safe-student-accommodation-in-kenya",
    title: "Safe Student Accommodation in Kenya",
    description: "Safety tips for students choosing housing and how verified listings reduce risk.",
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY
  },
  {
    slug: "tips-for-finding-cheap-rentals-near-campus",
    title: "Tips for Finding Cheap Rentals Near Campus",
    description: "Smart ways to save on rent near campus without sacrificing safety or convenience.",
    changefreq: "monthly",
    priority: 0.6,
    lastmod: TODAY
  }
];

module.exports = {
  SITE,
  pages,
  blogPosts
};
