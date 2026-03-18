// @ts-nocheck
import { promises as fs } from "node:fs"
import path from "node:path"

const blogRoot = path.join(process.cwd(), "content", "blog")
const coverImage = "https://images.unsplash.com/photo-1567789884554-0b844b597180"

const links = {
  businessContinuity:
    "https://www.business.qld.gov.au/running-business/protect-business/risk-management/business-continuity-planning",
  workSafe: "https://www.worksafe.qld.gov.au/",
  standards: "https://www.standards.org.au/",
  energex: "https://www.energex.com.au/",
  bom: "https://www.bom.gov.au/",
  tmr: "https://www.tmr.qld.gov.au/",
  resourcesQld: "https://www.resources.qld.gov.au/",
  healthQld: "https://www.health.qld.gov.au/",
  brisbaneCity: "https://www.brisbane.qld.gov.au/",
}

const posts = [
  {
    slug: "brisbane-generator-hire-guide-1",
    title: "Brisbane Generator Hire Guide: Practical Procurement Steps for Site Power",
    excerpt:
      "A practical Brisbane guide for selecting generator hire packages with clear load assumptions, service expectations, and handover controls that reduce project risk.",
    seoTitle: "Brisbane Generator Hire Guide for Site Power",
    seoDescription:
      "Plan generator hire in Brisbane with better load modelling, service coverage, and commissioning standards.",
    tags: ["Brisbane", "Generator Hire", "Temporary Power", "Site Planning"],
    focus: "temporary hire projects",
    riskContext: "project schedule and access risk",
    sector: "construction and commercial sites",
  },
  {
    slug: "brisbane-diesel-generator-service-guide-2",
    title: "Brisbane Diesel Generator Service Guide: Preventive Maintenance That Reduces Downtime",
    excerpt:
      "Learn how Brisbane teams can set diesel service intervals, inspection routines, and escalation pathways that prevent avoidable outages.",
    seoTitle: "Brisbane Diesel Generator Service Guide",
    seoDescription:
      "Diesel generator service best practice for Brisbane operators focused on uptime and safe response.",
    tags: ["Brisbane", "Diesel Generator", "Generator Service", "Maintenance"],
    focus: "diesel service programs",
    riskContext: "runtime and component-failure risk",
    sector: "industrial and commercial operations",
  },
  {
    slug: "brisbane-generator-sales-guide-3",
    title: "Brisbane Generator Sales Guide: How to Buy for Lifecycle Reliability",
    excerpt:
      "Use this Brisbane buying guide to compare generator sales options with lifecycle cost, maintainability, and commissioning quality in mind.",
    seoTitle: "Brisbane Generator Sales Guide",
    seoDescription:
      "Compare generator sales options in Brisbane with practical lifecycle and serviceability criteria.",
    tags: ["Brisbane", "Generator Sales", "Lifecycle Cost", "Procurement"],
    focus: "generator purchasing decisions",
    riskContext: "capital and long-term support risk",
    sector: "asset owners and procurement teams",
  },
  {
    slug: "brisbane-temporary-power-hire-guide-4",
    title: "Brisbane Temporary Power Hire Guide: Mobilisation, Safety, and Runtime Control",
    excerpt:
      "A field-focused Brisbane guide to temporary power hire that covers deployment sequencing, distribution safety, and runtime governance.",
    seoTitle: "Brisbane Temporary Power Hire Guide",
    seoDescription:
      "Temporary power hire guidance for Brisbane projects with practical mobilisation and safety controls.",
    tags: ["Brisbane", "Temporary Power", "Generator Hire", "Site Safety"],
    focus: "temporary distribution planning",
    riskContext: "mobilisation and safety risk",
    sector: "short-term project teams",
  },
  {
    slug: "brisbane-commercial-generator-maintenance-guide-5",
    title: "Brisbane Commercial Generator Maintenance Guide: Service Standards for Business Continuity",
    excerpt:
      "Set a practical commercial maintenance rhythm in Brisbane with repeatable checks, documented readings, and response-ready support pathways.",
    seoTitle: "Brisbane Commercial Generator Maintenance Guide",
    seoDescription:
      "Commercial generator maintenance in Brisbane with clear standards for continuity and uptime.",
    tags: ["Brisbane", "Commercial Generator", "Maintenance", "Business Continuity"],
    focus: "commercial maintenance standards",
    riskContext: "continuity and compliance risk",
    sector: "commercial facilities",
  },
  {
    slug: "brisbane-generator-emergency-backup-guide-6",
    title: "Brisbane Generator Emergency Backup Guide: Incident-Ready Power Planning",
    excerpt:
      "Build an emergency backup plan in Brisbane with trigger criteria, tested changeover procedures, and documented communications.",
    seoTitle: "Brisbane Emergency Backup Generator Guide",
    seoDescription:
      "Emergency backup generator planning for Brisbane organisations that need dependable incident response.",
    tags: ["Brisbane", "Emergency Backup", "Generator", "Incident Planning"],
    focus: "emergency backup readiness",
    riskContext: "incident and recovery-time risk",
    sector: "critical service operators",
  },
  {
    slug: "brisbane-generator-installation-service-guide-7",
    title: "Brisbane Generator Installation Service Guide: Commissioning Without Surprises",
    excerpt:
      "Installation and commissioning guidance for Brisbane generator projects, with pre-start checks, documentation quality, and acceptance testing.",
    seoTitle: "Brisbane Generator Installation Service Guide",
    seoDescription:
      "Generator installation service guidance in Brisbane with practical commissioning controls.",
    tags: ["Brisbane", "Generator Installation", "Commissioning", "Service"],
    focus: "installation and commissioning",
    riskContext: "handover and acceptance risk",
    sector: "new builds and upgrades",
  },
  {
    slug: "brisbane-generator-rental-for-events-guide-8",
    title: "Brisbane Generator Rental for Events Guide: Quiet, Safe, and Permit-Ready Power",
    excerpt:
      "Plan event generator rental in Brisbane with audience safety, noise expectations, and operational contingencies covered before bump-in.",
    seoTitle: "Brisbane Event Generator Rental Guide",
    seoDescription:
      "Event-focused generator rental guidance for Brisbane teams managing safety, permits, and uptime.",
    tags: ["Brisbane", "Events", "Generator Rental", "Temporary Power"],
    focus: "event power planning",
    riskContext: "public safety and schedule risk",
    sector: "events and activations",
  },
  {
    slug: "brisbane-industrial-generator-support-guide-9",
    title: "Brisbane Industrial Generator Support Guide: Response Models for Critical Operations",
    excerpt:
      "Define industrial generator support models in Brisbane with realistic response times, spares strategy, and measurable service outcomes.",
    seoTitle: "Brisbane Industrial Generator Support Guide",
    seoDescription:
      "Industrial generator support for Brisbane operations requiring reliable response and service consistency.",
    tags: ["Brisbane", "Industrial", "Generator Support", "Service Response"],
    focus: "industrial support coverage",
    riskContext: "high-consequence outage risk",
    sector: "industrial production environments",
  },
  {
    slug: "brisbane-generator-fleet-planning-guide-10",
    title: "Brisbane Generator Fleet Planning Guide: Capacity, Standardisation, and Cost Control",
    excerpt:
      "Use this fleet planning guide to standardise generator classes, improve utilisation, and lower maintenance friction across Brisbane operations.",
    seoTitle: "Brisbane Generator Fleet Planning Guide",
    seoDescription:
      "Fleet planning for Brisbane generator assets with practical capacity and standardisation choices.",
    tags: ["Brisbane", "Fleet Planning", "Generator", "Asset Strategy"],
    focus: "fleet capacity planning",
    riskContext: "utilisation and lifecycle cost risk",
    sector: "multi-site operators",
  },
  {
    slug: "brisbane-standby-generator-solutions-guide-11",
    title: "Brisbane Standby Generator Solutions Guide: Resilience Design for Facilities",
    excerpt:
      "Design standby generator solutions for Brisbane facilities with clear critical-load boundaries, testing cadence, and escalation governance.",
    seoTitle: "Brisbane Standby Generator Solutions Guide",
    seoDescription:
      "Standby generator design and support guidance for Brisbane facilities focused on resilience.",
    tags: ["Brisbane", "Standby Generator", "Resilience", "Facility Management"],
    focus: "standby resilience design",
    riskContext: "facility downtime risk",
    sector: "facilities and property portfolios",
  },
  {
    slug: "brisbane-generator-load-testing-guide-12",
    title: "Brisbane Generator Load Testing Guide: Proving Performance Before Failure",
    excerpt:
      "A practical Brisbane load testing guide for validating performance, documenting acceptance, and reducing uncertainty before critical demand periods.",
    seoTitle: "Brisbane Generator Load Testing Guide",
    seoDescription:
      "Load testing guidance for Brisbane generator assets with practical acceptance and reporting standards.",
    tags: ["Brisbane", "Load Testing", "Generator", "Commissioning"],
    focus: "load testing programs",
    riskContext: "performance verification risk",
    sector: "operations and engineering teams",
  },
  {
    slug: "brisbane-portable-generator-hire-guide-13",
    title: "Brisbane Portable Generator Hire Guide: Fast Deployment With Safe Distribution",
    excerpt:
      "Select portable generator hire in Brisbane with better cable planning, site safety controls, and realistic runtime expectations.",
    seoTitle: "Brisbane Portable Generator Hire Guide",
    seoDescription:
      "Portable generator hire guidance for Brisbane teams needing fast and safe temporary deployment.",
    tags: ["Brisbane", "Portable Generator", "Hire", "Site Deployment"],
    focus: "portable deployment",
    riskContext: "distribution and handling risk",
    sector: "mobile and temporary work sites",
  },
  {
    slug: "brisbane-generator-repairs-guide-14",
    title: "Brisbane Generator Repairs Guide: Triage, Root Cause, and Return-to-Service",
    excerpt:
      "Structure generator repairs in Brisbane with a triage workflow, repeat-failure prevention, and documented return-to-service checks.",
    seoTitle: "Brisbane Generator Repairs Guide",
    seoDescription:
      "Generator repair planning for Brisbane teams with practical triage and root-cause controls.",
    tags: ["Brisbane", "Generator Repairs", "Root Cause", "Service"],
    focus: "repair workflow management",
    riskContext: "repeat-failure and outage risk",
    sector: "maintenance and reliability teams",
  },
  {
    slug: "brisbane-generator-replacement-planning-guide-15",
    title: "Brisbane Generator Replacement Planning Guide: Timing Capital Decisions With Risk",
    excerpt:
      "Decide when to replace generator assets in Brisbane using reliability trend data, service burden, and operational consequence mapping.",
    seoTitle: "Brisbane Generator Replacement Planning Guide",
    seoDescription:
      "Replacement planning for Brisbane generator assets based on risk, reliability, and lifecycle economics.",
    tags: ["Brisbane", "Generator Replacement", "Capital Planning", "Asset Lifecycle"],
    focus: "replacement timing",
    riskContext: "end-of-life reliability risk",
    sector: "asset owners and finance teams",
  },
  {
    slug: "brisbane-generator-compliance-checks-guide-16",
    title: "Brisbane Generator Compliance Checks Guide: Audit-Ready Records and Site Controls",
    excerpt:
      "Build a compliance check process in Brisbane that keeps generator records complete, inspections traceable, and audit responses faster.",
    seoTitle: "Brisbane Generator Compliance Checks Guide",
    seoDescription:
      "Generator compliance checks in Brisbane with audit-ready records and practical site governance.",
    tags: ["Brisbane", "Compliance", "Generator", "Audit"],
    focus: "compliance record systems",
    riskContext: "audit and governance risk",
    sector: "regulated and safety-critical sites",
  },
  {
    slug: "brisbane-mine-site-generator-service-guide-17",
    title: "Brisbane Mine Site Generator Service Guide: Remote Reliability and Fuel Assurance",
    excerpt:
      "Mine-site generator service guidance for Brisbane-linked operations with remote logistics, fuel controls, and resilient maintenance planning.",
    seoTitle: "Brisbane Mine Site Generator Service Guide",
    seoDescription:
      "Remote mine-site generator service planning with practical reliability and fuel assurance controls.",
    tags: ["Brisbane", "Mine Site", "Generator Service", "Remote Operations"],
    focus: "remote site service planning",
    riskContext: "logistics and environmental risk",
    sector: "mine and resources operations",
  },
  {
    slug: "brisbane-construction-generator-hire-guide-18",
    title: "Brisbane Construction Generator Hire Guide: Staged Power for Complex Programs",
    excerpt:
      "Plan construction generator hire in Brisbane by stage, with temporary distribution, access constraints, and shifting demand profiles accounted for.",
    seoTitle: "Brisbane Construction Generator Hire Guide",
    seoDescription:
      "Construction-focused generator hire guidance for Brisbane programs with staged power demands.",
    tags: ["Brisbane", "Construction", "Generator Hire", "Program Delivery"],
    focus: "construction stage planning",
    riskContext: "program and interface risk",
    sector: "construction contractors",
  },
  {
    slug: "brisbane-hospital-backup-generator-guide-19",
    title: "Brisbane Hospital Backup Generator Guide: Clinical Risk, Redundancy, and Testing",
    excerpt:
      "A healthcare-focused backup generator guide for Brisbane teams balancing clinical risk, redundancy strategy, and verification discipline.",
    seoTitle: "Brisbane Hospital Backup Generator Guide",
    seoDescription:
      "Hospital backup generator planning in Brisbane with redundancy and testing controls for clinical continuity.",
    tags: ["Brisbane", "Hospital", "Backup Generator", "Critical Infrastructure"],
    focus: "clinical backup systems",
    riskContext: "patient-safety and continuity risk",
    sector: "healthcare facilities",
  },
  {
    slug: "brisbane-generator-fuel-management-guide-20",
    title: "Brisbane Generator Fuel Management Guide: Quality, Storage, and Consumption Control",
    excerpt:
      "Improve generator fuel management in Brisbane with storage standards, sampling discipline, and usage analytics that support uptime.",
    seoTitle: "Brisbane Generator Fuel Management Guide",
    seoDescription:
      "Fuel management guidance for Brisbane generator operations, covering quality, storage, and consumption control.",
    tags: ["Brisbane", "Fuel Management", "Generator", "Reliability"],
    focus: "fuel quality management",
    riskContext: "fuel degradation and supply risk",
    sector: "high-runtime generator fleets",
  },
  {
    slug: "generator-maintenance-basics",
    title: "Generator Maintenance Basics for Brisbane Teams: A Repeatable Weekly Rhythm",
    excerpt:
      "A plain-language maintenance baseline for Brisbane teams who need reliable weekly checks, cleaner records, and faster fault escalation.",
    seoTitle: "Generator Maintenance Basics Brisbane",
    seoDescription:
      "Generator maintenance basics for Brisbane teams wanting practical weekly checks and dependable uptime.",
    tags: ["Brisbane", "Generator Maintenance", "Basics", "Uptime"],
    focus: "weekly maintenance basics",
    riskContext: "basic process drift risk",
    sector: "general business operations",
  },
  {
    slug: "rental-fleet-planning",
    title: "Rental Fleet Planning for Generator Providers: Utilisation, Readiness, and Margin",
    excerpt:
      "A strategic fleet planning guide for generator rental providers balancing utilisation targets, maintenance readiness, and commercial margin.",
    seoTitle: "Generator Rental Fleet Planning Guide",
    seoDescription:
      "Plan generator rental fleets with better utilisation, readiness, and margin discipline.",
    tags: ["Fleet Planning", "Generator Rental", "Utilisation", "Commercial Strategy"],
    focus: "rental fleet portfolio planning",
    riskContext: "utilisation and margin volatility",
    sector: "rental providers",
  },
]

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function buildSectionOne(meta) {
  return [
    `${meta.sector} in Brisbane usually perform better when ${meta.focus} decisions begin with measured load behaviour instead of rough assumptions. Teams should map startup demand, duty cycle, and environmental constraints before they lock scope or commit commercial terms. The [Queensland business continuity planning guidance](${links.businessContinuity}) is a useful baseline for defining critical-load priorities and minimum runtime expectations.`,
    "",
    "- Capture startup and steady-state demand as separate values before seeking quotes.",
    "- Document access, lifting, and delivery constraints that could delay mobilisation.",
    "- Confirm switchboard interfaces and temporary distribution responsibilities early.",
    "- Align fuel, noise, and site operating windows to realistic project conditions.",
    "",
    `This front-end discipline gives operations, procurement, and service teams a shared starting point, reducing rework and improving confidence when conditions change on site.`,
  ].join("\n")
}

