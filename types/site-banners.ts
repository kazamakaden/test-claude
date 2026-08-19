export type SiteBannerStatus = "draft" | "published";
export type SiteBannerSource = "upload" | "facebook";

export type SiteBanner = {
  id: string;
  storagePath: string;
  /** Public Storage URL. A pure string build — the bucket is public (0065). */
  url: string;
  status: SiteBannerStatus;
  /** Thai Buddhist-era year. Always set on a published banner (0065's CHECK). */
  academicYear: number | null;
  term: number | null;
  source: SiteBannerSource;
  createdAt: string;
};

/** One academic year + เทอม that actually has banners, for the delete picker. */
export type SiteBannerGroup = {
  academicYear: number;
  term: number;
  count: number;
};
