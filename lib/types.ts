export type Link = {
  url: string;
  name?: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: string;
};

export type Gift = {
  id: string;
  name: string;
  description: string;
  links: Link[];
  status?: "reserved" | "unavailable" | "bought";
  mine?: boolean;
};

export type Edition = {
  id: string;
  group_id: string;
  name: string;
  year: number;
  draw_at: string;
  exchange_at: string;
  budget?: number;
  state: "draft" | "scheduled" | "blocked" | "drawn";
  owner: boolean;
  can_reveal?: boolean;
  recipient?: string;
  members?: { id: string; name: string; email: string; selected: boolean; gift_count: number }[];
  pending?: string[];
  exceptions?: [string, string][];
};