function buildSectionTwo(meta) {
  return [
    `Service coverage should reflect ${meta.riskContext}, not a generic calendar. Brisbane environments often combine variable weather, constrained access, and tight production windows, so response models need clear priorities. Reference material from [WorkSafe Queensland](${links.workSafe}) can help teams shape safe inspection routines and escalation practices without creating unnecessary complexity.`,
    "",
    "- Define response tiers for business-hours, after-hours, and incident-critical faults.",
    "- Pair inspection intervals with runtime intensity rather than fixed monthly habits.",
    "- Track alarm history and recurring symptoms in a single service log.",
    `- Add weather-aware checks using [Bureau of Meteorology](${links.bom}) forecasts during high-risk periods.`,
    "",
    "A risk-based service pattern reduces avoidable outages and supports better decisions when operations need rapid stabilisation under pressure.",
  ].join("\n")
}

function buildSectionThree(meta) {
  return [
    `When ${meta.sector} teams compare hire, service, and ownership pathways, they should evaluate operational fit as carefully as price. A simple matrix helps stakeholders align technical requirements with commercial outcomes, and [Standards Australia](${links.standards}) can guide discussions about baseline quality and documentation expectations.`,
    "",
    "| Pathway | Strong Fit | Common Watchout |",
    "| --- | --- | --- |",
    "| Hire | Variable demand or short projects | Scope creep without clear runtime assumptions |",
    "| Service Contract | Existing assets with predictable duty | Slow escalation if SLAs are vague |",
    "| Purchase | Stable long-term load profile | Underestimating lifecycle support cost |",
    "",
    "- Build acceptance criteria before contract award, not after mobilisation.",
    "- Require clear commissioning evidence and support contacts in writing.",
    "- Include operator capability and documentation quality in supplier scoring.",
    "- Review end-of-term options early to avoid expensive transition decisions.",
    "",
    `Using the same matrix across projects makes procurement outcomes more consistent and easier to defend with finance, operations, and governance teams.`,
  ].join("\n")
}

