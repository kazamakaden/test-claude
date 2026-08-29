/** §5/§16 announcements. */
export type AnnouncementStatus = "draft" | "published";

export interface Announcement {
  id: string;
  /**
   * Already resolved for the reader's locale by the service: `_en` falls back
   * to `_th` when empty, the same convention content_blocks uses. Components
   * never see the raw column pair, so the fallback cannot be forgotten at one
   * of several call sites.
   */
  title: string;
  body: string;
  status: AnnouncementStatus;
  publishedAt: string | null;
  pinned: boolean;
  createdAt: string;
}

/** The raw column pair, for the staff editor — which must edit both halves. */
export interface AnnouncementDraft {
  id: string;
  titleTh: string;
  titleEn: string | null;
  bodyTh: string;
  bodyEn: string | null;
  status: AnnouncementStatus;
  pinned: boolean;
}
