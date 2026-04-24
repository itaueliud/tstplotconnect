import { kenyaCounties } from "./kenya/counties";
import { ugandaCounties } from "./uganda/counties";
import { tanzaniaCounties } from "./tanzania/counties";

export const countrySeeds = {
  kenya: [...kenyaCounties],
  uganda: [...ugandaCounties],
  tanzania: [...tanzaniaCounties]
};

export type CountrySlug = keyof typeof countrySeeds;

export const countryDisplayNames: Record<CountrySlug, string> = {
  kenya: "Kenya",
  uganda: "Uganda",
  tanzania: "Tanzania"
};