function buildSectionFour(meta) {
  return [
    `Commissioning and handover quality often determines whether a project starts smoothly or carries hidden reliability debt. A standard handover pack should travel with every asset and include baseline settings, alarm status, maintenance intervals, and response pathways. Network-facing details should also be checked against local utility guidance from [Energex](${links.energex}) where relevant.`,
    "",
    "- Use one handover template across hire periods and owned assets.",
    "- Attach commissioning test evidence and unresolved defect actions.",
    "- Record emergency contacts and escalation windows in an operator-ready format.",
    `- Include logistics notes and access assumptions for transport teams via [Transport and Main Roads](${links.tmr}).`,
    "",
    `With consistent records, ${meta.sector} can reduce onboarding delays, shorten fault triage time, and preserve confidence during high-pressure operating windows.`,
  ].join("\n")
}

function buildPost(meta, index) {
  const publishedAt = new Date(Date.UTC(2026, 2, 11 - index)).toISOString().slice(0, 10)
  const sections = [
    {
      heading: `Start ${meta.focus.charAt(0).toUpperCase()}${meta.focus.slice(1)} With Real Operating Data`,
      body: buildSectionOne(meta),
    },
    {
      heading: `Match Service Controls To ${meta.riskContext.charAt(0).toUpperCase()}${meta.riskContext.slice(1)}`,
      body: buildSectionTwo(meta),
    },
    {
      heading: "Compare Hire, Service, And Ownership Using A Practical Decision Matrix",
      body: buildSectionThree(meta),
    },
    {
      heading: "Standardise Commissioning And Handover To Protect Reliability",
      body: buildSectionFour(meta),
    },
  ]

  return {
    slug: meta.slug,
    title: meta.title,
    excerpt: meta.excerpt,
    seoTitle: meta.seoTitle,
    seoDescription: meta.seoDescription,
    publishedAt,
    author: {
      name: "GenFix Editorial Team",
      role: "Generator Solutions Specialists",
    },
    coverImage,
    tags: meta.tags,
    sections: sections.map((section) => ({
      id: slugify(section.heading).slice(0, 64),
      heading: section.heading,
      body: section.body,
    })),
  }
}

async function run() {
  await fs.mkdir(blogRoot, { recursive: true })
  const existing = await fs.readdir(blogRoot)
  await Promise.all(
    existing
      .filter((name) => name.endsWith(".json"))
      .map((name) => fs.unlink(path.join(blogRoot, name)))
  )

  const materialized = posts.map((meta, index) => buildPost(meta, index))

  for (const post of materialized) {
    const filePath = path.join(blogRoot, `${post.slug}.json`)
    await fs.writeFile(filePath, `${JSON.stringify(post, null, 2)}\n`, "utf8")
  }

  console.log(`written=${materialized.length}`)
}

await run()
