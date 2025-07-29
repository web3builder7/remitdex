export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "RemitDEX",
  description:
    "Cross-chain remittance platform - Send money home instantly with the best rates",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Send Money",
      href: "/send",
    },
    {
      title: "Track Transfer",
      href: "/track",
    },
    {
      title: "Rates",
      href: "/rates",
    },
  ],
  links: {
    twitter: "https://twitter.com/remitdex",
    github: "https://github.com/remitdex",
    docs: "https://docs.remitdex.com",
  },
}
