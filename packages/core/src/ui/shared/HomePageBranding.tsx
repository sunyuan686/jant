import type { FC } from "hono/jsx";
import {
  HOME_BRANDING_LINK_LABEL,
  HOME_BRANDING_PREFIX,
  JANT_HOME_URL,
} from "../../lib/jant-branding.js";

export const HomePageBranding: FC = () => {
  return (
    <footer class="home-branding-credit">
      {HOME_BRANDING_PREFIX}{" "}
      <a
        href={JANT_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="home-branding-link"
      >
        <span>{HOME_BRANDING_LINK_LABEL}</span>
      </a>
    </footer>
  );
};
